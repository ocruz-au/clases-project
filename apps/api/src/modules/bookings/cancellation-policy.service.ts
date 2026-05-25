import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toPerth } from '@app/shared';

interface PolicyRule {
  hoursBefore: number;
  refundPercent: number;
}

@Injectable()
export class CancellationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.cancellationPolicy.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const policy = await this.prisma.cancellationPolicy.findFirst({ where: { id, deletedAt: null } });
    if (!policy) throw new NotFoundException('Cancellation policy not found');
    return policy;
  }

  async findDefault() {
    return this.prisma.cancellationPolicy.findFirst({ where: { isDefault: true, deletedAt: null } });
  }

  create(data: { name: string; rules: PolicyRule[]; isDefault?: boolean }) {
    return this.prisma.cancellationPolicy.create({
      data: { name: data.name, rules: data.rules, isDefault: data.isDefault ?? false },
    });
  }

  async update(id: string, data: { name?: string; rules?: PolicyRule[]; isDefault?: boolean }) {
    await this.findById(id);
    return this.prisma.cancellationPolicy.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.cancellationPolicy.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Compute refund percentage for a cancellation.
   * Compares Perth-local times to determine hours before the session.
   * Returns 0–100.
   */
  computeRefundPercent(
    policy: { rules: unknown },
    sessionStartsAt: Date,
    cancelledAt: Date,
  ): number {
    const rules = policy.rules as PolicyRule[];
    if (!rules || rules.length === 0) return 0;

    const startPerth = toPerth(sessionStartsAt);
    const cancelPerth = toPerth(cancelledAt);
    const hoursBefore = startPerth.diff(cancelPerth, 'hours').hours;

    // Sort rules descending by hoursBefore — apply the first bracket where hoursBefore >= threshold
    const sorted = [...rules].sort((a, b) => b.hoursBefore - a.hoursBefore);
    for (const rule of sorted) {
      if (hoursBefore >= rule.hoursBefore) {
        return rule.refundPercent;
      }
    }

    return 0;
  }
}
