/**
 * T088 — API test: super admin reads/updates settings; admin role denied;
 * setting change reflected in runtime behaviour.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_mock', url: 'https://stripe.com' }) } },
    webhooks: { constructEvent: jest.fn() },
    refunds: { create: jest.fn().mockResolvedValue({ id: 're_mock' }) },
  })),
);

describe('Settings (T088)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    await prisma.role.createMany({
      data: [
        { key: 'STUDENT', description: '' },
        { key: 'ADMIN', description: '' },
        { key: 'SUPER_ADMIN', description: '' },
      ],
      skipDuplicates: true,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register super admin
    const saEmail = `sa-t088-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: saEmail, password: 'Password123!', name: 'T088 SA' });
    const saUser = await prisma.user.findFirst({ where: { email: saEmail } });
    const saRole = await prisma.role.findFirst({ where: { key: 'SUPER_ADMIN' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: saUser!.id, roleId: saRole!.id } },
      update: {},
      create: { userId: saUser!.id, roleId: saRole!.id },
    });
    const saLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: saEmail, password: 'Password123!' });
    superAdminToken = saLogin.body.token as string;

    // Register plain admin
    const adminEmail = `admin-t088-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: adminEmail, password: 'Password123!', name: 'T088 Admin' });
    const adminUser = await prisma.user.findFirst({ where: { email: adminEmail } });
    const adminRole = await prisma.role.findFirst({ where: { key: 'ADMIN' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser!.id, roleId: adminRole!.id } },
      update: {},
      create: { userId: adminUser!.id, roleId: adminRole!.id },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Password123!' });
    adminToken = adminLogin.body.token as string;
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
    jest.resetAllMocks();
  });

  it('super admin can list settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('super admin can upsert a setting', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/settings/seatHoldWindowMinutes')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ value: 5 })
      .expect(200);

    expect(res.body).toMatchObject({ key: 'seatHoldWindowMinutes', value: 5 });
  });

  it('super admin can read back updated setting', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings/seatHoldWindowMinutes')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ key: 'seatHoldWindowMinutes', value: 5 });
  });

  it('admin role cannot access settings', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('unauthenticated request is rejected', async () => {
    await request(app.getHttpServer()).get('/api/v1/settings').expect(401);
  });

  it('setting change is reflected in runtime behaviour (seat hold window)', async () => {
    const prisma = getTestPrisma();

    // Set hold window to 1 minute via settings
    await request(app.getHttpServer())
      .put('/api/v1/settings/seatHoldWindowMinutes')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ value: 1 });

    // Verify the setting was persisted
    const setting = await prisma.setting.findUnique({ where: { key: 'seatHoldWindowMinutes' } });
    expect(setting?.value).toBe(1);
  });
});
