import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'CANCELLATION'
  | 'WAITLIST_PROMOTION'
  | 'REMINDER';

export interface NotificationPayload {
  subject: string;
  html: string;
  toEmail: string;
  toName: string;
  [key: string]: unknown;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly resend: Resend | null;
  private readonly emailFrom: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.emailFrom = config.get<string>('EMAIL_FROM') ?? 'noreply@bookingplatform.au';
  }

  async dispatch(userId: string, type: NotificationType, payload: NotificationPayload): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: { userId, type, channel: 'EMAIL', payload, status: 'PENDING' },
    });

    // Fire-and-forget after DB record created
    this.sendEmail(notification.id, payload).catch((err) =>
      this.logger.error(`Failed to send notification ${notification.id}: ${String(err)}`),
    );
  }

  private async sendEmail(notificationId: string, payload: NotificationPayload): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured — skipping email send');
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.emailFrom,
        to: [`${payload.toName} <${payload.toEmail}>`],
        subject: payload.subject,
        html: payload.html,
      });

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Resend error for notification ${notificationId}: ${String(err)}`);
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'FAILED' },
      });
    }
  }
}
