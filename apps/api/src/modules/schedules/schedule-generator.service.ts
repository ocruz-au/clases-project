import { Injectable } from '@nestjs/common';
import { RRule } from 'rrule';
import { DateTime } from 'luxon';
import { PrismaService } from '../../prisma/prisma.service';
import { PERTH_TZ } from '@app/shared';

export interface RuleInput {
  rrule: string;
  startTimeLocal: string; // HH:mm in Perth local time
  durationMin: number;
  capacityOverride: number | null;
  defaultCapacity: number;
  activeFrom: Date;
  activeUntil: Date | null;
}

export interface GeneratedSession {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}

@Injectable()
export class ScheduleGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  expandRule(input: RuleInput): GeneratedSession[] {
    const [hours, minutes] = input.startTimeLocal.split(':').map(Number);
    const capacity = input.capacityOverride ?? input.defaultCapacity;

    const rule = RRule.fromString(input.rrule);

    // Use activeFrom as dtstart if not already set in the rule
    const options = {
      ...rule.options,
      dtstart: input.activeFrom,
    };
    const fullRule = new RRule(options);

    const until = input.activeUntil ?? undefined;
    const dates = fullRule.all((d) => !until || d <= until);

    return dates.map((date) => {
      // Each `date` from rrule is in "fake UTC" (rrule works in UTC but represents local dates)
      // Re-interpret as the year/month/day in Perth local, then set the start time
      const perthDay = DateTime.fromObject(
        { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
        { zone: PERTH_TZ },
      ).set({ hour: hours ?? 0, minute: minutes ?? 0, second: 0, millisecond: 0 });

      const startsAt = perthDay.toUTC().toJSDate();
      const endsAt = new Date(startsAt.getTime() + input.durationMin * 60 * 1000);

      return { startsAt, endsAt, capacity };
    });
  }

  async generateForRule(
    ruleId: string,
    context: {
      classId: string;
      roomId: string;
      instructorId: string;
    },
  ): Promise<number> {
    const rule = await this.prisma.availabilityRule.findFirst({
      where: { id: ruleId, deletedAt: null },
      include: { class: true },
    });
    if (!rule) return 0;

    const sessions = this.expandRule({
      rrule: rule.rrule,
      startTimeLocal: rule.startTimeLocal,
      durationMin: rule.durationMin,
      capacityOverride: rule.capacityOverride,
      defaultCapacity: rule.class.defaultCapacity,
      activeFrom: rule.activeFrom,
      activeUntil: rule.activeUntil,
    });

    if (sessions.length === 0) return 0;

    const result = await this.prisma.classSession.createMany({
      data: sessions.map((s) => ({
        classId: context.classId,
        roomId: context.roomId,
        instructorId: context.instructorId,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        capacity: s.capacity,
        status: 'SCHEDULED' as const,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }
}
