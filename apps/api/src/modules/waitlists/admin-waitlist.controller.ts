import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { WaitlistPromotionService } from './promotion.service';

@Controller('admin/waitlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminWaitlistController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotion: WaitlistPromotionService,
  ) {}

  @Get('session/:sessionId')
  async getQueue(@Param('sessionId') sessionId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { classSessionId: sessionId, deletedAt: null },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  @Post('entries/:id/action')
  async takeAction(
    @Param('id') entryId: string,
    @Body() body: { action: 'REMOVE' | 'SKIP' | 'PROMOTE' },
  ) {
    const { action } = body;
    if (!['REMOVE', 'SKIP', 'PROMOTE'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, deletedAt: null },
    });
    if (!entry) throw new BadRequestException('Waitlist entry not found');

    if (action === 'REMOVE') {
      await this.prisma.$transaction(async (tx) => {
        await tx.waitlistEntry.update({
          where: { id: entryId },
          data: { status: 'REMOVED' },
        });
        await tx.auditLog.create({
          data: {
            action: 'WAITLIST_REMOVED',
            resourceType: 'WaitlistEntry',
            resourceId: entryId,
            afterState: { status: 'REMOVED' },
          },
        });
      });
      return { success: true, status: 'REMOVED' };
    }

    if (action === 'SKIP') {
      await this.prisma.$transaction(async (tx) => {
        await tx.waitlistEntry.update({
          where: { id: entryId },
          data: { status: 'SKIPPED' },
        });
        // Move remaining WAITING entries up
        await tx.waitlistEntry.updateMany({
          where: {
            classSessionId: entry.classSessionId,
            status: 'WAITING',
            position: { gt: entry.position },
          },
          data: { position: { decrement: 1 } },
        });
        await tx.auditLog.create({
          data: {
            action: 'WAITLIST_SKIPPED',
            resourceType: 'WaitlistEntry',
            resourceId: entryId,
            afterState: { status: 'SKIPPED' },
          },
        });
      });
      return { success: true, status: 'SKIPPED' };
    }

    // PROMOTE
    await this.promotion.promoteNext(entry.classSessionId);
    return { success: true, status: 'PROMOTED' };
  }
}
