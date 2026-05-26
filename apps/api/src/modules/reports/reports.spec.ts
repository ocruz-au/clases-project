/**
 * T092 — Unit test: report aggregate queries are Perth-tz-aware.
 *
 * Verifies that date-range boundaries are correctly converted from Perth local
 * calendar days to UTC before being passed to Prisma queries.
 */
import { dateRangeUTC } from '@app/shared';
import { ReportsService } from './reports.service';

describe('ReportsService — Perth-tz-aware date range (T092)', () => {
  it('dateRangeUTC maps 2026-06-01 Perth midnight to 2026-05-31T16:00:00.000Z', () => {
    const { gte } = dateRangeUTC('2026-06-01', '2026-06-01');
    expect(gte.toISOString()).toBe('2026-05-31T16:00:00.000Z');
  });

  it('dateRangeUTC maps 2026-06-01 Perth end-of-day to 2026-06-01T15:59:59.999Z', () => {
    const { lte } = dateRangeUTC('2026-06-01', '2026-06-01');
    expect(lte.toISOString()).toBe('2026-06-01T15:59:59.999Z');
  });

  it('bookingsByDateRange passes the correct UTC range to Prisma', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = {
      booking: { count: jest.fn().mockResolvedValue(7) },
    };
    const service = new ReportsService(mockPrisma);

    const result = await service.bookingsByDateRange('2026-06-01', '2026-06-30');

    const whereArg = mockPrisma.booking.count.mock.calls[0][0].where;
    const { gte, lte } = dateRangeUTC('2026-06-01', '2026-06-30');
    expect(whereArg.session.startsAt.gte.getTime()).toBe(gte.getTime());
    expect(whereArg.session.startsAt.lte.getTime()).toBe(lte.getTime());
    expect(result.total).toBe(7);
  });

  it('cancellationsByDateRange passes the correct UTC range to Prisma', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = {
      booking: { count: jest.fn().mockResolvedValue(3) },
    };
    const service = new ReportsService(mockPrisma);

    await service.cancellationsByDateRange('2026-06-01', '2026-06-30');

    const whereArg = mockPrisma.booking.count.mock.calls[0][0].where;
    const { gte } = dateRangeUTC('2026-06-01', '2026-06-30');
    expect(whereArg.session.startsAt.gte.getTime()).toBe(gte.getTime());
    expect(whereArg.status).toBe('CANCELLED');
  });

  it('waitlistConversionRate passes the correct UTC range and filters CONVERTED', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = {
      waitlistEntry: {
        count: jest
          .fn()
          .mockResolvedValueOnce(10)  // total
          .mockResolvedValueOnce(4),  // converted
      },
    };
    const service = new ReportsService(mockPrisma);

    const result = await service.waitlistConversionRate('2026-06-01', '2026-06-30');

    const totalCall = mockPrisma.waitlistEntry.count.mock.calls[0][0].where;
    const convertedCall = mockPrisma.waitlistEntry.count.mock.calls[1][0].where;
    const { gte } = dateRangeUTC('2026-06-01', '2026-06-30');

    expect(totalCall.session.startsAt.gte.getTime()).toBe(gte.getTime());
    expect(convertedCall.status).toBe('CONVERTED');
    expect(result).toMatchObject({ total: 10, converted: 4, rate: 40 });
  });
});
