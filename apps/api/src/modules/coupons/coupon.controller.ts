import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CouponService } from './coupon.service';

const createCouponSchema = z.object({
  code: z.string().min(1).max(50).transform((s) => s.toUpperCase()),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
});

const updateCouponSchema = createCouponSchema.partial();

@ApiTags('Admin / Coupons')
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Get()
  @ApiOperation({ summary: 'List all coupons' })
  list() {
    return this.coupons.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon by id' })
  findOne(@Param('id') id: string) {
    return this.coupons.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create coupon' })
  create(@Body(new ZodValidationPipe(createCouponSchema)) body: z.infer<typeof createCouponSchema>) {
    return this.coupons.create({
      ...body,
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: z.infer<typeof updateCouponSchema>,
  ) {
    return this.coupons.update(id, {
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate coupon (soft-delete)' })
  remove(@Param('id') id: string) {
    return this.coupons.softDelete(id);
  }
}
