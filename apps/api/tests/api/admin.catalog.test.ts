/**
 * T051 — API test: admin catalog CRUD
 *
 * Tests admin CRUD for categories, locations, rooms, classes, instructors,
 * availability rules; generate-sessions returns correct Perth-tz session times.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

const stripeMock = {
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_cat_mock', url: 'https://checkout.stripe.com' }) } },
  webhooks: { constructEvent: jest.fn() },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

describe('Admin catalog CRUD (T051)', () => {
  let app: INestApplication;
  let adminToken: string;
  let categoryId: string;
  let locationId: string;
  let roomId: string;
  let classId: string;
  let instructorId: string;
  let ruleId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    await prisma.role.create({ data: { key: 'STUDENT', description: '' } });
    await prisma.role.create({ data: { key: 'ADMIN', description: '' } });
    await prisma.role.create({ data: { key: 'INSTRUCTOR', description: '' } });

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

  it('registers admin and logs in', async () => {
    const email = `admin-cat-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'AdminPass123!', name: 'Cat Admin' });

    const prisma = getTestPrisma();
    const user = await prisma.user.findFirst({ where: { email } });
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
      .send({ email, password: 'AdminPass123!' });

    adminToken = res.body.token as string;
    expect(adminToken).toBeDefined();
  });

  it('POST /admin/categories → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Yoga', slug: 'yoga-test', description: 'Yoga classes' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    categoryId = res.body.id as string;
  });

  it('PATCH /admin/categories/:id → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated yoga' });

    expect(res.status).toBe(200);
  });

  it('POST /admin/locations → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Perth Studio', address: '10 King St, Perth', timezone: 'Australia/Perth' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    locationId = res.body.id as string;
  });

  it('POST /admin/rooms → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Studio A', capacity: 20, locationId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    roomId = res.body.id as string;
  });

  it('POST /admin/classes → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Morning Yoga', categoryId, priceCents: 2000, defaultCapacity: 15 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    classId = res.body.id as string;
  });

  it('POST /admin/instructors → 201', async () => {
    const email = `instructor-cat-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'InstructorPass123!', name: 'Cat Instructor' });

    const prisma = getTestPrisma();
    const user = await prisma.user.findFirst({ where: { email } });
    const instrRole = await prisma.role.findFirst({ where: { key: 'INSTRUCTOR' } });
    if (user && instrRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: instrRole.id } },
        update: {},
        create: { userId: user.id, roleId: instrRole.id },
      });
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/instructors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: user!.id, bio: 'Experienced yoga instructor' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    instructorId = res.body.id as string;
  });

  it('POST /admin/availability-rules → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/availability-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId,
        roomId,
        instructorId,
        rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        startTimeLocal: '08:00',
        durationMin: 60,
        activeFrom: '2026-06-01',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    ruleId = res.body.id as string;
  });

  it('POST /admin/availability-rules/:id/generate → 201 with generated sessions', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/availability-rules/${ruleId}/generate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('created');
    expect(typeof res.body.created).toBe('number');
    expect(res.body.created).toBeGreaterThan(0);
  });

  it('generated sessions have startsAtPerth with correct hour (08:00 Perth = UTC)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/classes/sessions')
      .query({ categoryId });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const session of res.body.items as Array<{ startsAtPerth: string }>) {
      const perthHour = new Date(session.startsAtPerth).getUTCHours(); // ISO from Perth zone offset +8
      // startsAtPerth ISO represents the Perth local time; hour should be 8
      expect(session.startsAtPerth).toContain('T08:00');
    }
  });

  it('PATCH /admin/sessions/:id → 200 (edit capacity)', async () => {
    const prisma = getTestPrisma();
    const session = await prisma.classSession.findFirst({ where: { deletedAt: null } });
    expect(session).not.toBeNull();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/sessions/${session!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 25 });

    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(25);
  });

  it('GET /admin/categories → 200 list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('non-admin cannot access admin routes → 403', async () => {
    const email = `student-cat-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'StudentPass123!', name: 'Cat Student' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StudentPass123!' });
    const studentToken = loginRes.body.token as string;

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Sneaky', slug: 'sneaky' });

    expect([403, 401]).toContain(res.status);
  });
});
