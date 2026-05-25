# Implementation Plan: Class Booking Platform (Perth)

**Branch**: `001-class-booking-platform` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-class-booking-platform/spec.md`

## Summary

Build a secure, modular-monolith web application for booking classes in Perth. Students browse and
book classes, pay via Stripe, join waitlists, and cancel for policy-based refunds; instructors manage
attendance; admins manage the catalog, schedules, waitlists, payments, and reports; super admins
manage global/security settings. The core technical challenge is guaranteeing no overbooking and no
duplicate bookings under concurrency, with transaction-safe seat holds, Stripe webhook-confirmed
payments, automatic waitlist promotion, audit logging, soft delete, and Australia/Perth timezone
correctness. Approach: a pnpm + Turborepo monorepo with a Next.js web app and a NestJS API over
PostgreSQL/Prisma, using row-locked transactions plus database constraints as the authoritative
integrity guard (see [research.md](./research.md) and [data-model.md](./data-model.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Next.js (App Router), NestJS, Prisma ORM, PostgreSQL 16, Auth.js (NextAuth
v5) + Prisma adapter, Zod (shared validation), Stripe (Checkout + webhooks), Resend + React Email,
Luxon (timezone), `@nestjs/throttler` (rate limiting), `@nestjs/schedule` (cron jobs)

**Storage**: PostgreSQL 16 (single database; `timestamptz` UTC storage)

**Testing**: Jest (unit + integration), Supertest (API), Playwright (E2E); integration tests run
against a real PostgreSQL (Testcontainers or dedicated test DB)

**Target Platform**: Web (server-rendered + API), Linux server deployment

**Project Type**: Web application (frontend + backend) — modular monolith in a monorepo

**Performance Goals**: Registration→confirmed booking < 5 min (SC-001); freed seat offered to next
waitlister < 1 min (SC-005); refunds initiated < 1 min (SC-009)

**Constraints**: Zero overbooking under concurrency (SC-002); zero duplicate bookings (SC-003);
idempotent webhook handling (SC-006); 100% audit coverage of state changes (SC-007); no hard deletes
(SC-010); all times correct in Australia/Perth (SC-008); no raw card data stored (FR-016)

**Scale/Scope**: Single Perth business; ~15 backend modules; MVP = auth, roles, users, classes,
schedules, bookings, capacity control, cancellation, waitlist, Stripe Checkout + webhook, emails,
admin dashboard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies |
|---|-----------|------------------------|
| I | Clean Architecture | Modular monolith; NestJS feature modules; domain logic isolated from controllers/UI; no circular deps |
| II | TypeScript Strict Mode | `strict: true` across the monorepo; Zod-inferred types; `any` only at external boundaries |
| III | RBAC | `RolesGuard` + `@Roles()` at routes **and** authority re-checks in services; central role definitions |
| IV | Secure Authentication | Auth.js + Argon2id; httpOnly cookie/JWT; TOTP MFA for admin/super admin; Zod-validated env secrets |
| V | Input Validation | Zod schemas at the API boundary (shared with web); parameterized queries via Prisma |
| VI | Database Integrity | Prisma migrations; FK/NOT NULL/unique + partial unique indexes; row-locked transactions; soft delete |
| VII | Audit Logging | Append-only `AuditLog` via a NestJS interceptor + explicit before/after in transactional services |
| VIII | Payment Security | Stripe Checkout (no card data stored); webhook signature verification; idempotency keys |
| IX | Accessibility & Responsive UI | WCAG 2.1 AA, keyboard nav, design tokens; `axe-core` lint gate |
| X | Automated Testing | Unit/integration/API/E2E; ≥80% domain coverage; real DB for integration; CI blocks on failure |
| XI | Clear Documentation | OpenAPI 3.1 (`contracts/`), module READMEs, ADRs for non-obvious choices |
| XII | Incremental Delivery | MVP modules first; each module has a contract before implementation; feature flags for incomplete work |

**Result**: PASS — no violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-class-booking-platform/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── openapi.yaml
│   └── stripe-webhook.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/
├── web/                         # Next.js (App Router) — UI for student/instructor/admin/super admin
│   ├── src/
│   │   ├── app/                 # routes (public, student, instructor, admin, super-admin)
│   │   ├── components/          # accessible, responsive components (design tokens)
│   │   └── lib/                 # API client, Auth.js config, formatting (Perth tz)
│   └── tests/                   # component + Playwright E2E
└── api/                         # NestJS — backend modules
    ├── src/
    │   ├── modules/
    │   │   ├── auth/            # Auth.js JWT validation, MFA, guards
    │   │   ├── users/
    │   │   ├── roles/
    │   │   ├── instructors/
    │   │   ├── classes/
    │   │   ├── schedules/       # availability rules → session generation
    │   │   ├── bookings/        # checkout, seat holds, capacity, status workflow
    │   │   ├── waitlists/       # ordering + promotion engine
    │   │   ├── payments/        # Stripe Checkout + webhook + refunds
    │   │   ├── notifications/   # Resend emails (post-commit dispatch)
    │   │   ├── audit-logs/      # append-only audit interceptor + store
    │   │   ├── reports/
    │   │   ├── settings/        # global + security settings (super admin)
    │   │   ├── coupons/
    │   │   └── reviews/         # post-MVP
    │   ├── common/             # RolesGuard, ZodValidationPipe, throttler, soft-delete, tz utils
    │   └── jobs/               # @nestjs/schedule: hold sweep, promotion, reminders
    └── tests/
        ├── integration/        # real-Postgres repo + transaction/concurrency tests
        └── api/                # Supertest workflow tests

packages/
├── db/                          # Prisma schema, migrations, seed
├── shared/                      # Zod schemas + inferred types (used by web + api)
└── emails/                      # React Email templates
```

**Structure Decision**: Web application (Option 2) realized as a Turborepo monorepo. `apps/web`
(Next.js) and `apps/api` (NestJS) are separate deployables sharing `packages/shared` (Zod contracts)
and `packages/db` (Prisma). The NestJS module list maps 1:1 to the modules named in the user's
technical direction, satisfying Constitution I and XII.

## Complexity Tracking

> No constitution violations — this section intentionally left empty.

## Phase 2 note

Task generation (`tasks.md`) is produced by `/speckit-tasks`, organized by user story (P1 MVP first:
auth/roles/users → classes/schedules → bookings/capacity/cancellation → waitlist → Stripe
Checkout/webhook → emails → admin dashboard), with tests per Constitution X.
