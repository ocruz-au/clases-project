import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutCompletedHandler } from './handlers/checkout-completed.handler';
import { ChargeRefundedHandler } from './handlers/charge-refunded.handler';
import { PaymentFailedHandler } from './handlers/payment-failed.handler';

@ApiTags('Payments')
@Controller('payments/stripe')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly completedHandler: CheckoutCompletedHandler,
    private readonly failedHandler: PaymentFailedHandler,
    private readonly chargeRefundedHandler: ChargeRefundedHandler,
    @Inject('STRIPE') private readonly stripe: Stripe,
  ) {
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified, idempotent)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    // Idempotency guard — skip already-processed events
    try {
      await this.prisma.processedWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch {
      // Unique constraint = already processed
      this.logger.log(`Duplicate webhook event ${event.id} — skipping`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.completedHandler.handle(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.expired':
          await this.failedHandler.handleSessionExpired(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.payment_failed':
          await this.failedHandler.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await this.chargeRefundedHandler.handle(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling event ${event.id} (${event.type}): ${String(err)}`);
      throw err;
    }

    return { received: true };
  }
}
