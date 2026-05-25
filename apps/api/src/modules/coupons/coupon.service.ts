import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CouponApplyResult {
  couponId: string;
  discountCents: number;
  finalAmountCents: number;
}

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.coupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, deletedAt: null } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(data: {
    code: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    validFrom: Date;
    validUntil: Date;
    maxRedemptions?: number | null;
  }) {
    return this.prisma.coupon.create({ data });
  }

  async update(id: string, data: {
    code?: string;
    type?: 'PERCENT' | 'FIXED';
    value?: number;
    validFrom?: Date;
    validUntil?: Date;
    maxRedemptions?: number | null;
  }) {
    await this.findById(id);
    return this.prisma.coupon.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.coupon.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Validates a coupon code and atomically increments redeemedCount.
   * Returns the discount to apply and the couponId.
   */
  async validateAndApply(
    code: string,
    userId: string,
    priceCents: number,
  ): Promise<CouponApplyResult> {
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findFirst({
        where: { code: code.trim().toUpperCase(), deletedAt: null },
      });
      if (!coupon) throw new NotFoundException(`Coupon code "${code}" not found`);

      const now = new Date();
      if (coupon.validFrom > now) {
        throw new BadRequestException('Coupon is not yet valid');
      }
      if (coupon.validUntil < now) {
        throw new BadRequestException('Coupon has expired');
      }
      if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
        throw new BadRequestException('Coupon has reached its usage limit');
      }

      // Atomically increment redeemedCount
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redeemedCount: { increment: 1 } },
      });

      const discountCents =
        coupon.type === 'PERCENT'
          ? Math.round((priceCents * coupon.value) / 100)
          : Math.min(coupon.value, priceCents);

      return {
        couponId: coupon.id,
        discountCents,
        finalAmountCents: Math.max(0, priceCents - discountCents),
      };
    });
  }
}
