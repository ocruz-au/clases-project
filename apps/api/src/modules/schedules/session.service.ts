import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toPerth } from '@app/shared';

export interface SessionFilter {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  instructorId?: string;
  locationId?: string;
  page?: number;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: SessionFilter = {}) {
    const page = filter.page ?? 1;
    const limit = 20;

    const where: Record<string, unknown> = {
      status: 'SCHEDULED',
      deletedAt: null,
    };

    if (filter.dateFrom) {
      where['startsAt'] = { ...(where['startsAt'] as object ?? {}), gte: new Date(filter.dateFrom) };
    }
    if (filter.dateTo) {
      const end = new Date(filter.dateTo);
      end.setDate(end.getDate() + 1);
      where['startsAt'] = { ...(where['startsAt'] as object ?? {}), lt: end };
    }
    if (filter.categoryId) {
      where['class'] = { categoryId: filter.categoryId };
    }
    if (filter.instructorId) {
      where['instructorId'] = filter.instructorId;
    }
    if (filter.locationId) {
      where['room'] = { locationId: filter.locationId };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.classSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          class: { include: { category: true } },
          instructor: { include: { user: true } },
          room: { include: { location: true } },
          _count: {
            select: {
              bookings: { where: { status: 'CONFIRMED', deletedAt: null } },
              seatHolds: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } },
            },
          },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.classSession.count({ where }),
    ]);

    const items = sessions.map((s) => this.toDto(s));
    return { items, total, page };
  }

  async findById(id: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        class: { include: { category: true } },
        instructor: { include: { user: true } },
        room: { include: { location: true } },
        _count: {
          select: {
            bookings: { where: { status: 'CONFIRMED', deletedAt: null } },
            seatHolds: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.toDto(session);
  }

  private toDto(session: {
    id: string;
    classId: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    status: string;
    class: {
      title: string;
      priceCents: number;
      currency: string;
      category: { id: string };
    };
    instructor: {
      id: string;
      user: { name: string };
    };
    room: {
      id: string;
      name: string;
      locationId: string;
      location: { id: string; name: string; address: string };
    };
    _count: { bookings: number; seatHolds: number };
  }) {
    const taken = session._count.bookings + session._count.seatHolds;
    const seatsAvailable = Math.max(0, session.capacity - taken);

    return {
      id: session.id,
      classId: session.classId,
      title: session.class.title,
      categoryId: session.class.category.id,
      instructorId: session.instructor.id,
      instructorName: session.instructor.user.name,
      locationId: session.room.location.id,
      locationName: session.room.location.name,
      locationAddress: session.room.location.address,
      roomName: session.room.name,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      startsAtPerth: toPerth(session.startsAt).toISO(),
      endsAtPerth: toPerth(session.endsAt).toISO(),
      capacity: session.capacity,
      seatsAvailable,
      priceCents: session.class.priceCents,
      currency: session.class.currency,
      status: session.status,
    };
  }
}
