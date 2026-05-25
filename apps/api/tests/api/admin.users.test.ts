/**
 * T075 — API test: admin user CRUD + role change; coupon CRUD + apply at checkout; manual refund
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

const stripeRefundMock = jest.fn().mockResolvedValue({ id: 're_admin_test' });
const stripeMock = {
  checkout: {
    sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_admin_mock', url: 'https://stripe.com/admin' }) },
  },
  webhooks: { constructEvent: jest.fn() },
  refunds: { create: stripeRefundMock },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

describe('Admin users, coupons & payments (T075)', () => {
  let app: INestApplication;
  let adminToken: string;
  let targetUserId: string;
  let couponId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    await prisma.role.createMany({
      data: [
        { key: 'STUDENT', description: '' },
        { key: 'ADMIN', description: '' },
        { key: 'INSTRUCTOR', description: '' },
        { key: 'SUPER_ADMIN', description: '' },
      ],
      skipDuplicates: true,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register admin
    const adminEmail = `admin-t075-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: adminEmail, password: 'Password123!', name: 'T075 Admin' });

    const adminUser = await prisma.user.findFirst({ where: { email: adminEmail } });
    const adminRole = await prisma.role.findFirst({ where: { key: 'ADMIN' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser!.id, roleId: adminRole!.id } },
      update: {},
      create: { userId: adminUser!.id, roleId: adminRole!.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Password123!' });
    adminToken = loginRes.body.token as string;

    // Register a target user for CRUD tests
    const targetEmail = `target-t075-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: targetEmail, password: 'Password123!', name: 'Target User' });
    const targetUser = await prisma.user.findFirst({ where: { email: targetEmail } });
    targetUserId = targetUser!.id;
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
    jest.resetAllMocks();
  });

  // ── User management ──────────────────────────────────────────────────────

  it('GET /api/v1/admin/users → returns user list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('GET /api/v1/admin/users/:id → returns single user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', targetUserId);
  });

  it('POST /api/v1/admin/users/:id/roles → assigns INSTRUCTOR role', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleKey: 'INSTRUCTOR' });

    expect(res.status).toBe(201);
  });

  it('PATCH /api/v1/admin/users/:id → updates user status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DISABLED' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'DISABLED');
  });

  it('DELETE /api/v1/admin/users/:id → soft-deletes user', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const prisma = getTestPrisma();
    const deleted = await prisma.user.findFirst({ where: { id: targetUserId } });
    expect(deleted?.deletedAt).not.toBeNull();
  });

  // ── Non-admin denied ──────────────────────────────────────────────────────

  it('non-admin user gets 403', async () => {
    const email = `plain-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: 'Plain' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });
    const plainToken = loginRes.body.token as string;

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${plainToken}`);
    expect(res.status).toBe(403);
  });

  // ── Coupon CRUD ──────────────────────────────────────────────────────────

  it('POST /api/v1/admin/coupons → creates coupon', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `TESTCODE${Date.now()}`,
        type: 'PERCENT',
        value: 20,
        validFrom: new Date(Date.now() - 86400_000).toISOString(),
        validUntil: new Date(Date.now() + 86400_000).toISOString(),
        maxRedemptions: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    couponId = res.body.id as string;
  });

  it('GET /api/v1/admin/coupons → lists coupons', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /api/v1/admin/coupons/:id → updates coupon value', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/coupons/${couponId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 25 });

    expect(res.status).toBe(200);
    expect(res.body.value).toBe(25);
  });

  it('DELETE /api/v1/admin/coupons/:id → soft-deletes coupon', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/coupons/${couponId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  // ── Payments list ─────────────────────────────────────────────────────────

  it('GET /api/v1/admin/payments → returns payments list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/payments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('payments');
  });

  // ── Manual refund ─────────────────────────────────────────────────────────

  it('POST /api/v1/admin/refunds → issues manual refund', async () => {
    stripeRefundMock.mockClear();
    const prisma = getTestPrisma();

    const adminUser = await prisma.user.findFirst({ where: { email: { contains: 'admin-t075' } } });
    const payment = await prisma.payment.create({
      data: {
        userId: adminUser!.id,
        amountCents: 5000,
        currency: 'AUD',
        status: 'SUCCEEDED',
        stripePaymentIntentId: 'pi_admin_refund_test',
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentId: payment.id, amountCents: 2500, reason: 'Goodwill refund' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('amountCents', 2500);
    expect(stripeRefundMock).toHaveBeenCalledTimes(1);
  });
});
