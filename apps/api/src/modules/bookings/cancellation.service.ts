import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { WaitlistPromotionService } from '../waitlists/promotion.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { toPerth } from '@app/shared';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: CancellationPolicyService,
    private readonly notifications: NotificationService,
    @Optional() @Inject('STRIPE') private readonly stripe: Stripe | null,
    @Optional() private readonly promotion: WaitlistPromotionService | null,
  ) {}

  async cancelBooking(bookingId: string, actorId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        user: true,
        payment: true,
        session: {
          include: {
            class: { include: { cancellationPolicy: true } },
            cancellationPolicy: true,
            room: { include: { location: true } },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== actorId) throw new ForbiddenException('Cannot cancel another user\'s booking');
    if (booking.status !== 'CONFIRMED') {
      throw new ForbiddenException(`Booking is ${booking.status}, cannot cancel`);
    }

    // Resolve applicable cancellation policy: session-level → class-level → global default
    const policy =
      booking.session.cancellationPolicy ??
      booking.session.class.cancellationPolicy ??
      (await this.policyService.findDefault());

    const now = new Date();
    const refundPercent = policy
      ? this.policyService.computeRefundPercent(policy, booking.session.startsAt, now)
      : 0;
    const refundAmountCents = Math.round((booking.amountCents * refundPercent) / 100);

    // Issue Stripe refund before the DB transaction so we can roll back on Stripe failure
    let stripeRefundId: string | undefined;
    if (refundAmountCents > 0 && booking.payment?.stripePaymentIntentId && this.stripe) {
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: booking.payment.stripePaymentIntentId,
          amount: refundAmountCents,
          metadata: { bookingId, reason: 'student_cancellation' },
        },
        { idempotencyKey: `cancel-${bookingId}` },
      );
      stripeRefundId = stripeRefund.id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', cancelledAt: now },
      });

      if (refundAmountCents > 0 && booking.paymentId) {
        await tx.refund.create({
          data: {
            paymentId: booking.paymentId,
            amountCents: refundAmountCents,
            reason: `Student cancellation — ${refundPercent}% refund`,
            stripeRefundId: stripeRefundId ?? null,
            status: stripeRefundId ? 'PENDING' : 'FAILED',
          },
        });

        const newPaymentStatus =
          refundAmountCents >= booking.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await tx.payment.update({
          where: { id: booking.paymentId },
          data: { status: newPaymentStatus },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BOOKING_CANCELLED',
          resourceType: 'Booking',
          resourceId: bookingId,
          beforeState: { status: 'CONFIRMED' },
          afterState: { status: 'CANCELLED', refundAmountCents, refundPercent, stripeRefundId },
        },
      });
    });

    // Post-commit: freed seat → trigger waitlist promotion (fire-and-forget)
    if (this.promotion) {
      this.promotion.promoteNext(booking.classSessionId).catch((err) =>
        this.logger.error(`Waitlist promotion failed after cancellation: ${String(err)}`),
      );
    }

    // Post-commit: send cancellation email (fire-and-forget)
    try {
      const perthStart = toPerth(booking.session.startsAt);
      const refundNote =
        refundAmountCents > 0
          ? `A refund of $${(refundAmountCents / 100).toFixed(2)} AUD has been initiated.`
          : 'No refund applies per the cancellation policy.';

      await this.notifications.dispatch(booking.userId, 'CANCELLATION', {
        toEmail: booking.user.email,
        toName: booking.user.name,
        subject: `Booking Cancelled: ${booking.session.class.title}`,
        html: `<p>Hi ${booking.user.name},</p><p>Your booking for <strong>${booking.session.class.title}</strong> on ${perthStart.toFormat('d MMMM yyyy')} at ${perthStart.toFormat('h:mm a')} (Perth) has been cancelled.</p><p>${refundNote}</p>`,
        bookingId,
        refundAmountCents,
      });
    } catch (err) {
      this.logger.error(`Failed to queue cancellation notification for booking ${bookingId}: ${String(err)}`);
    }

    return this.prisma.booking.findFirst({
      where: { id: bookingId },
      include: { session: { include: { class: true, room: { include: { location: true } } } } },
    });
  }
}
