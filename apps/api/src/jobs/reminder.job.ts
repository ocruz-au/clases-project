import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../modules/notifications/notification.service';
import { toPerth } from '@app/shared';

@Injectable()
export class ReminderJob {
  private readonly logger = new Logger(ReminderJob.name);
  private static readonly DEFAULT_LEAD_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders(): Promise<void> {
    const leadHours = await this.getLeadHours();
    const now = new Date();
    const upperBound = new Date(now.getTime() + leadHours * 3600_000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        deletedAt: null,
        session: {
          startsAt: { gt: now, lte: upperBound },
          deletedAt: null,
        },
      },
      include: {
        user: true,
        session: {
          include: {
            class: true,
            instructor: { include: { user: true } },
            room: { include: { location: true } },
          },
        },
      },
    });

    if (bookings.length === 0) return;

    this.logger.log(`Found ${bookings.length} booking(s) eligible for reminder`);

    for (const booking of bookings) {
      try {
        const alreadyNotified = await this.prisma.notification.findFirst({
          where: {
            userId: booking.userId,
            type: 'REMINDER',
            payload: { path: ['bookingId'], equals: booking.id },
          },
        });

        if (alreadyNotified) {
          this.logger.debug(`Booking ${booking.id} already reminded — skipping`);
          continue;
        }

        const perthStart = toPerth(booking.session.startsAt);
        const sessionDate = perthStart.toFormat('d MMMM yyyy');
        const sessionTime = perthStart.toFormat('h:mm a');
        const instructorName = booking.session.instructor?.user?.name ?? 'TBA';
        const locationName = booking.session.room?.location?.name ?? '';
        const locationAddress = booking.session.room?.location?.address ?? '';

        await this.notifications.dispatch(booking.userId, 'REMINDER', {
          toEmail: booking.user.email,
          toName: booking.user.name,
          subject: `Reminder: ${booking.session.class.title} on ${sessionDate} at ${sessionTime}`,
          html: `<p>Hi ${booking.user.name},</p><p>This is a reminder for your upcoming class <strong>${booking.session.class.title}</strong> on ${sessionDate} at ${sessionTime} (Perth).</p><p>Instructor: ${instructorName}</p><p>Location: ${locationName}, ${locationAddress}</p><p>We look forward to seeing you!</p><p style="color:#999;font-size:12px">Booking ID: ${booking.id}</p>`,
          bookingId: booking.id,
          sessionDate,
          sessionTime,
          instructorName,
          locationName,
          locationAddress,
        });

        this.logger.log(`Queued REMINDER for booking ${booking.id}`);
      } catch (err) {
        this.logger.error(`Failed to send reminder for booking ${booking.id}: ${String(err)}`);
      }
    }
  }

  private async getLeadHours(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'reminder_lead_hours' },
    });
    if (!setting) return ReminderJob.DEFAULT_LEAD_HOURS;
    const value = setting.value as { hours?: number } | number;
    if (typeof value === 'number') return value;
    return typeof (value as { hours?: number }).hours === 'number'
      ? (value as { hours: number }).hours
      : ReminderJob.DEFAULT_LEAD_HOURS;
  }
}
