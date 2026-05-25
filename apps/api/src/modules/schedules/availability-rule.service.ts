import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleGeneratorService } from './schedule-generator.service';

@Injectable()
export class AvailabilityRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ScheduleGeneratorService,
  ) {}

  async list(classId?: string) {
    return this.prisma.availabilityRule.findMany({
      where: { deletedAt: null, ...(classId ? { classId } : {}) },
      include: { class: true, room: true, instructor: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const rule = await this.prisma.availabilityRule.findFirst({
      where: { id, deletedAt: null },
      include: { class: true, room: true, instructor: { include: { user: true } } },
    });
    if (!rule) throw new NotFoundException('Availability rule not found');
    return rule;
  }

  async create(data: {
    classId: string;
    roomId: string;
    instructorId: string;
    rrule: string;
    startTimeLocal: string;
    durationMin: number;
    capacityOverride?: number | null;
    activeFrom: string;
    activeUntil?: string | null;
  }) {
    return this.prisma.availabilityRule.create({
      data: {
        classId: data.classId,
        roomId: data.roomId,
        instructorId: data.instructorId,
        rrule: data.rrule,
        startTimeLocal: data.startTimeLocal,
        durationMin: data.durationMin,
        capacityOverride: data.capacityOverride ?? null,
        activeFrom: new Date(data.activeFrom),
        activeUntil: data.activeUntil ? new Date(data.activeUntil) : null,
      },
      include: { class: true, room: true, instructor: { include: { user: true } } },
    });
  }

  async update(
    id: string,
    data: Partial<{
      rrule: string;
      startTimeLocal: string;
      durationMin: number;
      capacityOverride: number | null;
      activeFrom: string;
      activeUntil: string | null;
    }>,
  ) {
    await this.findById(id);
    return this.prisma.availabilityRule.update({
      where: { id },
      data: {
        ...data,
        activeFrom: data.activeFrom ? new Date(data.activeFrom) : undefined,
        activeUntil: data.activeUntil !== undefined
          ? data.activeUntil ? new Date(data.activeUntil) : null
          : undefined,
      },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.availabilityRule.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async generateSessions(ruleId: string): Promise<{ created: number }> {
    const rule = await this.findById(ruleId);
    const created = await this.generator.generateForRule(ruleId, {
      classId: rule.classId,
      roomId: rule.roomId,
      instructorId: rule.instructorId,
    });
    return { created };
  }
}
