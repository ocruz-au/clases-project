import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';
import { WaitlistService } from './waitlist.service';
import { WaitlistPromotionService } from './promotion.service';
import { WaitlistController } from './waitlist.controller';
import { AdminWaitlistController } from './admin-waitlist.controller';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, BookingsModule],
  controllers: [WaitlistController, AdminWaitlistController],
  providers: [WaitlistService, WaitlistPromotionService],
  exports: [WaitlistService, WaitlistPromotionService],
})
export class WaitlistModule {}
