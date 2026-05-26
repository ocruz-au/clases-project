# Payments Module

Handles Stripe checkout session creation, webhook processing, and refund issuance.

## Purpose

- `POST /payments/checkout` — create a Stripe Checkout Session for a seat hold
- `POST /payments/webhook` — receive and verify Stripe webhook events
- `POST /payments/:id/refund` — issue a full or partial refund (ADMIN)
- `GET /payments/:id` — get payment details (ADMIN)

## Checkout Flow

1. Client calls `POST /payments/checkout` with `seatHoldId` → `PaymentsService` creates a Stripe Checkout Session
2. User completes payment on the Stripe-hosted page
3. Stripe sends `payment_intent.succeeded` to `POST /payments/webhook`
4. Webhook handler verifies the signature (`STRIPE_WEBHOOK_SECRET`), confirms the booking, and updates the `Payment` row to `SUCCEEDED`

## Refund Flow

- Full refund: `stripe.refunds.create({ payment_intent: ... })`
- Partial refund: amount calculated by `CancellationPolicyService`
- Payment row transitions to `REFUNDED` or `PARTIALLY_REFUNDED`

## Env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification secret |

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1payments`.
