import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  assertTransition,
  canTransition,
  type BookingStatus,
} from './booking-state-machine';
import { SeatHoldService } from './seat-hold.service';

// ── BookingStateMachine ───────────────────────────────────────────────────────

describe('BookingStateMachine', () => {
  describe('canTransition', () => {
    const valid: Array<[BookingStatus, BookingStatus]> = [
      ['HELD', 'CONFIRMED'],
      ['HELD', 'EXPIRED'],
      ['CONFIRMED', 'CANCELLED'],
      ['CONFIRMED', 'ATTENDED'],
      ['CONFIRMED', 'NO_SHOW'],
    ];
    test.each(valid)('%s → %s is allowed', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    const invalid: Array<[BookingStatus, BookingStatus]> = [
      ['HELD', 'CANCELLED'],
      ['HELD', 'ATTENDED'],
      ['CONFIRMED', 'EXPIRED'],
      ['EXPIRED', 'CONFIRMED'],
      ['CANCELLED', 'CONFIRMED'],
      ['ATTENDED', 'CONFIRMED'],
    ];
    test.each(invalid)('%s → %s is rejected', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('throws on invalid transition', () => {
      expect(() => assertTransition('EXPIRED', 'CONFIRMED')).toThrow();
    });
    it('does not throw on valid transition', () => {
      expect(() => assertTransition('HELD', 'CONFIRMED')).not.toThrow();
    });
  });
});

// ── SeatHoldService unit tests ────────────────────────────────────────────────

const mockSession = { id: 'session-1', capacity: 2, status: 'SCHEDULED', deleted_at: null };

function buildPrismaMock(
  sessionRows: typeof mockSession[],
  holdCount: number,
  confirmedCount: number,
) {
  return {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(sessionRows),
        seatHold: {
          count: jest.fn().mockResolvedValue(holdCount),
          create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: 'hold-1', ...args.data }),
          ),
        },
        booking: {
          count: jest.fn().mockResolvedValue(confirmedCount),
        },
      };
      return fn(tx);
    }),
  };
}

describe('SeatHoldService', () => {
  let service: SeatHoldService;

  async function build(holdCount: number, confirmedCount: number, capacity = 2) {
    const prismaMock = buildPrismaMock(
      [{ ...mockSession, capacity }],
      holdCount,
      confirmedCount,
    );
    const module = await Test.createTestingModule({
      providers: [
        SeatHoldService,
        { provide: 'PrismaService', useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(10) },
        },
      ],
    })
      .overrideProvider(SeatHoldService)
      .useFactory({
        factory: () => {
          const s = new SeatHoldService(
            prismaMock as never,
            { get: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
          );
          return s;
        },
      })
      .compile();
    return module.get<SeatHoldService>(SeatHoldService);
  }

  it('creates a hold when seats are available', async () => {
    service = await build(0, 0, 2);
    const hold = await service.createHold('user-1', 'session-1', 'CHECKOUT');
    expect(hold).toMatchObject({ classSessionId: 'session-1', userId: 'user-1', source: 'CHECKOUT' });
  });

  it('throws CAPACITY_EXCEEDED when session is full', async () => {
    service = await build(1, 1, 2); // 2 taken, capacity 2
    await expect(service.createHold('user-2', 'session-1', 'CHECKOUT')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws CAPACITY_EXCEEDED when confirmed + holds equal capacity', async () => {
    service = await build(2, 0, 2); // 2 active holds, capacity 2
    await expect(service.createHold('user-3', 'session-1', 'CHECKOUT')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws NotFoundException when session does not exist', async () => {
    const prismaMock = buildPrismaMock([], 0, 0);
    service = new SeatHoldService(
      prismaMock as never,
      { get: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
    );
    await expect(service.createHold('user-1', 'nonexistent', 'CHECKOUT')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('allows hold when there is exactly one seat left', async () => {
    service = await build(0, 1, 2); // 1 confirmed, capacity 2 → 1 available
    const hold = await service.createHold('user-1', 'session-1', 'CHECKOUT');
    expect(hold.status).toBe('ACTIVE');
  });

  it('isExpired returns true for expired hold', () => {
    // Create service without needing a module
    const s = new SeatHoldService(
      {} as never,
      { get: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
    );
    const pastDate = new Date(Date.now() - 1000);
    expect(s.isExpired({ expiresAt: pastDate, status: 'ACTIVE' })).toBe(true);
  });

  it('isExpired returns false for active non-expired hold', () => {
    const s = new SeatHoldService(
      {} as never,
      { get: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
    );
    const futureDate = new Date(Date.now() + 60_000);
    expect(s.isExpired({ expiresAt: futureDate, status: 'ACTIVE' })).toBe(false);
  });
});
