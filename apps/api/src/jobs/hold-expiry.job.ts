import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistPromotionService } from '../modules/waitlists/promotion.service';

@Injectable()
export class HoldExpiryJob {
  private readonly logger = new Logger(HoldExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotion: WaitlistPromotionService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredHolds(): Promise<void> {
    const expiredHolds = await this.prisma.seatHold.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    });

    if (expiredHolds.length === 0) return;

    this.logger.log(`Processing ${expiredHolds.length} expired hold(s)`);

    const affectedSessions = new Set<string>();

    for (const hold of expiredHolds) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Release the hold
          await tx.seatHold.update({
            where: { id: hold.id },
            data: { status: 'RELEASED' },
          });

          // Expire linked booking (CHECKOUT source)
          const booking = await tx.booking.findFirst({
            where: { seatHoldId: hold.id, status: 'HELD', deletedAt: null },
          });
          if (booking) {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'EXPIRED' },
            });
          }

          // Expire linked waitlist entry (WAITLIST_PROMOTION source)
          const waitlistEntry = await tx.waitlistEntry.findFirst({
            where: { offeredSeatHoldId: hold.id, status: 'OFFERED' },
          });
          if (waitlistEntry) {
            await tx.waitlistEntry.update({
              where: { id: waitlistEntry.id },
              data: { status: 'EXPIRED' },
            });
          }

          await tx.auditLog.create({
            data: {
              action: 'HOLD_EXPIRED',
              resourceType: 'SeatHold',
              resourceId: hold.id,
              afterState: { status: 'RELEASED', sessionId: hold.classSessionId },
            },
          });
        });

        affectedSessions.add(hold.classSessionId);
      } catch (err) {
        this.logger.error(`Error expiring hold ${hold.id}: ${String(err)}`);
      }
    }

    // Promote next waitlist entry for each affected session
    for (const sessionId of affectedSessions) {
      try {
        await this.promotion.promoteNext(sessionId);
      } catch (err) {
        this.logger.error(`Error promoting next for session ${sessionId}: ${String(err)}`);
      }
    }
  }
}
