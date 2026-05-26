# Notifications Module

Creates in-app notification records and dispatches transactional emails via Resend.

## Purpose

- `GET /notifications` — list notifications for the authenticated user (paginated)
- `PATCH /notifications/:id/read` — mark a notification as read
- `PATCH /notifications/read-all` — mark all notifications as read

Email sending is internal only (no direct HTTP trigger); it is called by other services.

## Notification Types

| Type | Trigger |
|------|---------|
| `BOOKING_CONFIRMED` | Booking confirmed after successful payment |
| `BOOKING_CANCELLED` | Booking cancelled by user or admin |
| `WAITLIST_PROMOTED` | Waitlist entry promoted to NOTIFIED |
| `REMINDER` | Upcoming session reminder (sent by `ReminderJob`) |
| `REFUND_ISSUED` | Refund processed against a booking |

## Email Templates

Templates live in `packages/emails/src/templates/` and are rendered with React Email:

| Template | Usage |
|----------|-------|
| `BookingConfirmation.tsx` | Sent on `BOOKING_CONFIRMED` |
| `BookingCancellation.tsx` | Sent on `BOOKING_CANCELLED` |
| `WaitlistPromotion.tsx` | Sent on `WAITLIST_PROMOTED` |
| `Reminder.tsx` | Sent on `REMINDER` |

## Env vars

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key for email dispatch |

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1notifications`.
