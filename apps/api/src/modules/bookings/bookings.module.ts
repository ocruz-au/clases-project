import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WaitlistModule } from '../waitlists/waitlist.module';
import { CouponsModule } from '../coupons/coupons.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingsController } from './bookings.controller';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CancellationService } from './cancellation.service';
import { SeatHoldService } from './seat-hold.service';
import { CheckoutService } from '../payments/checkout.service';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, forwardRef(() => WaitlistModule), CouponsModule, SettingsModule],
  controllers: [BookingsController],
  providers: [
    SeatHoldService,
    CheckoutService,
    CancellationPolicyService,
    CancellationService,
    {
      provide: 'STRIPE',
      useFactory: (config: ConfigService) =>
        new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY')),
      inject: [ConfigService],
    },
  ],
  exports: [SeatHoldService, CheckoutService, CancellationPolicyService, CancellationService],
})
export class BookingsModule {}
