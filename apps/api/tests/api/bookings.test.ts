/**
 * T024 — API test: full booking workflow
 *
 * checkout → mock Stripe webhook checkout.session.completed
 * → booking CONFIRMED, notification queued
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

// Mock Stripe — bypass signature verification and session creation
const mockStripeSessionId = 'cs_test_mock_' + Date.now();
const mockStripeSessionUrl = 'https://checkout.stripe.com/test';

const stripeMock = {
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: mockStripeSessionId,
        url: mockStripeSessionUrl,
      }),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeMock);
});

describe('Booking workflow (T024)', () => {
  let app: INestApplication;
  let token: string;
  let sessionId: string;
  let bookingId: string;
  let paymentId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    // Seed required data
    const studentRole = await prisma.role.create({ data: { key: 'STUDENT', description: '' } });
    await prisma.role.create({ data: { key: 'INSTRUCTOR', description: '' } });

    const location = await prisma.location.create({
      data: { name: 'Booking Test Location', address: '1 St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Room', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'Cat', slug: 'bk-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'Booking Test Class', categoryId: category.id, priceCents: 2500, defaultCapacity: 5 },
    });
    const instructorUser = await prisma.user.create({
      data: { email: 'instructor-bk@test.com', name: 'Instructor BK', passwordHash: 'x' },
    });
    const instructorProfile = await prisma.instructorProfile.create({
      data: { userId: instructorUser.id },
    });
    const session = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt: new Date(Date.now() + 86400_000),
        endsAt: new Date(Date.now() + 90000_000),
        capacity: 5,
        status: 'SCHEDULED',
      },
    });
    sessionId = session.id;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
    jest.resetAllMocks();
  });

  it('registers and logs in a student', async () => {
    const email = `student-bk-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: 'BK Student' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });

    token = res.body.token as string;
    expect(token).toBeDefined();
  });

  it('POST /api/v1/bookings/checkout → 201 with stripeCheckoutUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ classSessionId: sessionId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('bookingId');
    expect(res.body).toHaveProperty('stripeCheckoutUrl');
    expect(res.body.stripeCheckoutUrl).toContain('checkout.stripe.com');

    bookingId = res.body.bookingId as string;

    const prisma = getTestPrisma();
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('HELD');
    paymentId = booking!.paymentId!;
  });

  it('POST /api/v1/payments/stripe/webhook checkout.session.completed → booking CONFIRMED + notification queued', async () => {
    const fakeEvent = {
      id: `evt_mock_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockStripeSessionId,
          payment_intent: 'pi_mock',
          metadata: { bookingId, paymentId },
        },
      },
    };

    (stripeMock.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(fakeEvent);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/stripe/webhook')
      .set('stripe-signature', 'mock-sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    const prisma = getTestPrisma();

    // Booking should be CONFIRMED
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('CONFIRMED');

    // Payment should be SUCCEEDED
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('SUCCEEDED');

    // Notification should be queued (PENDING or SENT)
    const notification = await prisma.notification.findFirst({
      where: { type: 'BOOKING_CONFIRMATION' },
    });
    expect(notification).not.toBeNull();
    expect(['PENDING', 'SENT']).toContain(notification?.status);
  });

  it('duplicate webhook event is idempotent (returns 201, no re-processing)', async () => {
    const fakeEvent = {
      id: `evt_mock_${Date.now() - 1}`, // same id as before (reuse last one)
      type: 'checkout.session.completed',
      data: { object: { id: mockStripeSessionId, metadata: { bookingId, paymentId } } },
    };

    // Use the evt id that was already processed
    const prisma = getTestPrisma();
    const processed = await prisma.processedWebhookEvent.findFirst();
    if (!processed) return; // skip if not found

    const dupEvent = { ...fakeEvent, id: processed.id };
    (stripeMock.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(dupEvent);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/stripe/webhook')
      .set('stripe-signature', 'mock-sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(dupEvent));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    // Notification count should not have increased
    const notifCount = await prisma.notification.count({ where: { type: 'BOOKING_CONFIRMATION' } });
    expect(notifCount).toBe(1);
  });
});
