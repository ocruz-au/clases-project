import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export type SeatHoldSource = 'CHECKOUT' | 'WAITLIST_PROMOTION';

export interface HoldResult {
  id: string;
  classSessionId: string;
  userId: string;
  source: SeatHoldSource;
  expiresAt: Date;
  status: string;
}

@Injectable()
export class SeatHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly settingsService: SettingsService | null,
  ) {}

  async createHold(userId: string, sessionId: string, source: SeatHoldSource): Promise<HoldResult> {
    const envDefault = this.config.get<number>('SEAT_HOLD_WINDOW_MINUTES') ?? 10;
    const holdWindowMinutes = this.settingsService
      ? await this.settingsService.get<number>('seatHoldWindowMinutes', envDefault)
      : envDefault;

    return this.prisma.$transaction(async (tx) => {
      // Row-lock the session to serialize concurrent claimants
      const rows = await tx.$queryRaw<Array<{ id: string; capacity: number; status: string; deleted_at: Date | null }>>`
        SELECT id, capacity, status, "deletedAt" as deleted_at
        FROM class_sessions
        WHERE id = ${sessionId}::uuid
        FOR UPDATE
      `;

      const session = rows[0];
      if (!session || session.deleted_at !== null) {
        throw new NotFoundException('Session not found');
      }
      if (session.status !== 'SCHEDULED') {
        throw new ConflictException('Session is not available for booking');
      }

      // Count active holds and confirmed bookings
      const [holdCount, confirmedCount] = await Promise.all([
        tx.seatHold.count({
          where: {
            classSessionId: sessionId,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        }),
        tx.booking.count({
          where: {
            classSessionId: sessionId,
            status: 'CONFIRMED',
            deletedAt: null,
          },
        }),
      ]);

      const taken = holdCount + confirmedCount;
      if (taken >= session.capacity) {
        throw new ConflictException('CAPACITY_EXCEEDED');
      }

      const expiresAt = new Date(Date.now() + holdWindowMinutes * 60 * 1000);

      return tx.seatHold.create({
        data: {
          classSessionId: sessionId,
          userId,
          source,
          expiresAt,
          status: 'ACTIVE',
        },
      }) as Promise<HoldResult>;
    });
  }

  async releaseHold(holdId: string): Promise<void> {
    await this.prisma.seatHold.update({
      where: { id: holdId },
      data: { status: 'RELEASED' },
    });
  }

  async consumeHold(holdId: string): Promise<void> {
    await this.prisma.seatHold.update({
      where: { id: holdId },
      data: { status: 'CONSUMED' },
    });
  }

  isExpired(hold: { expiresAt: Date; status: string }): boolean {
    return hold.status !== 'ACTIVE' || hold.expiresAt <= new Date();
  }
}
