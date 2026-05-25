/**
 * T039 — Integration test: hold-expiry cascade
 *
 * Student B is OFFERED a hold that expires immediately.
 * The HoldExpiryJob processes it → B's entry becomes EXPIRED,
 * C gets promoted (OFFERED), and a new SeatHold is created for C.
 */
import { ConfigService } from '@nestjs/config';
import { SeatHoldService } from '../../src/modules/bookings/seat-hold.service';
import { WaitlistService } from '../../src/modules/waitlists/waitlist.service';
import { WaitlistPromotionService } from '../../src/modules/waitlists/promotion.service';
import { HoldExpiryJob } from '../../src/jobs/hold-expiry.job';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

describe('Hold-expiry cascade (T039)', () => {
  let seatHoldService: SeatHoldService;
  let waitlistService: WaitlistService;
  let promotionService: WaitlistPromotionService;
  let holdExpiryJob: HoldExpiryJob;

  let sessionId: string;
  let userBId: string;
  let userCId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    const configService = {
      get: jest.fn().mockReturnValue(10),
      getOrThrow: jest.fn().mockReturnValue(10),
    } as unknown as ConfigService;

    const notificationService = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;

    seatHoldService = new SeatHoldService(prisma as never, configService);
    waitlistService = new WaitlistService(prisma as never);
    promotionService = new WaitlistPromotionService(
      prisma as never,
      seatHoldService,
      notificationService,
      configService,
    );
    holdExpiryJob = new HoldExpiryJob(prisma as never, promotionService);

    const role = await prisma.role.create({ data: { key: 'STUDENT', description: 'Student' } });
    const createUser = async (email: string) => {
      const user = await prisma.user.create({
        data: { email, name: email, passwordHash: 'x' },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      return user;
    };

    const [uB, uC] = await Promise.all([
      createUser('expiry-b@test.com'),
      createUser('expiry-c@test.com'),
    ]);
    userBId = uB.id;
    userCId = uC.id;

    const location = await prisma.location.create({
      data: { name: 'Expiry Loc', address: '1 Expiry St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Expiry Room', capacity: 2, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'Exp Cat', slug: 'exp-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'Expiry Class', categoryId: category.id, priceCents: 500, defaultCapacity: 1 },
    });
    const instructor = await prisma.user.create({
      data: { email: 'instructor-exp@test.com', name: 'Instructor Exp', passwordHash: 'x' },
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
        capacity: 1,
        status: 'SCHEDULED',
      },
    });
    sessionId = session.id;

    // Seed waitlist: B at position 1, C at position 2
    await prisma.waitlistEntry.create({
      data: { classSessionId: sessionId, userId: userBId, position: 1, status: 'WAITING' },
    });
    await prisma.waitlistEntry.create({
      data: { classSessionId: sessionId, userId: userCId, position: 2, status: 'WAITING' },
    });

    // Promote B manually (creates expired hold)
    const holdB = await prisma.seatHold.create({
      data: {
        classSessionId: sessionId,
        userId: userBId,
        source: 'WAITLIST_PROMOTION',
        expiresAt: new Date(Date.now() - 1), // already expired
        status: 'ACTIVE',
      },
    });
    await prisma.waitlistEntry.updateMany({
      where: { userId: userBId, classSessionId: sessionId },
      data: { status: 'OFFERED', offeredSeatHoldId: holdB.id },
    });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('HoldExpiryJob detects expired hold for B, expires it, and promotes C', async () => {
    const prisma = getTestPrisma();

    await holdExpiryJob.processExpiredHolds();

    // B's hold should be RELEASED
    const holdB = await prisma.seatHold.findFirst({
      where: { userId: userBId, classSessionId: sessionId, source: 'WAITLIST_PROMOTION' },
    });
    expect(holdB?.status).toBe('RELEASED');

    // B's waitlist entry should be EXPIRED
    const entryB = await prisma.waitlistEntry.findFirst({
      where: { userId: userBId, classSessionId: sessionId },
    });
    expect(entryB?.status).toBe('EXPIRED');

    // C should now be OFFERED
    const entryC = await prisma.waitlistEntry.findFirst({
      where: { userId: userCId, classSessionId: sessionId },
    });
    expect(entryC?.status).toBe('OFFERED');
    expect(entryC?.offeredSeatHoldId).toBeTruthy();
  });
});
