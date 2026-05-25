import { Injectable, Logger, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { WaitlistPromotionService } from '../../waitlists/promotion.service';

@Injectable()
export class PaymentFailedHandler {
  private readonly logger = new Logger(PaymentFailedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly promotion: WaitlistPromotionService | null,
  ) {}

  async handleSessionExpired(stripeSession: Stripe.Checkout.Session): Promise<void> {
    const bookingId = stripeSession.metadata?.['bookingId'];
    const paymentId = stripeSession.metadata?.['paymentId'];

    if (!bookingId) {
      this.logger.warn(`Missing bookingId on expired stripe session ${stripeSession.id}`);
      return;
    }

    await this.expireBooking(bookingId, paymentId ?? null);
  }

  async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!payment) {
      this.logger.warn(`No payment found for intent ${paymentIntent.id}`);
      return;
    }

    const booking = await this.prisma.booking.findFirst({
      where: { paymentId: payment.id, deletedAt: null },
    });
    if (!booking) return;

    await this.expireBooking(booking.id, payment.id);
  }

  private async expireBooking(bookingId: string, paymentId: string | null): Promise<void> {
    let sessionId: string | null = null;
    let holdSource: string | null = null;
    let waitlistEntryId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, deletedAt: null },
        include: { seatHold: true },
      });
      if (!booking || booking.status === 'EXPIRED') return;

      sessionId = booking.classSessionId;
      holdSource = booking.seatHold?.source ?? null;

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'EXPIRED' },
      });

      if (booking.seatHoldId) {
        await tx.seatHold.update({
          where: { id: booking.seatHoldId },
          data: { status: 'RELEASED' },
        });

        // If promoted from waitlist, expire the waitlist entry
        if (holdSource === 'WAITLIST_PROMOTION') {
          const entry = await tx.waitlistEntry.findFirst({
            where: { offeredSeatHoldId: booking.seatHoldId, status: 'OFFERED' },
          });
          if (entry) {
            waitlistEntryId = entry.id;
            await tx.waitlistEntry.update({
              where: { id: entry.id },
              data: { status: 'EXPIRED' },
            });
          }
        }
      }

      if (paymentId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'FAILED' },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'BOOKING_EXPIRED',
          resourceType: 'Booking',
          resourceId: bookingId,
          afterState: { status: 'EXPIRED', waitlistEntryId },
        },
      });
    });

    // Promote next waitlist entry after expiry (fire-and-forget)
    if (sessionId && this.promotion) {
      this.promotion.promoteNext(sessionId).catch((err) =>
        this.logger.error(`Failed to promote next after expiry: ${String(err)}`),
      );
    }
  }
}
