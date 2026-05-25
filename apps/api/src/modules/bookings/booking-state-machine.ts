import { BadRequestException } from '@nestjs/common';

export type BookingStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW' | 'ATTENDED';

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  HELD: ['CONFIRMED', 'EXPIRED'],
  CONFIRMED: ['CANCELLED', 'ATTENDED', 'NO_SHOW'],
  CANCELLED: [],
  EXPIRED: [],
  NO_SHOW: [],
  ATTENDED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Invalid booking transition: ${from} → ${to}`);
  }
}
