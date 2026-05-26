import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { apiEnvSchema } from '@app/shared';
import { AuditLogModule } from './modules/audit-logs/audit-log.module';
import { AuditLogInterceptor } from './modules/audit-logs/audit-log.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ClassesModule } from './modules/classes/classes.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './modules/roles/roles.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { WaitlistModule } from './modules/waitlists/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => apiEnvSchema.parse(config),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    RolesModule,
    UsersModule,
    ClassesModule,
    CouponsModule,
    SchedulesModule,
    SettingsModule,
    InstructorsModule,
    NotificationsModule,
    BookingsModule,
    WaitlistModule,
    PaymentsModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // Request-scoped middleware (e.g., logger) added here
  }
}
