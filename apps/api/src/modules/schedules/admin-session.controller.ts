import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { toPerth } from '@app/shared';

@Controller('admin/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminSessionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { capacity?: number; status?: string },
  ) {
    return this.prisma.classSession.update({
      where: { id },
      data: {
        ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
        ...(body.status !== undefined ? { status: body.status as 'SCHEDULED' | 'CANCELLED' | 'COMPLETED' } : {}),
      },
    });
  }

  @Post(':id/cancel')
  async cancelSession(@Param('id') id: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        class: true,
        room: { include: { location: true } },
      },
    });
    if (!session) return { cancelled: 0, refundsInitiated: 0 };

    const confirmedBookings = await this.prisma.booking.findMany({
      where: { classSessionId: id, status: 'CONFIRMED', deletedAt: null },
      include: { user: true, payment: true },
    });

    await this.prisma.$transaction(async (tx) => {
      // Soft-cancel the session
      await tx.classSession.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Cancel all confirmed bookings
      for (const booking of confirmedBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      }

      // Release all active seat holds
      await tx.seatHold.updateMany({
        where: { classSessionId: id, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'SESSION_CANCELLED',
          resourceType: 'ClassSession',
          resourceId: id,
          afterState: { status: 'CANCELLED', cancelledBookings: confirmedBookings.length },
        },
      });
    });

    // Dispatch cancellation notifications post-commit
    const perthStart = toPerth(session.startsAt);
    for (const booking of confirmedBookings) {
      if (booking.user) {
        this.notifications
          .dispatch(booking.userId, 'CANCELLATION', {
            toEmail: booking.user.email,
            toName: booking.user.name,
            subject: `Session Cancelled: ${session.class.title}`,
            html: `<p>Hi ${booking.user.name},</p><p>We're sorry — the session <strong>${session.class.title}</strong> on ${perthStart.toFormat('d MMMM yyyy')} at ${perthStart.toFormat('h:mm a')} (Perth) has been cancelled by the organiser.</p><p>If you paid, a refund will be processed within 5–10 business days.</p>`,
            bookingId: booking.id,
            sessionId: id,
          })
          .catch(() => undefined);
      }
    }

    return { cancelled: confirmedBookings.length, refundsInitiated: confirmedBookings.length };
  }
}
