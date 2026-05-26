import { Injectable } from '@nestjs/common';
import { dateRangeUTC } from '@app/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async bookingsByDateRange(from: string, to: string) {
    const range = dateRangeUTC(from, to);
    const total = await this.prisma.booking.count({
      where: { status: 'CONFIRMED', deletedAt: null, session: { startsAt: range } },
    });
    return { from, to, total };
  }

  async revenueByDateRange(from: string, to: string) {
    const range = dateRangeUTC(from, to);
    const where = {
      status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const },
      deletedAt: null,
      bookings: { some: { session: { startsAt: range }, deletedAt: null } },
    };
    const [agg, count] = await Promise.all([
      this.prisma.payment.aggregate({ where, _sum: { amountCents: true } }),
      this.prisma.payment.count({ where }),
    ]);
    return { from, to, totalCents: agg._sum.amountCents ?? 0, count };
  }

  async attendanceSummary(from: string, to: string) {
    const range = dateRangeUTC(from, to);
    const rows = await this.prisma.booking.groupBy({
      by: ['status'],
      where: {
        status: { in: ['CONFIRMED', 'ATTENDED', 'NO_SHOW'] },
        deletedAt: null,
        session: { startsAt: range },
      },
      _count: { status: true },
    });
    const summary: Record<string, number> = { CONFIRMED: 0, ATTENDED: 0, NO_SHOW: 0 };
    for (const row of rows) {
      summary[row.status] = row._count.status;
    }
    return { from, to, ...summary };
  }

  async cancellationsByDateRange(from: string, to: string) {
    const range = dateRangeUTC(from, to);
    const total = await this.prisma.booking.count({
      where: { status: 'CANCELLED', deletedAt: null, session: { startsAt: range } },
    });
    return { from, to, total };
  }

  async waitlistConversionRate(from: string, to: string) {
    const range = dateRangeUTC(from, to);
    const [total, converted] = await Promise.all([
      this.prisma.waitlistEntry.count({ where: { deletedAt: null, session: { startsAt: range } } }),
      this.prisma.waitlistEntry.count({ where: { status: 'CONVERTED', deletedAt: null, session: { startsAt: range } } }),
    ]);
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { from, to, total, converted, rate };
  }
}
