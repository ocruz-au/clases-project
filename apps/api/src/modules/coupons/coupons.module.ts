import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponsModule {}
