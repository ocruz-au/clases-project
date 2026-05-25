/**
 * T074 — Unit test: instructor session access guard
 * Ensures instructors cannot access sessions not assigned to them.
 */
import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../prisma/prisma.service';

const makePrisma = (overrides: Partial<{ instructorProfile: unknown; classSession: unknown }> = {}) => ({
  instructorProfile: {
    findFirst: jest.fn().mockResolvedValue(overrides.instructorProfile ?? { id: 'instr-profile-1' }),
  },
  classSession: {
    findFirst: jest.fn().mockResolvedValue(overrides.classSession ?? {
      id: 'session-1',
      instructorId: 'instr-profile-1',
      status: 'SCHEDULED',
    }),
  },
  booking: {
    findFirst: jest.fn().mockResolvedValue({
      id: 'booking-1',
      classSessionId: 'session-1',
      status: 'CONFIRMED',
    }),
    update: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'ATTENDED', checkedInAt: new Date() }),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    booking: {
      findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', classSessionId: 'session-1', status: 'CONFIRMED' }),
      update: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'ATTENDED', checkedInAt: new Date() }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  })),
});

describe('AttendanceService — instructor access guard', () => {
  it('throws ForbiddenException when instructor profile not found', async () => {
    const prisma = makePrisma({ instructorProfile: null });
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(
      service.recordAttendance('session-1', 'booking-1', 'ATTENDED', 'user-99'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when session not assigned to instructor', async () => {
    const prisma = makePrisma({
      instructorProfile: { id: 'instr-profile-99' },
      classSession: { id: 'session-1', instructorId: 'instr-profile-other', status: 'SCHEDULED' },
    });
    const service = new AttendanceService(prisma as unknown as PrismaService);

    await expect(
      service.recordAttendance('session-1', 'booking-1', 'ATTENDED', 'user-99'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows attendance recording when instructor is assigned', async () => {
    const prisma = makePrisma();
    const service = new AttendanceService(prisma as unknown as PrismaService);

    const result = await service.recordAttendance('session-1', 'booking-1', 'ATTENDED', 'user-1');
    expect(result).toHaveProperty('status', 'ATTENDED');
  });
});
