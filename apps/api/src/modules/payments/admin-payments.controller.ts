import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import Stripe from 'stripe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const manualRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(255).optional().default('Admin manual refund'),
});

@ApiTags('Admin / Payments')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPaymentsController {
  private readonly logger = new Logger(AdminPaymentsController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('STRIPE') private readonly stripe: Stripe,
  ) {}

  @Get('payments')
  @ApiOperation({ summary: 'List payments with optional status filter' })
  async listPayments(
    @Query('status') status?: string,
    @Query('page') page = '1',
  ) {
    const where = status ? { status: status as 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' } : {};
    const limit = 20;
    const skip = (parseInt(page, 10) - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          refunds: true,
          bookings: {
            include: { session: { include: { class: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total, page: parseInt(page, 10) };
  }

  @Post('refunds')
  @ApiOperation({ summary: 'Issue a manual refund via Stripe' })
  async issueRefund(
    @Body(new ZodValidationPipe(manualRefundSchema)) body: z.infer<typeof manualRefundSchema>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: body.paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe payment intent — cannot refund');
    }
    if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
      throw new BadRequestException(`Payment status is ${payment.status} — cannot refund`);
    }

    // Issue Stripe refund
    let stripeRefundId: string | undefined;
    try {
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: body.amountCents,
          metadata: { reason: body.reason, actorId: actor.id },
        },
        { idempotencyKey: `admin-refund-${body.paymentId}-${body.amountCents}` },
      );
      stripeRefundId = stripeRefund.id;
    } catch (err) {
      this.logger.error(`Stripe refund failed for payment ${body.paymentId}: ${String(err)}`);
      throw err;
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          paymentId: body.paymentId,
          amountCents: body.amountCents,
          reason: body.reason ?? 'Admin manual refund',
          stripeRefundId: stripeRefundId ?? null,
          status: 'PENDING',
        },
      });

      const newStatus =
        body.amountCents >= payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({
        where: { id: body.paymentId },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_MANUAL_REFUND',
          resourceType: 'Payment',
          resourceId: body.paymentId,
          afterState: { refundId: created.id, amountCents: body.amountCents, reason: body.reason },
        },
      });

      return created;
    });

    return refund;
  }
}
