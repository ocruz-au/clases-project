import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAttendance(
    sessionId: string,
    bookingId: string,
    status: 'ATTENDED' | 'NO_SHOW',
    actorUserId: string,
  ) {
    // Resolve instructor profile for the authed user
    const profile = await this.prisma.instructorProfile.findFirst({
      where: { userId: actorUserId, deletedAt: null },
    });
    if (!profile) throw new ForbiddenException('No instructor profile found for this user');

    // Verify session is assigned to this instructor
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.instructorId !== profile.id) {
      throw new ForbiddenException('This session is not assigned to you');
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, classSessionId: sessionId, deletedAt: null },
      });
      if (!booking) throw new NotFoundException('Booking not found for this session');
      if (booking.status !== 'CONFIRMED') {
        throw new BadRequestException(`Cannot mark attendance for booking with status ${booking.status}`);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          checkedInAt: status === 'ATTENDED' ? new Date() : null,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: `ATTENDANCE_${status}`,
          resourceType: 'Booking',
          resourceId: bookingId,
          beforeState: { status: 'CONFIRMED' },
          afterState: { status },
        },
      });

      return updated;
    });
  }
}
