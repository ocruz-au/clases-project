/**
 * T084 — Integration test: reminder job idempotency
 *
 * Seeds a CONFIRMED booking with session starting within the default 24-hour lead window.
 * First run → exactly one REMINDER notification created.
 * Second run → no duplicate notification.
 */
import { ConfigService } from '@nestjs/config';
import { ReminderJob } from '../../src/jobs/reminder.job';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import { getTestPrisma, truncateAllTables, disconnectTestPrisma } from '../helpers/db';

describe('Reminder job idempotency (T084)', () => {
  let reminderJob: ReminderJob;
  let userId: string;
  let bookingId: string;

  beforeAll(async () => {
    await truncateAllTables();
    const prisma = getTestPrisma();

    // Null API key → Resend is skipped, but notification rows are still created in DB
    const configService = {
      get: jest.fn().mockReturnValue(null),
    } as unknown as ConfigService;

    const notificationService = new NotificationService(prisma as never, configService);
    reminderJob = new ReminderJob(prisma as never, notificationService);

    const role = await prisma.role.create({ data: { key: 'STUDENT', description: 'Student' } });
    const user = await prisma.user.create({
      data: { email: 'reminder-student@test.com', name: 'Reminder Student', passwordHash: 'x' },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    userId = user.id;

    const location = await prisma.location.create({
      data: { name: 'Reminder Loc', address: '1 Reminder St', timezone: 'Australia/Perth' },
    });
    const room = await prisma.room.create({
      data: { name: 'Reminder Room', capacity: 10, locationId: location.id },
    });
    const category = await prisma.category.create({ data: { name: 'Reminder Cat', slug: 'reminder-cat' } });
    const cls = await prisma.class.create({
      data: { title: 'Yoga Class', categoryId: category.id, priceCents: 1000, defaultCapacity: 10 },
    });
    const instructorUser = await prisma.user.create({
      data: { email: 'reminder-instructor@test.com', name: 'Instructor Reminder', passwordHash: 'x' },
    });
    const instructorProfile = await prisma.instructorProfile.create({
      data: { userId: instructorUser.id },
    });

    // Session starting 12 hours from now — within the default 24-hour lead window
    const session = await prisma.classSession.create({
      data: {
        classId: cls.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt: new Date(Date.now() + 12 * 3600_000),
        endsAt: new Date(Date.now() + 13 * 3600_000),
        capacity: 10,
        status: 'SCHEDULED',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        classSessionId: session.id,
        status: 'CONFIRMED',
        amountCents: 1000,
      },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('creates exactly one REMINDER notification on first run', async () => {
    const prisma = getTestPrisma();

    await reminderJob.sendReminders();

    const notifications = await prisma.notification.findMany({
      where: { userId, type: 'REMINDER' },
    });

    expect(notifications).toHaveLength(1);
    expect((notifications[0].payload as Record<string, unknown>)['bookingId']).toBe(bookingId);
  });

  it('does not create a duplicate notification on second run', async () => {
    const prisma = getTestPrisma();

    await reminderJob.sendReminders();

    const notifications = await prisma.notification.findMany({
      where: { userId, type: 'REMINDER' },
    });

    expect(notifications).toHaveLength(1);
  });
});
