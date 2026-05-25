import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WaitlistModule } from '../waitlists/waitlist.module';
import { CheckoutCompletedHandler } from './handlers/checkout-completed.handler';
import { PaymentFailedHandler } from './handlers/payment-failed.handler';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, WaitlistModule],
  controllers: [WebhookController],
  providers: [
    CheckoutCompletedHandler,
    PaymentFailedHandler,
    {
      provide: 'STRIPE',
      useFactory: (config: ConfigService) =>
        new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY')),
      inject: [ConfigService],
    },
  ],
})
export class PaymentsModule {}
