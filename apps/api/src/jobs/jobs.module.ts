import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WaitlistModule } from '../modules/waitlists/waitlist.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { HoldExpiryJob } from './hold-expiry.job';
import { ReminderJob } from './reminder.job';

@Module({
  imports: [PrismaModule, WaitlistModule, NotificationsModule],
  providers: [HoldExpiryJob, ReminderJob],
  exports: [HoldExpiryJob, ReminderJob],
})
export class JobsModule {}
