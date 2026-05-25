/**
 * T069 — API test: instructor attendance workflow
 * - Instructor views their assigned sessions
 * - Views attendee list for their session
 * - Records ATTENDED / NO_SHOW
 * - Denied access to unassigned session
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

const stripeMock = {
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_instr_mock', url: 'https://stripe.com' }) } },
  webhooks: { constructEvent: jest.fn() },
  refunds: { create: jest.fn() },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

describe('Instructor attendance workflow (T069)', () => {
  let app: INestApplication;
  let instructorToken: string;
  let otherInstructorToken: string;
  let sessionId: string;
  let bookingId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    await prisma.role.createMany({
      data: [
        { key: 'STUDENT', description: '' },
        { key: 'INSTRUCTOR', description: '' },
        { key: 'ADMIN', description: '' },
      ],
      skipDuplicates: true,
    });

    const location = await prisma.location.create({
      data: { name: 'Instr Test Loc', address: '1 St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Instr Room', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'Instr Cat', slug: 'instr-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'Instr Test Class', categoryId: category.id, priceCents: 1500, defaultCapacity: 10 },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register instructor
    const instrEmail = `instructor-t069-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: instrEmail, password: 'Password123!', name: 'Test Instructor' });

    // Elevate to INSTRUCTOR
    const instrRole = await prisma.role.findFirst({ where: { key: 'INSTRUCTOR' } });
    const instrUser = await prisma.user.findFirst({ where: { email: instrEmail } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: instrUser!.id, roleId: instrRole!.id } },
      update: {},
      create: { userId: instrUser!.id, roleId: instrRole!.id },
    });

    const instrLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: instrEmail, password: 'Password123!' });
    instructorToken = instrLoginRes.body.token as string;

    // Create instructor profile for this user
    const instrProfile = await prisma.instructorProfile.create({ data: { userId: instrUser!.id } });

    // Create session assigned to this instructor
    const session = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instrProfile.id,
        startsAt: new Date(Date.now() - 3600_000), // 1h ago (past session)
        endsAt: new Date(Date.now() - 1800_000),
        capacity: 10,
        status: 'SCHEDULED',
      },
    });
    sessionId = session.id;

    // Seed a confirmed booking for a student
    const studentUser = await prisma.user.create({
      data: { email: `student-instr-${Date.now()}@test.com`, name: 'Instr Student', passwordHash: 'x' },
    });
    const booking = await prisma.booking.create({
      data: {
        classSessionId: sessionId,
        userId: studentUser.id,
        status: 'CONFIRMED',
        amountCents: 1500,
      },
    });
    bookingId = booking.id;

    // Register other instructor (no sessions)
    const otherEmail = `other-instr-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: 'Password123!', name: 'Other Instructor' });

    const otherUser = await prisma.user.findFirst({ where: { email: otherEmail } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: otherUser!.id, roleId: instrRole!.id } },
      update: {},
      create: { userId: otherUser!.id, roleId: instrRole!.id },
    });
    await prisma.instructorProfile.create({ data: { userId: otherUser!.id } });

    const otherLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password: 'Password123!' });
    otherInstructorToken = otherLoginRes.body.token as string;
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
    jest.resetAllMocks();
  });

  it('GET /api/v1/instructor/sessions → returns assigned sessions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/instructor/sessions')
      .set('Authorization', `Bearer ${instructorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id', sessionId);
  });

  it('GET /api/v1/instructor/sessions/:id/attendees → returns attendee list', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/instructor/sessions/${sessionId}/attendees`)
      .set('Authorization', `Bearer ${instructorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id', bookingId);
    expect(res.body[0]).toHaveProperty('status', 'CONFIRMED');
    expect(res.body[0]).toHaveProperty('user');
  });

  it('POST /api/v1/instructor/sessions/:id/attendance → marks ATTENDED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/instructor/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ bookingId, status: 'ATTENDED' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('status', 'ATTENDED');
    expect(res.body).toHaveProperty('checkedInAt');
  });

  it('POST /api/v1/instructor/sessions/:id/attendance → marks NO_SHOW', async () => {
    // Create another confirmed booking
    const prisma = getTestPrisma();
    const anotherStudent = await prisma.user.create({
      data: { email: `no-show-student-${Date.now()}@test.com`, name: 'No Show Student', passwordHash: 'x' },
    });
    const anotherBooking = await prisma.booking.create({
      data: {
        classSessionId: sessionId,
        userId: anotherStudent.id,
        status: 'CONFIRMED',
        amountCents: 1500,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/instructor/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ bookingId: anotherBooking.id, status: 'NO_SHOW' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('status', 'NO_SHOW');
  });

  it('other instructor denied access to unassigned session → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/instructor/sessions/${sessionId}/attendees`)
      .set('Authorization', `Bearer ${otherInstructorToken}`);

    expect(res.status).toBe(403);
  });

  it('non-instructor denied access → 403', async () => {
    // Register a plain student
    const email = `plain-student-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: 'Plain Student' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });
    const studentToken = loginRes.body.token as string;

    const res = await request(app.getHttpServer())
      .get('/api/v1/instructor/sessions')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/instructor/sessions');
    expect(res.status).toBe(401);
  });
});
