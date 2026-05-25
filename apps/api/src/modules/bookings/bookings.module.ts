import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { CancellationPolicyService } from './cancellation-policy.service';
import { SeatHoldService } from './seat-hold.service';
import { CheckoutService } from '../payments/checkout.service';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [
    SeatHoldService,
    CheckoutService,
    CancellationPolicyService,
    {
      provide: 'STRIPE',
      useFactory: (config: ConfigService) =>
        new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY')),
      inject: [ConfigService],
    },
  ],
  exports: [SeatHoldService, CheckoutService, CancellationPolicyService],
})
export class BookingsModule {}
