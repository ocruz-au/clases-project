/**
 * T023 — API test: auth flow
 *
 * register → login → JWT issued → protected route accessible
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { truncateAllTables, disconnectTestPrisma } from '../helpers/db';

describe('Auth flow (T023)', () => {
  let app: INestApplication;
  const email = `auth-test-${Date.now()}@example.com`;
  const password = 'Password123!Test';
  const name = 'Auth Test User';

  beforeAll(async () => {
    await truncateAllTables();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
  });

  it('POST /api/v1/auth/register → 201 with token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, name });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.roles).toContain('STUDENT');
  });

  it('POST /api/v1/auth/register duplicate email → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, name });

    expect(res.status).toBe(409);
  });

  it('POST /api/v1/auth/login → 200 with token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/v1/auth/login wrong password → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('JWT token grants access to protected route', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    const token: string = loginRes.body.token as string;

    const profileRes = await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`);

    expect(profileRes.status).toBe(200);
  });

  it('protected route without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/bookings');
    expect(res.status).toBe(401);
  });
});
