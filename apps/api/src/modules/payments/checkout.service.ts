import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { SeatHoldService } from '../bookings/seat-hold.service';
import { CouponService } from '../coupons/coupon.service';

export interface CheckoutResult {
  bookingId: string;
  seatHoldId: string;
  holdExpiresAt: string;
  stripeCheckoutUrl: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seatHoldService: SeatHoldService,
    private readonly config: ConfigService,
    @Inject('STRIPE') private readonly stripe: Stripe,
    @Optional() private readonly couponService: CouponService | null,
  ) {}

  async createCheckout(userId: string, sessionId: string, couponCode?: string): Promise<CheckoutResult> {
    // Load session with class details
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      include: { class: true, room: { include: { location: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Check for existing active booking (duplicate prevention)
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        classSessionId: sessionId,
        userId,
        status: { in: ['HELD', 'CONFIRMED'] },
        deletedAt: null,
      },
    });
    if (existingBooking) throw new ConflictException('You already have an active booking for this session');

    // Create seat hold (row-locked, throws CAPACITY_EXCEEDED if full)
    const hold = await this.seatHoldService.createHold(userId, sessionId, 'CHECKOUT');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const baseAmountCents = session.class.priceCents;

    // Apply coupon if provided
    let amountCents = baseAmountCents;
    let couponId: string | undefined;
    let discountCents = 0;

    if (couponCode && this.couponService) {
      const couponResult = await this.couponService.validateAndApply(couponCode, userId, baseAmountCents);
      amountCents = couponResult.finalAmountCents;
      couponId = couponResult.couponId;
      discountCents = couponResult.discountCents;
    }

    // Create booking record (HELD)
    const booking = await this.prisma.booking.create({
      data: {
        classSessionId: sessionId,
        userId,
        status: 'HELD',
        seatHoldId: hold.id,
        amountCents,
        couponId: couponId ?? null,
      },
    });

    // Create payment record (PENDING)
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amountCents,
        currency: session.class.currency,
        status: 'PENDING',
      },
    });

    // Link payment to booking
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { paymentId: payment.id },
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    // Build Stripe line items with optional discount
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: session.class.currency.toLowerCase(),
          product_data: {
            name: session.class.title,
            description: `${session.room.location.name} — ${new Date(session.startsAt).toISOString()}`,
          },
          unit_amount: baseAmountCents,
        },
        quantity: 1,
      },
    ];

    if (discountCents > 0) {
      lineItems.push({
        price_data: {
          currency: session.class.currency.toLowerCase(),
          product_data: { name: `Coupon discount (${couponCode ?? ''})` },
          unit_amount: -discountCents,
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const stripeSession = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: lineItems,
      success_url: `${appUrl}/bookings/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/bookings/checkout/cancel`,
      expires_at: Math.floor(hold.expiresAt.getTime() / 1000),
      metadata: { bookingId: booking.id, paymentId: payment.id },
    });

    // Store Stripe session id on payment
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: stripeSession.id },
    });

    return {
      bookingId: booking.id,
      seatHoldId: hold.id,
      holdExpiresAt: hold.expiresAt.toISOString(),
      stripeCheckoutUrl: stripeSession.url!,
    };
  }
}
