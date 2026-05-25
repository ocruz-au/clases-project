/**
 * T076 — Unit test: CouponService coupon validation
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { PrismaService } from '../../prisma/prisma.service';

const makeBaseCoupon = (overrides = {}) => ({
  id: 'coupon-1',
  code: 'SAVE10',
  type: 'PERCENT',
  value: 10,
  validFrom: new Date(Date.now() - 86400_000), // yesterday
  validUntil: new Date(Date.now() + 86400_000), // tomorrow
  maxRedemptions: null,
  redeemedCount: 0,
  deletedAt: null,
  ...overrides,
});

const makePrisma = (coupon: unknown) => ({
  coupon: {
    findFirst: jest.fn().mockResolvedValue(coupon),
    update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
      ...(coupon as object),
      ...(data as object),
    })),
  },
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      coupon: {
        findFirst: jest.fn().mockResolvedValue(coupon),
        update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
          ...(coupon as object),
          ...(data as object),
        })),
      },
    }),
  ),
});

describe('CouponService.validateAndApply', () => {
  it('returns correct PERCENT discount', async () => {
    const coupon = makeBaseCoupon({ type: 'PERCENT', value: 10 });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    const result = await service.validateAndApply('SAVE10', 'user-1', 2000);
    expect(result.discountCents).toBe(200); // 10% of 2000
    expect(result.couponId).toBe('coupon-1');
  });

  it('returns correct FIXED discount', async () => {
    const coupon = makeBaseCoupon({ type: 'FIXED', value: 500 });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    const result = await service.validateAndApply('SAVE10', 'user-1', 2000);
    expect(result.discountCents).toBe(500);
  });

  it('FIXED discount does not exceed price', async () => {
    const coupon = makeBaseCoupon({ type: 'FIXED', value: 5000 });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    const result = await service.validateAndApply('SAVE10', 'user-1', 2000);
    expect(result.discountCents).toBe(2000); // capped at full price
  });

  it('rejects expired coupon', async () => {
    const coupon = makeBaseCoupon({ validUntil: new Date(Date.now() - 3600_000) });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    await expect(service.validateAndApply('SAVE10', 'user-1', 2000)).rejects.toThrow(BadRequestException);
  });

  it('rejects coupon not yet valid', async () => {
    const coupon = makeBaseCoupon({ validFrom: new Date(Date.now() + 3600_000) });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    await expect(service.validateAndApply('SAVE10', 'user-1', 2000)).rejects.toThrow(BadRequestException);
  });

  it('rejects when usage limit reached', async () => {
    const coupon = makeBaseCoupon({ maxRedemptions: 5, redeemedCount: 5 });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    await expect(service.validateAndApply('SAVE10', 'user-1', 2000)).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid / unknown coupon code', async () => {
    const prisma = makePrisma(null);
    const service = new CouponService(prisma as unknown as PrismaService);

    await expect(service.validateAndApply('BADCODE', 'user-1', 2000)).rejects.toThrow(NotFoundException);
  });

  it('allows redemption when maxRedemptions is null (unlimited)', async () => {
    const coupon = makeBaseCoupon({ maxRedemptions: null, redeemedCount: 999 });
    const prisma = makePrisma(coupon);
    const service = new CouponService(prisma as unknown as PrismaService);

    const result = await service.validateAndApply('SAVE10', 'user-1', 2000);
    expect(result.discountCents).toBe(200);
  });
});
