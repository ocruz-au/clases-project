/**
 * T062 — API test: student cancels booking
 * - Cancel within refund window → CANCELLED, Stripe refund called, email queued
 * - Cancel outside window → CANCELLED, no refund
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

const stripeRefundMock = jest.fn().mockResolvedValue({ id: 're_cancel_test' });
const stripeMock = {
  checkout: {
    sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_cancel_mock', url: 'https://stripe.com/cancel' }) },
  },
  webhooks: { constructEvent: jest.fn() },
  refunds: { create: stripeRefundMock },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

describe('Student cancellation workflow (T062)', () => {
  let app: INestApplication;
  let studentToken: string;
  let bookingWithinWindowId: string;
  let bookingOutsideWindowId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    await prisma.role.createMany({
      data: [
        { key: 'STUDENT', description: '' },
        { key: 'ADMIN', description: '' },
        { key: 'INSTRUCTOR', description: '' },
      ],
      skipDuplicates: true,
    });

    // Policy: 100% refund if > 24h before, 0% otherwise
    const policy = await prisma.cancellationPolicy.create({
      data: {
        name: 'T062 Test Policy',
        rules: [
          { hoursBefore: 24, refundPercent: 100 },
          { hoursBefore: 0, refundPercent: 0 },
        ],
        isDefault: true,
      },
    });

    const location = await prisma.location.create({
      data: { name: 'Cancel Test Loc', address: '1 St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Room Cancel', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'Cancel Cat', slug: 'cancel-cat' } });
    const cls = await prisma.class.create({
      data: {
        title: 'Cancellation Test Class',
        categoryId: category.id,
        priceCents: 2000,
        defaultCapacity: 10,
        cancellationPolicyId: policy.id,
      },
    });
    const instructorUser = await prisma.user.create({
      data: { email: 'instr-cancel@test.com', name: 'Instr Cancel', passwordHash: 'x' },
    });
    const instructorProfile = await prisma.instructorProfile.create({
      data: { userId: instructorUser.id },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register + login student
    const email = `student-cancel-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: 'Cancel Student' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });
    studentToken = loginRes.body.token as string;

    const student = await prisma.user.findFirst({ where: { email } });

    const payment1 = await prisma.payment.create({
      data: {
        userId: student!.id,
        amountCents: 2000,
        currency: 'AUD',
        status: 'SUCCEEDED',
        stripePaymentIntentId: 'pi_cancel_within_test',
      },
    });
    const payment2 = await prisma.payment.create({
      data: {
        userId: student!.id,
        amountCents: 2000,
        currency: 'AUD',
        status: 'SUCCEEDED',
        stripePaymentIntentId: 'pi_cancel_outside_test',
      },
    });

    // Within window: session starts in 48h + 1min (> 24h before)
    const sessionWithin = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt: new Date(Date.now() + 48 * 3600_000 + 60_000),
        endsAt: new Date(Date.now() + 49 * 3600_000),
        capacity: 10,
        status: 'SCHEDULED',
        cancellationPolicyId: policy.id,
      },
    });
    const bookingWithin = await prisma.booking.create({
      data: {
        classSessionId: sessionWithin.id,
        userId: student!.id,
        status: 'CONFIRMED',
        amountCents: 2000,
        paymentId: payment1.id,
      },
    });
    bookingWithinWindowId = bookingWithin.id;

    // Outside window: session starts in 12h (< 24h before)
    const sessionOutside = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt: new Date(Date.now() + 12 * 3600_000),
        endsAt: new Date(Date.now() + 13 * 3600_000),
        capacity: 10,
        status: 'SCHEDULED',
        cancellationPolicyId: policy.id,
      },
    });
    const bookingOutside = await prisma.booking.create({
      data: {
        classSessionId: sessionOutside.id,
        userId: student!.id,
        status: 'CONFIRMED',
        amountCents: 2000,
        paymentId: payment2.id,
      },
    });
    bookingOutsideWindowId = bookingOutside.id;
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
    jest.resetAllMocks();
  });

  it('cancels within refund window → CANCELLED and Stripe refund called', async () => {
    stripeRefundMock.mockClear();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingWithinWindowId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CANCELLED');

    const prisma = getTestPrisma();
    const refund = await prisma.refund.findFirst({
      where: { payment: { stripePaymentIntentId: 'pi_cancel_within_test' } },
    });
    expect(refund).not.toBeNull();
    expect(refund!.amountCents).toBe(2000); // 100% refund

    expect(stripeRefundMock).toHaveBeenCalledTimes(1);
    expect(stripeRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_cancel_within_test' }),
      expect.objectContaining({ idempotencyKey: `cancel-${bookingWithinWindowId}` }),
    );
  });

  it('cancels outside refund window → CANCELLED and no Stripe refund', async () => {
    stripeRefundMock.mockClear();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingOutsideWindowId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CANCELLED');

    // No Stripe refund
    expect(stripeRefundMock).not.toHaveBeenCalled();

    // No Refund row created (0% refund)
    const prisma = getTestPrisma();
    const refund = await prisma.refund.findFirst({
      where: { payment: { stripePaymentIntentId: 'pi_cancel_outside_test' } },
    });
    expect(refund).toBeNull();
  });

  it('cannot cancel another user\'s booking → 403', async () => {
    const prisma = getTestPrisma();
    const anotherUser = await prisma.user.create({
      data: { email: `other-cancel-${Date.now()}@test.com`, name: 'Other', passwordHash: 'x' },
    });
    const cls = await prisma.class.findFirst({ where: { title: 'Cancellation Test Class' } });
    const room = await prisma.room.findFirst({ where: { name: 'Room Cancel' } });
    const instr = await prisma.instructorProfile.findFirst({
      where: { user: { email: 'instr-cancel@test.com' } },
    });
    const session = await prisma.classSession.create({
      data: {
        classId: cls!.id,
        roomId: room!.id,
        instructorId: instr!.id,
        startsAt: new Date(Date.now() + 72 * 3600_000),
        endsAt: new Date(Date.now() + 73 * 3600_000),
        capacity: 10,
        status: 'SCHEDULED',
      },
    });
    const otherBooking = await prisma.booking.create({
      data: {
        classSessionId: session.id,
        userId: anotherUser.id,
        status: 'CONFIRMED',
        amountCents: 2000,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${otherBooking.id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated cancel → 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingWithinWindowId}/cancel`);
    expect(res.status).toBe(401);
  });
});
