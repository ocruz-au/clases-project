# Waitlists Module

Manages waitlist entries for fully-booked sessions and automatic promotion when a spot opens.

## Purpose

- `POST /waitlists` — join the waitlist for a session
- `GET /waitlists` — list waitlist entries for the authenticated user
- `DELETE /waitlists/:id` — leave the waitlist
- `GET /admin/sessions/:id/waitlist` — view full waitlist for a session (ADMIN)
- `POST /admin/sessions/:id/waitlist/:entryId/promote` — manually promote a waitlist entry (ADMIN)

## Auto-Promotion Flow

1. A booking is cancelled → `BookingsService` emits a "spot freed" event
2. `WaitlistService.promoteNext()` finds the oldest `WAITING` entry for that session
3. The entry transitions to `NOTIFIED`; a `WAITLIST_PROMOTED` notification is sent to the user
4. If the user books within the hold window the entry transitions to `CONVERTED`; otherwise it expires back to the next candidate

## Statuses

| Status | Meaning |
|--------|---------|
| `WAITING` | In queue, no spot available yet |
| `NOTIFIED` | Offered a spot; hold window active |
| `CONVERTED` | User booked the offered spot |
| `EXPIRED` | Offer window passed without booking |

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1waitlists`.
