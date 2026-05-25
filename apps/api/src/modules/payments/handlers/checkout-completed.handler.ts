import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notifications/notification.service';
import { toPerth } from '@app/shared';

@Injectable()
export class CheckoutCompletedHandler {
  private readonly logger = new Logger(CheckoutCompletedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    @Optional() @Inject('STRIPE') private readonly stripe: Stripe | null,
  ) {}

  async handle(stripeSession: Stripe.Checkout.Session): Promise<void> {
    const stripeCheckoutSessionId = stripeSession.id;
    const bookingId = stripeSession.metadata?.['bookingId'];
    const paymentId = stripeSession.metadata?.['paymentId'];

    if (!bookingId || !paymentId) {
      this.logger.warn(`Missing metadata on stripe session ${stripeCheckoutSessionId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, deletedAt: null },
        include: {
          session: {
            include: {
              class: true,
              instructor: { include: { user: true } },
              room: { include: { location: true } },
            },
          },
          user: true,
          seatHold: true,
        },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for Stripe session ${stripeCheckoutSessionId}`);
        return;
      }

      if (booking.status === 'CONFIRMED') {
        this.logger.log(`Booking ${bookingId} already confirmed — skipping`);
        return;
      }

      // Late-webhook reconciliation: hold may be expired
      if (booking.seatHold && this.isHoldExpired(booking.seatHold)) {
        this.logger.warn(`Booking ${bookingId} hold expired — checking remaining capacity`);

        const [holdCount, confirmedCount] = await Promise.all([
          tx.seatHold.count({
            where: { classSessionId: booking.classSessionId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
          }),
          tx.booking.count({
            where: { classSessionId: booking.classSessionId, status: 'CONFIRMED', deletedAt: null },
          }),
        ]);

        const session = await tx.classSession.findUnique({ where: { id: booking.classSessionId } });
        const hasCapacity = session && holdCount + confirmedCount < session.capacity;

        if (!hasCapacity) {
          // Session full — issue refund and notify
          this.logger.warn(`Session full for late booking ${bookingId} — initiating refund`);
          if (this.stripe && stripeSession.payment_intent) {
            try {
              await this.stripe.refunds.create({
                payment_intent: stripeSession.payment_intent as string,
                metadata: { bookingId, reason: 'late_webhook_session_full' },
              });
            } catch (refundErr) {
              this.logger.error(`Refund failed for late booking ${bookingId}: ${String(refundErr)}`);
            }
          }
          await tx.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } });
          await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
          return;
        }
        // Capacity available — honor the late payment, fall through to confirm
      }

      // Update payment to SUCCEEDED
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCEEDED',
          stripeCheckoutSessionId,
          stripePaymentIntentId: stripeSession.payment_intent as string | null,
        },
      });

      // Confirm booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED', paymentId },
      });

      // Consume seat hold
      if (booking.seatHoldId) {
        await tx.seatHold.update({
          where: { id: booking.seatHoldId },
          data: { status: 'CONSUMED' },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_CONFIRMED',
          resourceType: 'Booking',
          resourceId: bookingId,
          afterState: { status: 'CONFIRMED', paymentId },
        },
      });
    });

    // Dispatch confirmation notification AFTER commit

    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId },
        include: {
          user: true,
          session: {
            include: {
              class: true,
              instructor: { include: { user: true } },
              room: { include: { location: true } },
            },
          },
        },
      });

      if (booking?.user && booking.session) {
        const perthStart = toPerth(booking.session.startsAt);
        const amountFormatted = `$${(booking.amountCents / 100).toFixed(2)} ${booking.session.class.currency}`;

        await this.notifications.dispatch(booking.userId, 'BOOKING_CONFIRMATION', {
          toEmail: booking.user.email,
          toName: booking.user.name,
          subject: `Booking Confirmed: ${booking.session.class.title}`,
          html: `<p>Hi ${booking.user.name},</p><p>Your booking for <strong>${booking.session.class.title}</strong> on ${perthStart.toFormat('d MMMM yyyy')} at ${perthStart.toFormat('h:mm a')} (Perth) is confirmed.</p><p>Amount: ${amountFormatted}</p><p>Booking ID: ${bookingId}</p>`,
          bookingId,
          sessionId: booking.classSessionId,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to queue confirmation notification for booking ${bookingId}: ${String(err)}`);
    }
  }

  private isHoldExpired(hold: { expiresAt: Date; status: string }): boolean {
    return hold.status !== 'ACTIVE' || hold.expiresAt <= new Date();
  }
}
