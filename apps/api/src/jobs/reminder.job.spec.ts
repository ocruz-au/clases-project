/**
 * T085 — Unit test: ReminderJob eligibility logic
 *
 * Verifies the job selects only eligible bookings (CONFIRMED, within lead window,
 * not already notified) and formats session time in Perth local time.
 */
import { ReminderJob } from './reminder.job';

const makeMockBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  userId: 'user-1',
  classSessionId: 'session-1',
  status: 'CONFIRMED',
  user: { email: 'student@test.com', name: 'Student Name' },
  session: {
    startsAt: new Date(Date.now() + 12 * 3600_000),
    class: { title: 'Yoga' },
    instructor: { user: { name: 'Instructor A' } },
    room: { location: { name: 'Studio', address: '1 Main St' } },
  },
  ...overrides,
});

describe('ReminderJob (T085)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockNotifications: any;
  let job: ReminderJob;

  beforeEach(() => {
    mockPrisma = {
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    mockNotifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
    job = new ReminderJob(mockPrisma, mockNotifications);
  });

  it('dispatches reminder for an eligible CONFIRMED booking', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([makeMockBooking()]);

    await job.sendReminders();

    expect(mockNotifications.dispatch).toHaveBeenCalledTimes(1);
    expect(mockNotifications.dispatch).toHaveBeenCalledWith(
      'user-1',
      'REMINDER',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });

  it('skips a booking that has already been reminded', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([makeMockBooking()]);
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing-notif' });

    await job.sendReminders();

    expect(mockNotifications.dispatch).not.toHaveBeenCalled();
  });

  it('uses configured lead time from settings', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({ key: 'reminder_lead_hours', value: 48 });
    mockPrisma.booking.findMany.mockResolvedValue([]);

    await job.sendReminders();

    const call = mockPrisma.booking.findMany.mock.calls[0][0] as {
      where: { session: { startsAt: { lte: Date } } };
    };
    const upperBound = call.where.session.startsAt.lte;
    const expectedUpper = Date.now() + 48 * 3600_000;
    expect(Math.abs(upperBound.getTime() - expectedUpper)).toBeLessThan(5000);
  });

  it('formats session time in Perth timezone (UTC+8)', async () => {
    // 01:00 UTC = 09:00 Perth (UTC+8)
    const utcTime = new Date('2026-06-15T01:00:00.000Z');
    mockPrisma.setting.findUnique.mockResolvedValue({ key: 'reminder_lead_hours', value: 24 * 365 });
    mockPrisma.booking.findMany.mockResolvedValue([
      makeMockBooking({ id: 'booking-tz', userId: 'user-tz', session: {
        startsAt: utcTime,
        class: { title: 'Morning Yoga' },
        instructor: { user: { name: 'Instructor TZ' } },
        room: { location: { name: 'Studio', address: '1 Main St' } },
      }}),
    ]);

    await job.sendReminders();

    const dispatchPayload = mockNotifications.dispatch.mock.calls[0][2] as { subject: string };
    // Perth local date: 15 June 2026 at 9:00 AM
    expect(dispatchPayload.subject).toContain('15 June 2026');
    expect(dispatchPayload.subject).toContain('9:00 AM');
  });
});
