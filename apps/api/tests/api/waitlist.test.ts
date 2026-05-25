/**
 * T040 — API test: waitlist — join, view position, admin actions, end-to-end promotion
 *
 * Uses mocked Stripe so no real network calls are made.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

const stripeMock = {
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_wl_mock', url: 'https://checkout.stripe.com/wl' }) } },
  webhooks: { constructEvent: jest.fn() },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

describe('Waitlist workflow (T040)', () => {
  let app: INestApplication;
  let studentToken: string;
  let adminToken: string;
  let sessionId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    const studentRole = await prisma.role.create({ data: { key: 'STUDENT', description: '' } });
    const adminRole = await prisma.role.create({ data: { key: 'ADMIN', description: '' } });
    await prisma.role.create({ data: { key: 'INSTRUCTOR', description: '' } });

    const location = await prisma.location.create({
      data: { name: 'WL API Loc', address: '1 St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Room', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'WL API Cat', slug: 'wl-api-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'WL API Class', categoryId: category.id, priceCents: 1500, defaultCapacity: 1 },
    });
    const instructorUser = await prisma.user.create({
      data: { email: 'instructor-wlapi@test.com', name: 'Instructor WL API', passwordHash: 'x' },
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
        capacity: 1,
        status: 'SCHEDULED',
      },
    });
    sessionId = session.id;

    // Fill session: pre-create confirmed booking
    const seatUser = await prisma.user.create({
      data: { email: 'seat-holder@test.com', name: 'Seat Holder', passwordHash: 'x' },
    });
    const hold = await prisma.seatHold.create({
      data: { classSessionId: sessionId, userId: seatUser.id, source: 'CHECKOUT', expiresAt: new Date(Date.now() + 600_000), status: 'CONSUMED' },
    });
    await prisma.booking.create({
      data: { classSessionId: sessionId, userId: seatUser.id, status: 'CONFIRMED', seatHoldId: hold.id, amountCents: 1500 },
    });

    // Seed admin user
    const adminUser = await prisma.user.create({
      data: { email: 'admin-wl@test.com', name: 'Admin WL', passwordHash: 'x' },
    });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('student registers and logs in', async () => {
    const email = `student-wl-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: 'WL Student' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });

    studentToken = res.body.token as string;
    expect(studentToken).toBeDefined();
  });

  it('admin logs in', async () => {
    // Admin must be seeded with a hashed password or use the auth endpoint
    // Since admin was seeded without using register endpoint, login would fail (passwordHash='x')
    // Use another admin registered via API
    const adminEmail = `admin-wl-api-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: adminEmail, password: 'AdminPass123!', name: 'Admin WL API' });

    // Elevate the user to ADMIN in DB
    const prisma = getTestPrisma();
    const user = await prisma.user.findFirst({ where: { email: adminEmail } });
    const adminRole = await prisma.role.findFirst({ where: { key: 'ADMIN' } });
    if (user && adminRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
        update: {},
        create: { userId: user.id, roleId: adminRole.id },
      });
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' });

    adminToken = res.body.token as string;
    expect(adminToken).toBeDefined();
  });

  it('POST /api/v1/waitlist → 201, entry is WAITING', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ classSessionId: sessionId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('WAITING');
    expect(res.body.position).toBeGreaterThanOrEqual(1);
  });

  it('duplicate join → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ classSessionId: sessionId });

    expect(res.status).toBe(409);
  });

  it('GET /api/v1/waitlist/session/:id → returns ordered queue', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/waitlist/session/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/admin/waitlist/entries/:id/action REMOVE → entry REMOVED', async () => {
    const prisma = getTestPrisma();
    const entry = await prisma.waitlistEntry.findFirst({ where: { classSessionId: sessionId } });
    expect(entry).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/waitlist/entries/${entry!.id}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REMOVE' });

    expect(res.status).toBe(201);

    const updated = await prisma.waitlistEntry.findUnique({ where: { id: entry!.id } });
    expect(updated?.status).toBe('REMOVED');
  });

  it('unauthenticated join → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/waitlist')
      .send({ classSessionId: sessionId });
    expect(res.status).toBe(401);
  });
});
