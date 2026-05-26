# Bookings Module

Manages the full booking lifecycle: seat holds, confirmation, cancellation, and attendance marking.

## Purpose

- `POST /bookings` — create a confirmed booking (requires active seat hold)
- `GET /bookings` — list bookings for the authenticated user
- `GET /bookings/:id` — get booking details
- `DELETE /bookings/:id` — cancel a booking (soft-delete, refund policy applied)
- `PATCH /bookings/:id/attendance` — mark ATTENDED or NO_SHOW (INSTRUCTOR / ADMIN)

## Seat Hold Flow

1. Client calls `POST /seat-holds` with `sessionId` → hold created with a TTL (default 10 min, configurable via `seatHoldWindowMinutes` setting)
2. Client completes Stripe checkout → webhook fires `payment_intent.succeeded`
3. `BookingsService.confirmFromPayment()` converts the hold into a `CONFIRMED` booking

## Cancellation

- `CancellationPolicyService` evaluates the active policy (configurable default via `defaultCancellationPolicyId` setting)
- Refunds are issued through `PaymentsService.issueRefund()`
- The booking is soft-deleted (`deletedAt` set) rather than removed

## Key Services

| Service | Responsibility |
|---------|---------------|
| `BookingsService` | CRUD, confirmation, status transitions |
| `SeatHoldService` | TTL-based seat reservation before payment |
| `CancellationPolicyService` | Evaluate refund eligibility and percentage |

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1bookings`.
