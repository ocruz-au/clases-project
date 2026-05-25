import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ChargeRefundedHandler {
  private readonly logger = new Logger(ChargeRefundedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(charge: Stripe.Charge): Promise<void> {
    if (!charge.payment_intent) {
      this.logger.warn(`charge.refunded event missing payment_intent: ${charge.id}`);
      return;
    }

    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent.id;

    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      this.logger.warn(`No payment found for payment_intent ${paymentIntentId}`);
      return;
    }

    // Mark any PENDING refund rows as SUCCEEDED
    for (const stripeRefundObj of charge.refunds?.data ?? []) {
      const existing = await this.prisma.refund.findFirst({
        where: { stripeRefundId: stripeRefundObj.id },
      });
      if (existing?.status === 'PENDING') {
        await this.prisma.refund.update({
          where: { id: existing.id },
          data: { status: 'SUCCEEDED' },
        });
      }
    }

    // Determine new payment status based on total amount refunded
    const totalRefunded = charge.amount_refunded ?? 0;
    const isFullRefund = totalRefunded >= payment.amountCents;
    const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    if (payment.status !== newStatus) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'PAYMENT_REFUNDED',
        resourceType: 'Payment',
        resourceId: payment.id,
        afterState: { status: newStatus, totalRefunded },
      },
    });
  }
}
