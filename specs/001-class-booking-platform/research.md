# Phase 0 Research: Class Booking Platform (Perth)

**Feature**: `001-class-booking-platform` | **Date**: 2026-05-24

This document resolves the technical unknowns implied by the feature spec and the user-provided
technical direction (modular monolith; Next.js + NestJS + PostgreSQL + Prisma; Auth.js or Clerk;
Stripe; Resend; Zod or class-validator). Each decision lists rationale and alternatives considered.

---

## 1. Overall architecture — modular monolith in a monorepo

- **Decision**: A single deployable system organized as a **monorepo** (pnpm workspaces + Turborepo)
  with two apps and shared packages:
  - `apps/web` — Next.js (App Router) for the student/instructor/admin UI.
  - `apps/api` — NestJS for the backend, internally split into the required feature modules.
  - `packages/db` — Prisma schema, generated client, migrations, and seed.
  - `packages/shared` — Zod schemas + inferred TypeScript types shared by web and api.
  - `packages/emails` — React Email templates rendered for Resend.
- **Rationale**: The spec's transactional invariants (no overbooking, atomic booking/payment/waitlist)
  are far simpler to guarantee inside one process against one database than across services. A
  modular monolith keeps clear module boundaries (Constitution I) while preserving single-transaction
  integrity (Constitution VI, FR-027). The user explicitly excluded microservices.
- **Alternatives considered**: (a) Microservices — rejected per user and because distributed
  transactions would jeopardize FR-008/FR-027. (b) Next.js API routes only (no NestJS) — rejected
  because NestJS modules, guards, interceptors, and DI map directly to the requested module list and
  to RBAC/audit middleware needs.

## 2. Frontend/backend split and how they communicate

- **Decision**: `apps/web` (Next.js) calls `apps/api` (NestJS) over a versioned REST API (`/api/v1`).
  Server Components/route handlers in Next.js proxy authenticated requests; the browser never holds
  raw secrets. Shared request/response types come from `packages/shared`.
- **Rationale**: Clean separation of presentation and business logic (Constitution I). REST is
  sufficient for the CRUD + workflow surface; it keeps contracts explicit and testable (FR-level
  acceptance).
- **Alternatives considered**: tRPC (tight coupling, less language-agnostic contract); GraphQL
  (over-powered for this surface, more infra). REST chosen for simplicity and contract clarity.

## 3. Authentication — Auth.js (NextAuth v5) with Prisma adapter

- **Decision**: Use **Auth.js (NextAuth v5)** in `apps/web` with the **Prisma adapter**, credentials +
  database sessions, issuing a signed JWT that the NestJS API validates via a Passport JWT strategy
  using a shared secret/JWKS. Passwords hashed with Argon2id. TOTP-based MFA enforced for `admin` and
  `super admin` (and optional for instructors).
- **Rationale**: Self-hosted keeps all user/identity data in our PostgreSQL, which aligns with audit
  logging (FR-028), soft delete (FR-029), and avoids exporting user data to a third party. Free, and
  integrates natively with Next.js while remaining verifiable by NestJS.
- **Alternatives considered**: **Clerk** — excellent built-in MFA and UI, but it is an external SaaS
  holding user data, adds per-MAU cost, and complicates self-hosted audit/soft-delete guarantees.
  Kept as a fallback if managed MFA/identity becomes a priority. Trade-off accepted: with Auth.js we
  implement MFA (TOTP) ourselves, satisfying Constitution IV.

## 4. Validation — Zod as the shared single source of truth

- **Decision**: Define all input schemas in **Zod** inside `packages/shared`; the Next.js forms and the
  NestJS endpoints both validate against the same schemas. NestJS uses a custom `ZodValidationPipe`.
- **Rationale**: One schema validates on both client and server (FR-level testability, Constitution V
  "validation at the boundary"), and `z.infer` gives end-to-end types under TypeScript strict mode
  (Constitution II). Eliminates drift between FE and BE contracts.
- **Alternatives considered**: **class-validator + class-transformer** (NestJS default) — idiomatic in
  Nest but DTO decorators are not reusable in the Next.js client and duplicate validation logic. Zod
  chosen for cross-boundary reuse.

## 5. Preventing overbooking and duplicate bookings (the core invariant)

- **Decision**: Enforce capacity at the **database** level inside a serializable transaction:
  1. A `Booking`/`SeatHold` model where the count of `(active holds + confirmed bookings)` for a
     session must never exceed `session.capacity`.
  2. On hold creation: `BEGIN; SELECT ... FROM class_session WHERE id = ? FOR UPDATE;` (row lock),
     recount active holds + confirmed bookings, insert hold only if `count < capacity`, `COMMIT`.
     The row lock serializes concurrent claimants so exactly one wins the last seat (FR-008, SC-002).
  3. Duplicate prevention: a **partial unique index** on `(class_session_id, user_id)` covering active
     statuses (held/confirmed), so a student cannot double-book the same session (FR-009, SC-003).
- **Rationale**: Application-level checks alone race under concurrency; DB constraints + row locks are
  the authoritative guard (Constitution VI). Prisma supports interactive transactions and raw locking.
- **Alternatives considered**: PostgreSQL advisory locks (works, but less self-documenting than a row
  lock on the session); `EXCLUDE` constraints (powerful but harder to express for a dynamic count);
  optimistic version column with retry (viable, kept as an optimization). Row lock chosen for clarity
  and correctness first.

## 6. Seat holds and expiry

- **Decision**: A `SeatHold` row carries `expires_at`. Holds are created at checkout start and on
  waitlist promotion. Expiry is handled two ways: (a) **lazy** — any capacity recount ignores holds
  past `expires_at`; (b) **sweep** — a NestJS `@Cron` job every minute marks expired holds released,
  restores capacity, and triggers waitlist promotion (FR-010, FR-019, SC-004). Hold window is a
  configurable global setting (default e.g. 10 minutes).
- **Rationale**: Lazy checks keep correctness even if the sweeper lags; the sweeper drives
  time-based side effects (promotion, capacity display). No extra infra required for MVP.
- **Alternatives considered**: Redis TTL keys for holds (fast, but adds Redis and splits the source of
  truth from Postgres, risking divergence from the transactional invariant). Deferred until scale
  requires it.

## 7. Stripe payments and webhook confirmation

- **Decision**: Use **Stripe Checkout Sessions**. Flow: student begins checkout → create seat hold +
  Stripe Checkout Session (expiry aligned to hold window) → redirect to Stripe → on
  `checkout.session.completed` / `payment_intent.succeeded` webhook (signature verified with
  `stripe.webhooks.constructEvent`), confirm the booking inside a transaction. Refunds via Stripe
  Refunds API. **No card data is stored** (FR-016).
- **Idempotency**: Persist every processed Stripe event `id` in a `processed_webhook_event` table;
  reject duplicates so repeated deliveries never double-confirm (FR-013, SC-006). Use Stripe
  idempotency keys on refund/charge calls.
- **Reconciliation**: If a webhook arrives after hold expiry, reconcile deterministically — honor the
  paid seat if capacity allows, otherwise auto-refund and notify (edge cases in spec).
- **Rationale**: Checkout offloads PCI scope to Stripe (Constitution VIII) and webhooks are the only
  trustworthy confirmation signal. Signature verification is mandatory (Constitution VIII).
- **Alternatives considered**: Payment Intents with a custom card form (more PCI surface, more UI
  work) — rejected for MVP. Confirming on client redirect only (insecure, can be spoofed) — rejected;
  webhook is authoritative.

## 8. Waitlist promotion engine

- **Decision**: `WaitlistEntry` rows hold an ordered `position` and status per session. When a seat
  frees (cancellation, expired hold, admin action), a transactional promotion routine selects the next
  eligible entry, creates a seat hold + Stripe checkout, sends a promotion email with the deadline, and
  marks the entry `OFFERED`. On payment → `CONVERTED`; on expiry/failure → next entry (FR-017–FR-020).
  Admin overrides (remove/skip/manual promote) mutate the queue and are audited.
- **Rationale**: Keeping promotion inside DB transactions preserves the no-overbooking invariant while
  a seat is "in flight" to a waitlisted student.
- **Alternatives considered**: Broadcasting a freed seat to all waitlisters first-come-first-served —
  rejected; it breaks fair ordering and risks oversell.

## 9. Timezone handling — Australia/Perth

- **Decision**: Store all timestamps as `timestamptz` (UTC) in PostgreSQL. Admins define session times
  in **Australia/Perth** local time; the app converts to UTC for storage and back to Perth for display
  using **Luxon** (or `date-fns-tz`) with the IANA zone `Australia/Perth`. Report date ranges are
  computed in Perth local time (FR-006, SC-008).
- **Rationale**: UTC storage + explicit IANA zone is the standard correct approach. Perth is UTC+8 with
  no DST today, but storing tz-aware and converting via IANA keeps the system correct if that changes.
- **Alternatives considered**: Storing naive local times (ambiguous, error-prone) — rejected.

## 10. Email notifications — Resend + React Email

- **Decision**: Use **Resend** with **React Email** templates in `packages/emails` for confirmation,
  cancellation, waitlist-promotion, and reminder emails (FR-026). Emails are dispatched **after** the
  database transaction commits (never inside it), via the same cron/worker that handles time-based
  jobs; reminders are scheduled by a cron sweep at the configured lead time.
- **Rationale**: Sending after commit avoids emailing about state that later rolls back. React Email
  gives typed, testable templates.
- **Alternatives considered**: SES/SMTP (more setup), inline send inside transactions (rejected — can
  email on a rolled-back booking).

## 11. Background jobs and scheduling

- **Decision**: Use **`@nestjs/schedule`** cron jobs for: expired-hold sweep, waitlist promotion
  follow-up, and reminder emails. No Redis for MVP.
- **Rationale**: Lowest infra footprint that satisfies FR-010/FR-019/FR-026. Single-instance cron is
  fine at launch scale.
- **Alternatives considered**: **BullMQ + Redis** for durable, retryable, multi-instance job queues —
  documented as the scale-up path when the app runs multiple instances; deferred to avoid premature
  infrastructure.

## 12. Security middleware — guards, rate limiting, audit

- **Decision**:
  - **RBAC**: a NestJS `RolesGuard` + `@Roles()` decorator enforce roles at the route, and service
    methods re-check authority for sensitive operations (Constitution III).
  - **Rate limiting**: `@nestjs/throttler` on auth and booking/checkout endpoints.
  - **Audit**: a NestJS interceptor/middleware writes append-only `AuditLog` entries for all
    state-changing actions, capturing actor, action, target, before/after, IP, timestamp (FR-028).
  - **Secrets**: all secrets via environment variables validated at boot with a Zod env schema; no
    secrets in source.
- **Rationale**: Directly satisfies Constitution III, IV, VII and FR-027/FR-028.
- **Alternatives considered**: Logging audit from each service by hand (error-prone, easy to miss) —
  rejected in favor of a centralized interceptor plus explicit before/after capture in transactional
  services.

## 13. Soft delete

- **Decision**: Add `deleted_at timestamptz NULL` to business entities; a Prisma middleware/extension
  filters `deleted_at IS NULL` by default and rewrites deletes as updates (FR-029, SC-010). Audit and
  reporting can still read soft-deleted rows explicitly.
- **Rationale**: Preserves history and audit trails (Constitution VI).
- **Alternatives considered**: Hard delete with archive tables (more moving parts) — rejected.

## 14. Testing strategy

- **Decision**:
  - **Unit** (Jest): domain logic — capacity math, hold expiry, cancellation-policy refund
    calculation, waitlist ordering, coupon rules.
  - **Integration** (Jest + a real PostgreSQL via Testcontainers or a dedicated test DB): repository
    + transaction behavior, including concurrent last-seat claims and webhook idempotency.
  - **API** (Supertest against the Nest app): auth, booking, payment (Stripe mocked at the SDK
    boundary with verified-signature fixtures), admin, and instructor workflows.
  - **E2E** (Playwright): the critical journeys — book+pay, waitlist promotion, cancel+refund.
  - CI gates per Constitution X (≥80% domain coverage, all green blocks merge).
- **Rationale**: Matches Constitution X and the user's explicit request for unit/integration/API tests
  across auth, booking, payment, admin, instructor workflows. Real DB for integration per the
  constitution's intent (DB invariants are the whole point and must not be mocked away).
- **Alternatives considered**: Mocking the database in integration tests — rejected; it would hide the
  exact concurrency/constraint behavior these tests exist to verify.

## 15. API contract format

- **Decision**: Document the REST surface with **OpenAPI 3.1** generated from NestJS (`@nestjs/swagger`)
  and kept in `contracts/`. The Stripe webhook contract is documented separately.
- **Rationale**: Constitution XI requires OpenAPI for every endpoint and contract validation in CI.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| Auth.js vs Clerk | Auth.js (NextAuth v5) + Prisma adapter; TOTP MFA for admin/super admin |
| Zod vs class-validator | Zod shared schemas in `packages/shared` + NestJS ZodValidationPipe |
| Monolith vs services | Modular monolith in a pnpm + Turborepo monorepo (no microservices) |
| Overbooking guard | Row-lock transaction on session + partial unique index for duplicates |
| Seat-hold expiry | `expires_at` + lazy recount + per-minute cron sweep |
| Stripe confirmation | Checkout Sessions; webhook signature verified; event-id idempotency |
| Timezone | UTC `timestamptz` storage, Perth (IANA) conversion via Luxon |
| Email | Resend + React Email, dispatched post-commit; cron reminders |
| Background jobs | `@nestjs/schedule` cron for MVP; BullMQ+Redis as scale path |
| Testing | Jest unit/integration (real PG), Supertest API, Playwright E2E |

No open `NEEDS CLARIFICATION` items remain for planning.
