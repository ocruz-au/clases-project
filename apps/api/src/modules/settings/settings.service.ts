import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = row ? (row.value as T) : defaultValue;

    this.cache.set(key, { value, expiresAt: Date.now() + SettingsService.TTL_MS });
    return value;
  }

  async getAll() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async getByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async set(key: string, value: unknown, actorId?: string): Promise<{ key: string; value: unknown }> {
    const before = await this.prisma.setting.findUnique({ where: { key } });

    const row = await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as never, updatedBy: actorId ?? null },
      create: { key, value: value as never, updatedBy: actorId ?? null },
    });

    this.cache.set(key, { value, expiresAt: Date.now() + SettingsService.TTL_MS });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: 'SETTING_UPDATED',
        resourceType: 'Setting',
        resourceId: key,
        beforeState: { value: before?.value ?? null },
        afterState: { value },
      },
    });

    this.logger.log(`Setting ${key} updated to ${JSON.stringify(value)}`);
    return row;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
