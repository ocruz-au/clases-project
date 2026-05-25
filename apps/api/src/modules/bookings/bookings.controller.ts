import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { CheckoutService } from '../payments/checkout.service';
import { PrismaService } from '../../prisma/prisma.service';

const checkoutSchema = z.object({
  classSessionId: z.string().uuid(),
  couponCode: z.string().optional(),
});

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Begin checkout — creates a seat hold and Stripe Checkout Session' })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.checkoutService.createCheckout(user.id, body.classSessionId, body.couponCode);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's bookings" })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.booking.findMany({
      where: { userId: user.id, deletedAt: null },
      include: {
        session: {
          include: {
            class: true,
            room: { include: { location: true } },
            instructor: { include: { user: true } },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by id' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.prisma.booking.findFirstOrThrow({
      where: { id, userId: user.id, deletedAt: null },
      include: {
        session: { include: { class: true, room: { include: { location: true } } } },
        payment: true,
      },
    });
  }
}
