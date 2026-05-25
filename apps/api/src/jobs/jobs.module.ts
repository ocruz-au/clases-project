import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WaitlistModule } from '../modules/waitlists/waitlist.module';
import { HoldExpiryJob } from './hold-expiry.job';

@Module({
  imports: [PrismaModule, WaitlistModule],
  providers: [HoldExpiryJob],
  exports: [HoldExpiryJob],
})
export class JobsModule {}
