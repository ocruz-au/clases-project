import { DateTime } from 'luxon';

export const PERTH_TZ = 'Australia/Perth';

export function toPerth(utcDate: Date): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(PERTH_TZ);
}

export function fromPerth(localDate: DateTime): Date {
  return localDate.setZone(PERTH_TZ).toUTC().toJSDate();
}

export function formatPerthDate(utcDate: Date, format = 'ccc dd LLL yyyy, h:mm a'): string {
  return toPerth(utcDate).toFormat(format);
}

/** Convert a [fromDate, toDate] in Perth local calendar days to a UTC range for DB queries. */
export function dateRangeUTC(
  fromDate: string,
  toDate: string,
): { gte: Date; lte: Date } {
  const gte = DateTime.fromISO(fromDate, { zone: PERTH_TZ }).startOf('day').toUTC().toJSDate();
  const lte = DateTime.fromISO(toDate, { zone: PERTH_TZ }).endOf('day').toUTC().toJSDate();
  return { gte, lte };
}

/** Parse a Perth-local time string (HH:mm) and a date to produce a UTC Date. */
export function perthLocalTimeToUTC(date: Date, timeHHmm: string): Date {
  const [hours, minutes] = timeHHmm.split(':').map(Number);
  const perth = toPerth(date).set({ hour: hours ?? 0, minute: minutes ?? 0, second: 0, millisecond: 0 });
  return perth.toUTC().toJSDate();
}
