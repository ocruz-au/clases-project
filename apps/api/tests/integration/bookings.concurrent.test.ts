/**
 * T021 — Integration test: concurrent last-seat claim
 *
 * Verifies the row-lock transaction in SeatHoldService guarantees that when two
 * requests race for the last available seat, exactly one succeeds and one gets
 * a 409 CAPACITY_EXCEEDED error.
 */
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeatHoldService } from '../../src/modules/bookings/seat-hold.service';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

describe('Concurrent last-seat claim (T021)', () => {
  let service: SeatHoldService;

  let sessionId: string;
  let userId1: string;
  let userId2: string;

  beforeAll(async () => {
    const prisma = getTestPrisma();

    const configService = {
      get: jest.fn().mockReturnValue(10),
      getOrThrow: jest.fn().mockReturnValue(10),
    } as unknown as ConfigService;

    service = new SeatHoldService(prisma as never, configService);

    await truncateAllTables();

    // Seed the minimum required data
    const role = await prisma.role.create({ data: { key: 'STUDENT', description: 'Student' } });

    const createUser = async (email: string) => {
      const user = await prisma.user.create({
        data: { email, name: email, passwordHash: 'x' },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      return user;
    };

    const [u1, u2] = await Promise.all([
      createUser('concurrent1@test.com'),
      createUser('concurrent2@test.com'),
    ]);
    userId1 = u1.id;
    userId2 = u2.id;

    const location = await prisma.location.create({
      data: { name: 'Test Location', address: '1 Test St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Test Room', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({
      data: { name: 'Test', slug: 'test' },
    });
    const cls = await prisma.class.create({
      data: {
        title: 'Test Class',
        categoryId: category.id,
        priceCents: 1000,
        defaultCapacity: 1,
      },
    });
    const instructor = await prisma.user.create({
      data: { email: 'instructor-concurrent@test.com', name: 'Instructor', passwordHash: 'x' },
    });
    const instructorProfile = await prisma.instructorProfile.create({
      data: { userId: instructor.id },
    });

    const session = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt: new Date(Date.now() + 86400_000),
        endsAt: new Date(Date.now() + 90000_000),
        capacity: 1, // only 1 seat!
        status: 'SCHEDULED',
      },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('exactly one of two concurrent hold requests succeeds', async () => {
    const [result1, result2] = await Promise.allSettled([
      service.createHold(userId1, sessionId, 'CHECKOUT'),
      service.createHold(userId2, sessionId, 'CHECKOUT'),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled');
    const rejected = [result1, result2].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason as Error;
    expect(rejectedReason).toBeInstanceOf(ConflictException);
    expect(rejectedReason.message).toContain('CAPACITY_EXCEEDED');
  });
});
