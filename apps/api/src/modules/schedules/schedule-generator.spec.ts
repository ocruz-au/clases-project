/**
 * T052 — Unit test: ScheduleGeneratorService
 *
 * Verifies RRULE expansion: weekly class, 10 occurrences, Perth local time,
 * correct UTC storage, boundary around midnight Perth.
 */
import { ScheduleGeneratorService } from './schedule-generator.service';

describe('ScheduleGeneratorService', () => {
  let service: ScheduleGeneratorService;

  beforeEach(() => {
    // Minimal Prisma stub — not used in pure generation tests
    const prismaMock = { classSession: { createMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    service = new ScheduleGeneratorService(prismaMock as never);
  });

  it('generates the correct number of occurrences from a weekly RRULE', async () => {
    const sessions = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
      startTimeLocal: '09:00',
      durationMin: 60,
      capacityOverride: null,
      defaultCapacity: 15,
      activeFrom: new Date('2026-06-02T00:00:00.000Z'), // a Monday
      activeUntil: null,
    });

    expect(sessions).toHaveLength(10);
  });

  it('converts Perth local start time to correct UTC offset', () => {
    // Perth is UTC+8 (no DST)
    const sessions = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=1',
      startTimeLocal: '09:00',
      durationMin: 60,
      capacityOverride: null,
      defaultCapacity: 15,
      activeFrom: new Date('2026-06-01T00:00:00.000Z'),
      activeUntil: null,
    });

    expect(sessions).toHaveLength(1);
    const startsAt = sessions[0]!.startsAt;
    // 09:00 Perth = 01:00 UTC (Perth is UTC+8)
    expect(startsAt.getUTCHours()).toBe(1);
    expect(startsAt.getUTCMinutes()).toBe(0);
  });

  it('sets endsAt = startsAt + durationMin', () => {
    const sessions = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=1',
      startTimeLocal: '18:00',
      durationMin: 90,
      capacityOverride: null,
      defaultCapacity: 10,
      activeFrom: new Date('2026-06-01T00:00:00.000Z'),
      activeUntil: null,
    });

    expect(sessions).toHaveLength(1);
    const diff =
      (sessions[0]!.endsAt.getTime() - sessions[0]!.startsAt.getTime()) / (60 * 1000);
    expect(diff).toBe(90);
  });

  it('uses capacityOverride when provided, otherwise defaultCapacity', () => {
    const withOverride = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=1',
      startTimeLocal: '10:00',
      durationMin: 60,
      capacityOverride: 5,
      defaultCapacity: 20,
      activeFrom: new Date('2026-06-01T00:00:00.000Z'),
      activeUntil: null,
    });
    expect(withOverride[0]!.capacity).toBe(5);

    const withDefault = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=1',
      startTimeLocal: '10:00',
      durationMin: 60,
      capacityOverride: null,
      defaultCapacity: 20,
      activeFrom: new Date('2026-06-01T00:00:00.000Z'),
      activeUntil: null,
    });
    expect(withDefault[0]!.capacity).toBe(20);
  });

  it('midnight Perth boundary: 00:00 Perth = 16:00 previous day UTC', () => {
    const sessions = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=SA;COUNT=1',
      startTimeLocal: '00:00',
      durationMin: 60,
      capacityOverride: null,
      defaultCapacity: 8,
      activeFrom: new Date('2026-06-06T00:00:00.000Z'), // a Saturday in Perth
      activeUntil: null,
    });

    expect(sessions).toHaveLength(1);
    const startsAt = sessions[0]!.startsAt;
    // 00:00 Perth Saturday = 16:00 UTC Friday
    expect(startsAt.getUTCHours()).toBe(16);
  });

  it('respects activeUntil by excluding sessions beyond the boundary', () => {
    const sessions = service.expandRule({
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
      startTimeLocal: '09:00',
      durationMin: 60,
      capacityOverride: null,
      defaultCapacity: 10,
      activeFrom: new Date('2026-06-01T00:00:00.000Z'),
      activeUntil: new Date('2026-07-01T00:00:00.000Z'), // ~4 weeks
    });

    // Only Mondays within June 2026: Jun 1, 8, 15, 22, 29 = 5 occurrences
    expect(sessions.length).toBeLessThanOrEqual(5);
    for (const s of sessions) {
      expect(s.startsAt.getTime()).toBeLessThanOrEqual(
        new Date('2026-07-01T00:00:00.000Z').getTime(),
      );
    }
  });
});
