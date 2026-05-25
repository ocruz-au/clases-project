/**
 * T038 — Integration test: FIFO waitlist promotion
 *
 * Fill a session to capacity (1 seat). Student A holds the seat and confirms.
 * Students B and C join the waitlist. Cancel student A's booking.
 * Verify: student B is promoted (OFFERED, SeatHold created), C remains WAITING.
 */
import { ConfigService } from '@nestjs/config';
import { SeatHoldService } from '../../src/modules/bookings/seat-hold.service';
import { WaitlistService } from '../../src/modules/waitlists/waitlist.service';
import { WaitlistPromotionService } from '../../src/modules/waitlists/promotion.service';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

describe('FIFO waitlist promotion (T038)', () => {
  let seatHoldService: SeatHoldService;
  let waitlistService: WaitlistService;
  let promotionService: WaitlistPromotionService;

  let sessionId: string;
  let userAId: string;
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

    const role = await prisma.role.create({ data: { key: 'STUDENT', description: 'Student' } });

    const createUser = async (email: string) => {
      const user = await prisma.user.create({
        data: { email, name: email, passwordHash: 'x' },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      return user;
    };

    const [uA, uB, uC] = await Promise.all([
      createUser('waitlist-a@test.com'),
      createUser('waitlist-b@test.com'),
      createUser('waitlist-c@test.com'),
    ]);
    userAId = uA.id;
    userBId = uB.id;
    userCId = uC.id;

    const location = await prisma.location.create({
      data: { name: 'WL Location', address: '1 WL St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'WL Room', capacity: 5, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'WL Cat', slug: 'wl-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'WL Class', categoryId: category.id, priceCents: 1000, defaultCapacity: 1 },
    });
    const instructor = await prisma.user.create({
      data: { email: 'instructor-wl@test.com', name: 'Instructor WL', passwordHash: 'x' },
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

    // Student A takes the only seat (confirmed booking)
    const holdA = await seatHoldService.createHold(userAId, sessionId, 'CHECKOUT');
    await prisma.booking.create({
      data: {
        classSessionId: sessionId,
        userId: userAId,
        status: 'CONFIRMED',
        seatHoldId: holdA.id,
        amountCents: 1000,
      },
    });
    await prisma.seatHold.update({ where: { id: holdA.id }, data: { status: 'CONSUMED' } });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('students B and C can join the waitlist (session full)', async () => {
    const entryB = await waitlistService.joinWaitlist(userBId, sessionId);
    const entryC = await waitlistService.joinWaitlist(userCId, sessionId);

    expect(entryB.status).toBe('WAITING');
    expect(entryC.status).toBe('WAITING');
    expect(entryB.position).toBeLessThan(entryC.position);
  });

  it('duplicate waitlist join throws ConflictException', async () => {
    await expect(waitlistService.joinWaitlist(userBId, sessionId)).rejects.toThrow();
  });

  it('promoteNext promotes student B and creates a SeatHold', async () => {
    const prisma = getTestPrisma();

    // Cancel student A's booking (freeing the seat)
    const bookingA = await prisma.booking.findFirst({
      where: { userId: userAId, classSessionId: sessionId },
    });
    await prisma.booking.update({
      where: { id: bookingA!.id },
      data: { status: 'CANCELLED' },
    });

    await promotionService.promoteNext(sessionId);

    const entryB = await prisma.waitlistEntry.findFirst({
      where: { userId: userBId, classSessionId: sessionId },
    });
    expect(entryB?.status).toBe('OFFERED');
    expect(entryB?.offeredSeatHoldId).toBeTruthy();

    // Verify SeatHold was created for B
    const hold = await prisma.seatHold.findFirst({
      where: { userId: userBId, classSessionId: sessionId, source: 'WAITLIST_PROMOTION' },
    });
    expect(hold).not.toBeNull();
    expect(hold?.status).toBe('ACTIVE');
  });

  it('student C remains WAITING after B is promoted', async () => {
    const prisma = getTestPrisma();
    const entryC = await prisma.waitlistEntry.findFirst({
      where: { userId: userCId, classSessionId: sessionId },
    });
    expect(entryC?.status).toBe('WAITING');
  });

  it('getQueueForSession returns entries in position order', async () => {
    const queue = await waitlistService.getQueueForSession(sessionId);
    expect(queue.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].position).toBeGreaterThan(queue[i - 1].position);
    }
  });
});
