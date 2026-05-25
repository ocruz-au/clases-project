# Quickstart: Class Booking Platform (Perth)

**Feature**: `001-class-booking-platform` | **Date**: 2026-05-24

This guide gets a developer from clone to a running stack with seeded data.

## Prerequisites

- Node.js 20+ and pnpm 9+
- PostgreSQL 16 (local or Docker)
- A Stripe account in test mode + the Stripe CLI (for local webhook forwarding)
- A Resend API key (test/dev)

## 1. Install

```bash
pnpm install
```

## 2. Configure environment

Copy the example env files and fill in secrets (validated at boot by a Zod env schema; the app
refuses to start if any required variable is missing — Constitution IV):

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js / JWT signing secret (shared between web and api) |
| `STRIPE_SECRET_KEY` | Stripe server key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key |
| `APP_TIMEZONE` | `Australia/Perth` |
| `SEAT_HOLD_WINDOW_MINUTES` | Default checkout/promotion hold window (e.g. `10`) |

## 3. Set up the database

```bash
pnpm --filter @app/db prisma migrate dev      # apply migrations
pnpm --filter @app/db run seed                # seed roles, demo location/room/category,
                                              # an instructor, a class + generated sessions,
                                              # and test users (student/instructor/admin/super admin)
```

## 4. Run the stack

```bash
pnpm dev        # turbo runs apps/web (Next.js) and apps/api (NestJS) together
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1 (OpenAPI/Swagger at /api/docs)

In a separate terminal, forward Stripe webhooks to the API:

```bash
stripe listen --forward-to localhost:3001/api/v1/payments/stripe/webhook
```

## 5. Verify the MVP flows

**Book + pay (US1)**

1. Log in as the seeded student.
2. Browse sessions, filter by date/category, open a session with open seats.
3. Click Book → you are redirected to Stripe Checkout (a seat hold is now active).
4. Pay with test card `4242 4242 4242 4242`.
5. The webhook confirms the booking; you receive a confirmation email and see it in booking history.

**Waitlist promotion (US2)**

1. Fill a session to capacity; as another student, join the waitlist.
2. Cancel a confirmed booking on that session.
3. The waitlisted student receives a promotion email with a seat hold + deadline; paying within the
   window confirms their booking. Letting the hold expire promotes the next entry.

**Admin (US3)**

1. Log in as admin; create a category/location/room/class and an availability rule.
2. Generate sessions and confirm they appear bookable with Perth-local times.
3. Open a session's waitlist and try remove/skip/promote.

## 6. Run the tests

```bash
pnpm test            # unit + integration (integration uses a real Postgres test database)
pnpm test:api        # Supertest API tests (auth, booking, payment, admin, instructor)
pnpm test:e2e        # Playwright critical journeys
```

CI runs the same gates required by the constitution (type-check, lint, tests with ≥80% domain
coverage, dependency audit, accessibility lint) and blocks merge on failure.

## Notes

- All wall-clock times are stored UTC and displayed in `Australia/Perth`.
- No card data is ever stored locally; Stripe handles all card details.
- Business records are soft-deleted; nothing is hard-deleted.
