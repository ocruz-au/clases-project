import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

@ApiTags('Instructor')
@Controller('instructor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
export class InstructorSessionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List sessions assigned to the authed instructor' })
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.prisma.instructorProfile.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    if (!profile) throw new ForbiddenException('No instructor profile found');

    return this.prisma.classSession.findMany({
      where: { instructorId: profile.id, deletedAt: null },
      include: {
        class: true,
        room: { include: { location: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  @Get('sessions/:id/attendees')
  @ApiOperation({ summary: 'List attendees for a session assigned to the authed instructor' })
  async getAttendees(@CurrentUser() user: AuthenticatedUser, @Param('id') sessionId: string) {
    const profile = await this.prisma.instructorProfile.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    if (!profile) throw new ForbiddenException('No instructor profile found');

    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.instructorId !== profile.id) {
      throw new ForbiddenException('This session is not assigned to you');
    }

    return this.prisma.booking.findMany({
      where: { classSessionId: sessionId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('sessions/:id/attendance')
  @ApiOperation({ summary: 'Record ATTENDED or NO_SHOW for a booking in an assigned session' })
  recordAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Body() body: { bookingId: string; status: 'ATTENDED' | 'NO_SHOW' },
  ) {
    return this.attendanceService.recordAttendance(
      sessionId,
      body.bookingId,
      body.status,
      user.id,
    );
  }
}
