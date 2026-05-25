import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SeatHoldService } from '../bookings/seat-hold.service';
import { NotificationService } from '../notifications/notification.service';
import { toPerth } from '@app/shared';

@Injectable()
export class WaitlistPromotionService {
  private readonly logger = new Logger(WaitlistPromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatHoldService: SeatHoldService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Promote the next WAITING entry for a session.
   * Creates a SeatHold for them, marks their entry OFFERED.
   * Fire-and-forget notification after commit.
   */
  async promoteNext(sessionId: string): Promise<void> {
    const nextEntry = await this.prisma.waitlistEntry.findFirst({
      where: { classSessionId: sessionId, status: 'WAITING' },
      orderBy: { position: 'asc' },
      include: { user: true },
    });

    if (!nextEntry) {
      this.logger.log(`No WAITING entries for session ${sessionId}`);
      return;
    }

    let holdId: string;
    try {
      const hold = await this.seatHoldService.createHold(
        nextEntry.userId,
        sessionId,
        'WAITLIST_PROMOTION',
      );
      holdId = hold.id;
    } catch (err) {
      this.logger.warn(
        `Cannot promote entry ${nextEntry.id} — no seat available: ${String(err)}`,
      );
      return;
    }

    await this.prisma.waitlistEntry.update({
      where: { id: nextEntry.id },
      data: { status: 'OFFERED', offeredSeatHoldId: holdId },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'WAITLIST_PROMOTED',
        resourceType: 'WaitlistEntry',
        resourceId: nextEntry.id,
        afterState: { status: 'OFFERED', holdId },
      },
    });

    // Notify after DB update
    try {
      const holdWindowMinutes = this.config.get<number>('SEAT_HOLD_WINDOW_MINUTES') ?? 10;
      const hold = await this.prisma.seatHold.findUnique({ where: { id: holdId } });
      const session = await this.prisma.classSession.findUnique({
        where: { id: sessionId },
        include: { class: true, room: { include: { location: true } } },
      });

      if (nextEntry.user && session && hold) {
        const perthStart = toPerth(session.startsAt);
        const deadline = toPerth(hold.expiresAt);

        await this.notifications.dispatch(nextEntry.userId, 'WAITLIST_PROMOTION', {
          toEmail: nextEntry.user.email,
          toName: nextEntry.user.name,
          subject: `Seat Available: ${session.class.title}`,
          html: `<p>Hi ${nextEntry.user.name},</p><p>A seat is now available for <strong>${session.class.title}</strong> on ${perthStart.toFormat('d MMMM yyyy')} at ${perthStart.toFormat('h:mm a')} (Perth).</p><p>Complete your payment by ${deadline.toFormat('d MMM yyyy h:mm a')} (Perth) — your hold expires in ${holdWindowMinutes} minutes.</p>`,
          sessionId,
          holdId,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch waitlist promotion notification: ${String(err)}`);
    }
  }
}
