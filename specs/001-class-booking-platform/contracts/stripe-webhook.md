# Contract: Stripe Webhook Handling

**Endpoint**: `POST /api/v1/payments/stripe/webhook`
**Auth**: None (public), but every request MUST pass Stripe signature verification.

## Security

- Read the raw request body (do not parse before verification).
- Verify with `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)`
  (Constitution VIII, FR-012).
- On signature failure → respond `400` and process nothing.

## Idempotency (FR-013, SC-006)

- Before handling, check `ProcessedWebhookEvent` for `event.id`.
- If present → respond `200` and do nothing (duplicate delivery).
- Otherwise handle inside a DB transaction and insert `ProcessedWebhookEvent(event.id)` in the same
  transaction so a retry can never double-apply.

## Handled events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Locate booking via `stripeCheckoutSessionId`. In a transaction: re-verify the seat hold is still valid; set `Payment.status=SUCCEEDED`, `Booking.status=CONFIRMED`, consume the `SeatHold`; if the entry came from the waitlist, mark `WaitlistEntry.status=CONVERTED`. Queue a confirmation email post-commit. |
| `payment_intent.payment_failed` | Set `Payment.status=FAILED`, release the `SeatHold`, set `Booking.status=EXPIRED`, restore capacity, and trigger waitlist promotion for the freed seat. |
| `checkout.session.expired` | Same release/restore path as a failed payment. |
| `charge.refunded` | Update `Payment.status` to `REFUNDED` or `PARTIALLY_REFUNDED` and the related `Refund.status=SUCCEEDED`. |

## Reconciliation edge case

If `checkout.session.completed` arrives **after** the seat hold expired:

- If the session still has capacity → honor the seat (confirm booking).
- If the session is now full → automatically issue a refund (Stripe Refunds API with an idempotency
  key) and notify the student. Never leave a charge without a seat or a seat without a charge.

## Response

- Always respond `200` once the event is durably recorded (even if a follow-up email is queued
  asynchronously), so Stripe stops retrying. Respond non-2xx only when the event was not persisted.

## Audit (FR-028)

Every state change triggered by a webhook writes an `AuditLog` entry with `actorId=null` (system),
the action (e.g. `BOOKING_CONFIRMED`, `PAYMENT_FAILED`, `SEAT_HOLD_RELEASED`), and before/after state.
