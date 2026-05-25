import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminSessionController } from './admin-session.controller';
import { AvailabilityRuleController } from './availability-rule.controller';
import { AvailabilityRuleService } from './availability-rule.service';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SessionController, AdminSessionController, AvailabilityRuleController],
  providers: [SessionService, ScheduleGeneratorService, AvailabilityRuleService],
  exports: [SessionService, ScheduleGeneratorService, AvailabilityRuleService],
})
export class SchedulesModule {}
