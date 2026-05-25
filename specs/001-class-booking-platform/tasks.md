---

description: "Task list for Class Booking Platform (Perth)"
---

# Tasks: Class Booking Platform (Perth)

**Input**: Design documents from `/specs/001-class-booking-platform/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — the spec explicitly requests unit, integration, and API tests for auth,
booking, payment, admin, and instructor workflows. Playwright E2E for critical journeys.

**Organization**: Phases 1–2 establish the monorepo and shared infrastructure. Phases 3–5 are the
P1 MVP (book+pay, waitlist, admin catalog). Phases 6–8 add P2 features. Phases 9–11 add P3
features. Phase 12 polishes cross-cutting concerns.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependency on incomplete tasks)
- **[Story]**: User story label (US1–US9 from spec.md)

---

## Phase 1: Setup

**Purpose**: Monorepo initialization, tooling, shared package scaffolding.

- [x] T001 Initialize Turborepo monorepo: create `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/emails` with pnpm workspaces (`pnpm-workspace.yaml`, `turbo.json`)
- [x] T002 [P] Configure TypeScript strict mode across all packages: `tsconfig.base.json` at root with `"strict": true`, extend in each app/package (`tsconfig.json`)
- [x] T003 [P] Configure ESLint + Prettier for all packages (`eslint.config.mjs`, `.prettierrc`)
- [x] T004 [P] Scaffold `packages/shared`: barrel `src/index.ts`, Zod env schemas for api (`src/env/api.env.ts`) and web (`src/env/web.env.ts`), timezone util stub (`src/tz.ts`)
- [x] T005 [P] Scaffold `packages/emails`: install `react-email`, create shared layout component (`src/layout.tsx`) and email barrel (`src/index.ts`)
- [x] T006 [P] Configure CI pipeline (`.github/workflows/ci.yml`): type-check, lint, test (unit+integration), API tests, OWASP `npm audit`, axe-lint gate — all must pass before merge

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema + migrations, shared infrastructure, auth, RBAC, and audit — must be
complete before any user story implementation can begin.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [x] T007 Define complete Prisma schema in `packages/db/prisma/schema.prisma`: all entities from `data-model.md` (User, Role, UserRole, InstructorProfile, Category, Location, Room, Class, AvailabilityRule, ClassSession, Booking, SeatHold, WaitlistEntry, Payment, Refund, Coupon, CancellationPolicy, Notification, AuditLog, ProcessedWebhookEvent, Setting) with `timestamptz` UTC, soft-delete `deletedAt`, FK constraints, `@unique` and `@index` decorators
- [x] T008 [P] Add concurrency indexes to Prisma schema: partial unique index on `Booking(classSessionId, userId)` for active statuses (raw SQL migration); `ClassSession` index on `(startsAt, status)`; `AuditLog` index on `(resourceType, resourceId)`; `ProcessedWebhookEvent` PK on Stripe event id
- [x] T009 Run Prisma migrations to create all tables: `packages/db/prisma/migrations/` (initial migration)
- [x] T010 [P] Implement Prisma soft-delete extension in `packages/db/src/soft-delete.ts`: intercept `findMany`/`findFirst`/`findUnique` to filter `deletedAt IS NULL`; rewrite `delete`/`deleteMany` as `update` setting `deletedAt`
- [x] T011 [P] Implement timezone utility in `packages/shared/src/tz.ts` using Luxon: `toPerth(utcDate)`, `fromPerth(localDate)`, `dateRangeUTC(fromDate, toDate, tz)` for report queries
- [x] T012 Bootstrap NestJS `AppModule` in `apps/api/src/app.module.ts`: register `ConfigModule` (Zod env validation), `PrismaModule`, `ThrottlerModule` (rate limiting), `ScheduleModule` (cron), global `AuditLogInterceptor`
- [x] T013 [P] Implement `ZodValidationPipe` in `apps/api/src/common/pipes/zod-validation.pipe.ts` and `@Validate(schema)` decorator
- [x] T014 Implement auth module in `apps/api/src/modules/auth/`: JWT Passport strategy (validates Auth.js-issued JWS), `RolesGuard`, `@Roles()` decorator, TOTP MFA verification endpoint, rate-limited login guard
- [x] T015 Implement Auth.js (NextAuth v5) in `apps/web/src/lib/auth.ts` and `apps/web/src/app/api/auth/[...nextauth]/route.ts`: Prisma adapter, Argon2id credentials provider, httpOnly JWT cookie, session shape with `userId` + `roles`
- [x] T016 [P] Implement `AuditLogInterceptor` + `AuditLogService` (append-only) in `apps/api/src/modules/audit-logs/`: capture `actorId`, `action`, `resourceType`, `resourceId`, `beforeState`, `afterState`, `ipAddress`, `createdAt` — no update/delete on `AuditLog` rows
- [x] T017 [P] Implement `UsersModule` in `apps/api/src/modules/users/`: `UserService` (create, read, list, soft-delete), `UserRepository` with Prisma, Zod-validated DTOs from `packages/shared`
- [x] T018 [P] Implement `RolesModule` in `apps/api/src/modules/roles/`: seed-driven role list, role-to-permission map
- [x] T019 [P] Create Prisma seed script in `packages/db/prisma/seed.ts`: 4 roles, Perth `Location` + `Room` (capacity 20), 1 `Category`, 1 `Class`, 1 `AvailabilityRule`, 10 `ClassSession` rows (Perth local times), 4 test `User` rows (student/instructor/admin/super admin with bcrypt-hashed passwords), default `CancellationPolicy`, default `Setting` rows
- [x] T020 [P] Configure integration test DB: `apps/api/tests/helpers/db.ts` (connect to `DATABASE_URL_TEST`, run migrations before suite, truncate between tests) and Jest `globalSetup` / `globalTeardown`

**Checkpoint**: Foundation complete — user story work can now begin in parallel.

---

## Phase 3: User Story 1 — Student Books and Pays (Priority: P1) 🎯 MVP

**Goal**: A student registers, browses sessions, books, pays via Stripe Checkout, and receives a
confirmation email. The seat hold prevents overbooking during checkout.

**Independent Test**: Seed 1 session with capacity 2. Register a student, begin checkout (hold
created), pay with Stripe test card, verify webhook confirms booking + email queued. Confirm
capacity count correct. Run concurrent hold test to prove no overbooking.

### Tests for User Story 1 ⚠️ Write first — verify they FAIL before implementation

- [x] T021 [P] [US1] Integration test: concurrent last-seat claim — 2 simultaneous requests, exactly 1 succeeds and 1 gets 409 (`apps/api/tests/integration/bookings.concurrent.test.ts`)
- [x] T022 [P] [US1] Integration test: duplicate booking prevention — student re-books same session while holding/confirmed → 409 (`apps/api/tests/integration/bookings.duplicate.test.ts`)
- [x] T023 [P] [US1] API test: auth flow — register → login → JWT issued → protected route accessible (`apps/api/tests/api/auth.test.ts`)
- [x] T024 [P] [US1] API test: full booking workflow — checkout → mock Stripe webhook `checkout.session.completed` → booking `CONFIRMED`, notification queued (`apps/api/tests/api/bookings.test.ts`)

### Implementation for User Story 1

- [x] T025 [P] [US1] Implement `ClassesModule` in `apps/api/src/modules/classes/`: `ClassService` (CRUD with soft-delete), `ClassController` (`GET /api/v1/classes`, Zod-validated), `CategoryService` (CRUD)
- [x] T026 [P] [US1] Implement `SchedulesModule` in `apps/api/src/modules/schedules/`: `SessionService` with list-and-filter endpoint (`GET /api/v1/classes/sessions?dateFrom&dateTo&categoryId&instructorId&locationId`), Perth-tz time display, `seatsAvailable` derived field
- [x] T027 [US1] Implement `SeatHoldService` in `apps/api/src/modules/bookings/seat-hold.service.ts`: `createHold(userId, sessionId, source)` — `BEGIN; SELECT ... FOR UPDATE ON class_session; recount active holds + confirmed bookings; INSERT seat_hold IF count < capacity; COMMIT` — throws `CAPACITY_EXCEEDED` if full; uses configurable `seatHoldWindowMinutes` from `SettingsService`
- [x] T028 [US1] Implement `CheckoutService` in `apps/api/src/modules/payments/checkout.service.ts`: create Stripe Checkout Session (price from class, `metadata.bookingId`, expiry = `holdExpiresAt`), return `CheckoutResult` per `contracts/openapi.yaml`; `POST /api/v1/bookings/checkout`
- [x] T029 [US1] Implement Stripe webhook receiver in `apps/api/src/modules/payments/webhook.controller.ts`: `POST /api/v1/payments/stripe/webhook` — raw-body parsing, `stripe.webhooks.constructEvent` signature check, `ProcessedWebhookEvent` idempotency guard, route to handlers
- [x] T030 [US1] Implement `CheckoutCompletedHandler` in `apps/api/src/modules/payments/handlers/checkout-completed.handler.ts`: transaction — verify hold still valid; set `Payment.status=SUCCEEDED`, `Booking.status=CONFIRMED`, consume `SeatHold`; queue `BOOKING_CONFIRMATION` notification post-commit; audit log
- [x] T031 [US1] Implement `PaymentFailedHandler` in `apps/api/src/modules/payments/handlers/payment-failed.handler.ts`: handles `payment_intent.payment_failed` + `checkout.session.expired` — set `Booking.status=EXPIRED`, `SeatHold.status=RELEASED`, restore capacity count; audit log
- [x] T032 [P] [US1] Create booking confirmation React Email template in `packages/emails/src/templates/BookingConfirmation.tsx`: class name, session date/time (Perth local), instructor, location, amount paid
- [x] T033 [US1] Implement `NotificationsModule` in `apps/api/src/modules/notifications/`: `NotificationService.dispatch(userId, type, payload)` — create `Notification` row `PENDING`, call Resend with appropriate template, update to `SENT`/`FAILED`; always called after DB commit
- [x] T034 [P] [US1] Build Next.js class browse page `apps/web/src/app/(student)/classes/page.tsx`: server component, filter controls (date, category, instructor, location), session cards with `seatsAvailable` indicator, link to session detail
- [x] T035 [US1] Build Next.js checkout flow `apps/web/src/app/(student)/bookings/checkout/`: session detail → "Book Now" POST to `/api/v1/bookings/checkout` → redirect to `stripeCheckoutUrl`; success/cancel pages at `/bookings/checkout/success` and `/cancel`
- [x] T036 [P] [US1] Build Next.js booking history page `apps/web/src/app/(student)/bookings/page.tsx`: list student's bookings with status chips, Perth-local times, link to cancel
- [x] T037 [US1] Unit test: `SeatHoldService` capacity math, hold expiry logic, `BookingStateMachine` valid/invalid transitions (`apps/api/src/modules/bookings/seat-hold.service.spec.ts`)

**Checkpoint**: User Story 1 fully functional — student can register, browse, book, pay, and receive a confirmation email. No overbooking or duplicate bookings.

---

## Phase 4: User Story 2 — Waitlist with Automatic Promotion (Priority: P1)

**Goal**: Students join an ordered waitlist when a class is full. When a seat frees, the system
promotes the next eligible student with a seat hold + payment deadline. Failed/expired holds cascade
to the next entry.

**Independent Test**: Fill a session to capacity. Two students join the waitlist. Cancel a confirmed
booking. Verify: first waitlisted student gets a seat hold + promotion email; let hold expire; verify
second student is promoted.

### Tests for User Story 2 ⚠️ Write first — verify they FAIL before implementation

- [x] T038 [P] [US2] Integration test: FIFO waitlist promotion — cancel booking on full session, verify next WAITING entry promoted, SeatHold created (`apps/api/tests/integration/waitlist.test.ts`)
- [x] T039 [P] [US2] Integration test: hold-expiry cascade — promoted student's hold expires, verify next WAITING entry promoted automatically (`apps/api/tests/integration/waitlist-expiry.test.ts`)
- [x] T040 [P] [US2] API test: join waitlist, view position, admin remove/skip/promote, end-to-end promotion+payment (`apps/api/tests/api/waitlist.test.ts`)

### Implementation for User Story 2

- [x] T041 [US2] Implement `WaitlistModule` in `apps/api/src/modules/waitlists/`: `WaitlistService` — `joinWaitlist(userId, sessionId)` (guard: session must be full; unique entry constraint; append to ordered queue), `getQueueForSession(sessionId)` (ordered by `position`)
- [x] T042 [US2] Implement `WaitlistPromotionService` in `apps/api/src/modules/waitlists/promotion.service.ts`: `promoteNext(sessionId)` — in a transaction: select next `WAITING` entry, call `SeatHoldService.createHold(source=WAITLIST_PROMOTION)`, set entry `status=OFFERED`, `offeredSeatHoldId`; queue `WAITLIST_PROMOTION` email post-commit; audit log
- [x] T043 [US2] Implement hold-expiry cron job in `apps/api/src/jobs/hold-expiry.job.ts` (`@Cron(CronExpression.EVERY_MINUTE)`): find all `ACTIVE` `SeatHold` rows with `expiresAt < now()`; for each: set `status=RELEASED`, set linked `Booking.status=EXPIRED` (if any), call `WaitlistPromotionService.promoteNext(sessionId)` for each affected session; run in a transaction per hold; audit log
- [x] T044 [US2] Update `PaymentFailedHandler` (T031): when `source=WAITLIST_PROMOTION`, additionally set `WaitlistEntry.status=EXPIRED` and call `WaitlistPromotionService.promoteNext(sessionId)` to offer seat to the next entry
- [x] T045 [US2] Implement late-webhook reconciliation in `CheckoutCompletedHandler` (T030): if hold is expired when webhook arrives and session still has capacity → honor and confirm; if session full → initiate Stripe Refunds API call (with idempotency key) + notify student (`apps/api/src/modules/payments/handlers/checkout-completed.handler.ts`)
- [x] T046 [P] [US2] Admin waitlist endpoints in `apps/api/src/modules/waitlists/admin-waitlist.controller.ts`: `GET /admin/waitlist/:sessionId` (ordered queue), `POST /admin/waitlist/entries/:id/action` (REMOVE/SKIP/PROMOTE) — each action in a transaction + audit log
- [x] T047 [P] [US2] Create waitlist-promotion React Email template in `packages/emails/src/templates/WaitlistPromotion.tsx`: class/session details, Perth-local payment deadline, checkout link
- [x] T048 [P] [US2] Build Next.js waitlist join UI `apps/web/src/app/(student)/classes/[id]/waitlist.tsx`: "Join Waitlist" button (shown when `seatsAvailable=0`), position display after joining
- [x] T049 [P] [US2] Build Next.js admin waitlist management view `apps/web/src/app/(admin)/sessions/[id]/waitlist/page.tsx`: ordered queue table, action buttons (Remove / Skip / Promote)
- [x] T050 [US2] Unit test: `WaitlistPromotionService` — ordering logic, OFFERED→EXPIRED cascade to next entry, admin SKIP re-ordering (`apps/api/src/modules/waitlists/waitlist.spec.ts`)

**Checkpoint**: User Stories 1 + 2 independently functional. Waitlist fully cycles through promotion, payment, and expiry.

---

## Phase 5: User Story 3 — Admin Manages Classes, Schedules, and Capacity (Priority: P1)

**Goal**: Admins can build the full booking catalog: categories, locations, rooms, instructors,
classes, availability rules, and generated sessions. They can edit capacity, cancel sessions, and
view/override the waitlist.

**Independent Test**: As admin, create location→room→category→class→availability rule; generate
sessions; verify sessions appear in student browse with Perth-local times and correct capacity.
Cancel a session and confirm student notifications.

### Tests for User Story 3 ⚠️ Write first — verify they FAIL before implementation

- [x] T051 [P] [US3] API test: admin CRUD for category, location, room, class, availability rule; generate-sessions returns correct Perth-tz session times (`apps/api/tests/api/admin.catalog.test.ts`)
- [x] T052 [US3] Unit test: RRULE schedule generator — weekly class, 10 occurrences, Perth local time, correct UTC storage; boundary around midnight Perth (`apps/api/src/modules/schedules/schedule-generator.spec.ts`)

### Implementation for User Story 3

- [x] T053 [P] [US3] Extend `ClassesModule`: `CategoryController` (admin CRUD `/admin/categories`), `LocationController` + `RoomController` (admin CRUD `/admin/locations`, `/admin/rooms`) — all with `@Roles(ADMIN)` guard, soft-delete, audit log
- [x] T054 [P] [US3] Implement `InstructorsModule` in `apps/api/src/modules/instructors/`: `InstructorService` (create/update `InstructorProfile`, list, assign to session), `InstructorController` (admin CRUD `/admin/instructors`)
- [x] T055 [US3] Implement `AvailabilityRuleService` + `ScheduleGeneratorService` in `apps/api/src/modules/schedules/`: parse RRULE, expand occurrences using `rrule` library, convert Perth start times to UTC, insert `ClassSession` rows; `POST /admin/availability-rules/:id/generate`
- [x] T056 [US3] Admin session management in `apps/api/src/modules/schedules/admin-session.controller.ts`: `PATCH /admin/sessions/:id` (edit capacity, status), `POST /admin/sessions/:id/cancel` (soft-cancel session: batch-cancel confirmed bookings, initiate batch refunds, batch cancellation emails) — entire batch in one transaction; audit log
- [x] T057 [P] [US3] Implement `CancellationPolicyService` in `apps/api/src/modules/bookings/cancellation-policy.service.ts`: CRUD, `computeRefundPercent(policy, sessionStartsAt, cancelledAt)` helper (Perth-aware)
- [x] T058 [P] [US3] Build Next.js admin dashboard layout `apps/web/src/app/(admin)/layout.tsx`: nav (classes, schedules, users, waitlists, payments, coupons, reports)
- [x] T059 [P] [US3] Build Next.js admin catalog UI `apps/web/src/app/(admin)/catalog/page.tsx`: tabs for Categories / Locations / Rooms — list, create, edit, soft-delete
- [x] T060 [P] [US3] Build Next.js admin class + session management UI `apps/web/src/app/(admin)/classes/`: class list/create/edit; session list with "Generate Schedule" action; session detail with capacity edit + cancel button
- [x] T061 [P] [US3] Build Next.js admin instructor management UI `apps/web/src/app/(admin)/instructors/page.tsx`: list, create, edit, deactivate

**Checkpoint**: All three P1 User Stories functional. MVP is complete and demonstrable.

---

## Phase 6: User Story 4 — Student Cancels Booking, Receives Refund (Priority: P2)

**Goal**: Student cancels a confirmed booking. The cancellation policy determines refund eligibility.
Refund issued via Stripe. Freed seat triggers waitlist promotion. Cancellation email sent.

**Independent Test**: Confirm a booking, cancel within the policy window → full refund issued and
cancellation email sent. Cancel outside window → no refund. Verify freed seat triggers waitlist
promotion if applicable.

### Tests for User Story 4 ⚠️ Write first — verify they FAIL before implementation

- [x] T062 [P] [US4] API test: cancel within refund window → `CANCELLED`, Stripe refund called, email queued; cancel outside window → `CANCELLED`, no refund (`apps/api/tests/api/cancellation.test.ts`)
- [x] T063 [US4] Unit test: `CancellationPolicyService.computeRefundPercent` — full/partial/zero refund per configured time brackets; Perth-tz boundary (`apps/api/src/modules/bookings/cancellation-policy.spec.ts`)

### Implementation for User Story 4

- [x] T064 [US4] Implement `CancellationService` in `apps/api/src/modules/bookings/cancellation.service.ts`: `cancelBooking(bookingId, actorId)` — in a transaction: validate `CONFIRMED→CANCELLED` transition, compute refund via `CancellationPolicyService`, call Stripe `refunds.create` with idempotency key, create `Refund` row, free seat, call `WaitlistPromotionService.promoteNext`, queue cancellation email post-commit; audit log
- [x] T065 [US4] Expose student cancellation endpoint `POST /bookings/:id/cancel` in `apps/api/src/modules/bookings/bookings.controller.ts`: student can only cancel their own booking; delegates to `CancellationService`
- [x] T066 [US4] Implement `ChargeRefundedHandler` in `apps/api/src/modules/payments/handlers/charge-refunded.handler.ts`: `charge.refunded` webhook → update `Payment.status` to `REFUNDED`/`PARTIALLY_REFUNDED` and `Refund.status=SUCCEEDED`; idempotency-guarded
- [x] T067 [P] [US4] Create cancellation React Email template in `packages/emails/src/templates/Cancellation.tsx`: class/session details, refund amount (or none), policy note
- [x] T068 [P] [US4] Build Next.js cancel booking UI `apps/web/src/app/(student)/bookings/[id]/cancel/page.tsx`: show booking details, refund preview (based on current policy + time), confirm button; redirects to booking history on success

**Checkpoint**: User Stories 1–4 functional. Full booking lifecycle (book → pay → cancel → refund) is available to students.

---

## Phase 7: User Story 5 — Instructor Manages Classes and Attendance (Priority: P2)

**Goal**: Instructors log in, view their assigned sessions, see attendee lists and capacity counts,
and record check-ins and no-shows.

**Independent Test**: Assign instructor to a session with confirmed attendees. Log in as instructor.
Verify attendee list + capacity visible. Mark check-in and no-show. Verify access denied to unassigned
sessions.

### Tests for User Story 5 ⚠️ Write first — verify they FAIL before implementation

- [x] T069 [P] [US5] API test: instructor views assigned sessions + attendee list; records ATTENDED/NO_SHOW; denied access to unassigned session (`apps/api/tests/api/instructor.test.ts`)

### Implementation for User Story 5

- [x] T070 [P] [US5] Implement instructor sessions endpoint `GET /instructor/sessions` + `GET /instructor/sessions/:id/attendees` in `apps/api/src/modules/instructors/instructor-sessions.controller.ts`: `@Roles(INSTRUCTOR)` guard; attendee list includes name, booking status, check-in status; filter to sessions where `instructorId = authed user's InstructorProfile.id`
- [x] T071 [US5] Implement attendance recording `POST /instructor/sessions/:id/attendance` in `apps/api/src/modules/instructors/attendance.service.ts`: guard `ATTENDED`/`NO_SHOW` transition only for `CONFIRMED` bookings on sessions assigned to the authed instructor; audit log
- [x] T072 [P] [US5] Build Next.js instructor dashboard `apps/web/src/app/(instructor)/page.tsx`: upcoming + past sessions list
- [x] T073 [P] [US5] Build Next.js instructor session detail `apps/web/src/app/(instructor)/sessions/[id]/page.tsx`: attendee table with status badges and check-in / no-show action buttons
- [x] T074 [US5] Unit test: instructor access guard — rejects requests from instructors for sessions not assigned to them (`apps/api/src/modules/instructors/instructor.guard.spec.ts`)

**Checkpoint**: User Stories 1–5 functional. Instructor attendance workflow is complete.

---

## Phase 8: User Story 6 — Admin Manages Users, Roles, Payments, Refunds, and Coupons (Priority: P2)

**Goal**: Admins manage user accounts and roles, review payments and issue manual refunds, and create
and manage discount coupons applied at checkout.

**Independent Test**: As admin, change a user's role, verify new access; issue a manual refund, verify
Stripe call and status update; create a coupon, have a student apply it at checkout, verify correct
discounted amount charged.

### Tests for User Story 6 ⚠️ Write first — verify they FAIL before implementation

- [ ] T075 [P] [US6] API test: admin user CRUD + role change; coupon CRUD + apply at checkout; manual refund (`apps/api/tests/api/admin.users.test.ts`)
- [ ] T076 [US6] Unit test: coupon validation — expired coupon rejected, usage limit enforced, PERCENT vs FIXED calculation, invalid code rejected (`apps/api/src/modules/coupons/coupon.spec.ts`)

### Implementation for User Story 6

- [ ] T077 [P] [US6] Implement admin users controller `apps/api/src/modules/users/admin-users.controller.ts`: `GET/PATCH/DELETE /admin/users/:id`, `POST /admin/users/:id/roles` — soft-delete for deactivation, role-change audit log; `@Roles(ADMIN)`
- [ ] T078 [P] [US6] Implement `CouponsModule` in `apps/api/src/modules/coupons/`: `CouponService` (CRUD, `validateAndApply(code, userId, sessionId)` — checks expiry + usage limit + increments `redeemedCount` atomically); admin CRUD endpoints
- [ ] T079 [US6] Integrate coupon application in checkout: in `SeatHoldService`/`CheckoutService`, accept optional `couponCode`, call `CouponService.validateAndApply`, adjust `amountCents` and pass line-item discount to Stripe Checkout Session (`apps/api/src/modules/bookings/seat-hold.service.ts`, `apps/api/src/modules/payments/checkout.service.ts`)
- [ ] T080 [P] [US6] Implement admin payments controller `apps/api/src/modules/payments/admin-payments.controller.ts`: `GET /admin/payments` (list with filters), `POST /admin/refunds` (manual refund — delegates to Stripe, creates `Refund` row, audit log)
- [ ] T081 [P] [US6] Build Next.js admin user management UI `apps/web/src/app/(admin)/users/page.tsx`: user list, edit role, deactivate
- [ ] T082 [P] [US6] Build Next.js admin coupons management UI `apps/web/src/app/(admin)/coupons/page.tsx`: list, create, edit, deactivate; show `redeemedCount`
- [ ] T083 [P] [US6] Build Next.js admin payments + refunds UI `apps/web/src/app/(admin)/payments/page.tsx`: payment list, status filter, "Issue Refund" action with amount input

**Checkpoint**: User Stories 1–6 functional. Full admin operational capability (users, roles, payments, coupons) is available.

---

## Phase 9: User Story 7 — Reminder Notifications (Priority: P3)

**Goal**: Students receive reminder emails ahead of upcoming booked sessions at a configurable lead
time (set by super admin in Settings).

**Independent Test**: Seed a confirmed booking N+1 hours in the future (N = configured lead time).
Run the reminder cron job. Verify exactly one `REMINDER` notification record created and sent. Run
the job again — no duplicate sent.

### Tests for User Story 7 ⚠️ Write first — verify they FAIL before implementation

- [ ] T084 [P] [US7] Integration test: seed near-future booking, trigger reminder job, verify one `Notification(type=REMINDER)` created; second trigger = no new notification (`apps/api/tests/integration/reminders.test.ts`)
- [ ] T085 [US7] Unit test: reminder job selects only eligible bookings (CONFIRMED, not already notified, within lead-time window), respects Perth tz for session time (`apps/api/src/jobs/reminder.job.spec.ts`)

### Implementation for User Story 7

- [ ] T086 [P] [US7] Create reminder React Email template in `packages/emails/src/templates/Reminder.tsx`: class/session details, Perth-local time, location, instructor name
- [ ] T087 [US7] Implement reminder cron job in `apps/api/src/jobs/reminder.job.ts` (`@Cron(CronExpression.EVERY_HOUR)`): query `CONFIRMED` bookings where `session.startsAt` is within `(now, now + reminderLeadHours)` (from `Setting`) and no `Notification(type=REMINDER)` exists; dispatch `REMINDER` email via `NotificationService`; idempotent (checks existing notification before creating)

**Checkpoint**: User Story 7 functional. Students receive timely reminder emails.

---

## Phase 10: User Story 8 — Super Admin Manages Global and Security Settings (Priority: P3)

**Goal**: Super admins configure global application settings (seat-hold window, reminder lead time,
default cancellation policy) and security settings (password policy, session expiry, rate limits).
Non-super-admins cannot access these settings.

**Independent Test**: As super admin, change `seatHoldWindowMinutes` to 5. Begin a student checkout
and verify the hold expires in 5 min. Attempt to access settings as an admin — denied.

### Tests for User Story 8 ⚠️ Write first — verify they FAIL before implementation

- [ ] T088 [P] [US8] API test: super admin reads/updates settings; admin role denied; setting change reflected in runtime behaviour (`apps/api/tests/api/settings.test.ts`)

### Implementation for User Story 8

- [ ] T089 [P] [US8] Implement `SettingsModule` in `apps/api/src/modules/settings/`: `SettingsService` (get/set key–value `Setting` rows, cached in-process with TTL), `SettingsController` (CRUD, `@Roles(SUPER_ADMIN)`); audit log on every change
- [ ] T090 [US8] Wire `SettingsService` into `SeatHoldService` (hold window), `ReminderJob` (lead time), `CancellationPolicyService` (default policy) — fetch at runtime from `SettingsService` (replaces env-var hardcodes) (`apps/api/src/common/settings.service.ts`)
- [ ] T091 [P] [US8] Build Next.js super admin settings UI `apps/web/src/app/(super-admin)/settings/page.tsx`: global settings form (seat hold, reminder lead time, default policy) + security settings form (password requirements, session expiry); `@Roles(SUPER_ADMIN)` route guard in middleware

**Checkpoint**: User Story 8 functional. Super admin can tune application behaviour without a code deploy.

---

## Phase 11: User Story 9 — Reports (Priority: P3)

**Goal**: Admins view reports on bookings, attendance, revenue, cancellations, and waitlist
conversion over selectable date ranges in Perth local time.

**Independent Test**: Seed 20 bookings, 5 cancellations, 3 refunds, 2 waitlist conversions. Open
each report for a date range that includes them. Verify totals match the underlying data.

### Tests for User Story 9 ⚠️ Write first — verify they FAIL before implementation

- [ ] T092 [US9] Unit test: report aggregate queries are Perth-tz-aware (date range boundaries map to correct UTC for `startsAt` filter) (`apps/api/src/modules/reports/reports.spec.ts`)

### Implementation for User Story 9

- [ ] T093 [P] [US9] Implement `ReportsModule` in `apps/api/src/modules/reports/`: `ReportsService` with aggregation methods — `bookingsByDateRange`, `revenueByDateRange`, `attendanceSummary`, `cancellationsByDateRange`, `waitlistConversionRate`; all date-range params converted to UTC via `tz.dateRangeUTC`
- [ ] T094 [P] [US9] Reports controller in `apps/api/src/modules/reports/reports.controller.ts`: `GET /admin/reports/bookings`, `/revenue`, `/attendance`, `/cancellations`, `/waitlist-conversion` — `@Roles(ADMIN)`, Zod-validated date-range query params
- [ ] T095 [P] [US9] Build Next.js admin reports UI `apps/web/src/app/(admin)/reports/page.tsx`: date range picker (Perth local), report cards/tables for each metric, downloadable CSV

**Checkpoint**: User Story 9 functional. All user stories complete.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, security audit, contract validation, documentation, E2E tests, and
quickstart validation across all modules.

- [ ] T096 [P] Accessibility audit: run `axe-core` against all student/instructor/admin pages; fix all critical violations; verify keyboard navigation and WCAG 2.1 AA colour contrast on all interactive elements
- [ ] T097 [P] OWASP dependency audit: run `pnpm audit` (or Snyk), address all high/critical CVEs; add `pnpm audit --audit-level=high` as a CI gate
- [ ] T098 [P] OpenAPI contract validation: add CI step using `openapi-diff` or `swagger-cli validate` to compare NestJS-generated spec against `contracts/openapi.yaml`; fail on schema drift
- [ ] T099 [P] Module documentation: add `README.md` to each NestJS module (`auth`, `bookings`, `waitlists`, `payments`, `notifications`, `audit-logs`, `settings`, `reports`, `coupons`) describing purpose, env vars used, and public contract endpoints
- [ ] T100 [P] Playwright E2E — critical journey 1: student register → browse → book → pay (Stripe test card) → confirm booking history (`apps/web/tests/e2e/booking.spec.ts`)
- [ ] T101 [P] Playwright E2E — critical journey 2: fill session → join waitlist → cancel confirmed booking → verify waitlisted student promoted → pay → confirmed (`apps/web/tests/e2e/waitlist.spec.ts`)
- [ ] T102 [P] Playwright E2E — critical journey 3: cancel booking within refund window → verify refund issued + cancellation email (`apps/web/tests/e2e/cancellation.spec.ts`)
- [ ] T103 Run `quickstart.md` validation: fresh DB, `prisma migrate dev`, `prisma db seed`, `pnpm dev`, verify all MVP flows from `quickstart.md` pass; fix any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — first user story, no inter-story deps
- **Phase 4 (US2)**: Depends on Phase 2 + **Phase 3 complete** (US2 uses `SeatHoldService`, `CheckoutService`, `NotificationsModule` from US1)
- **Phase 5 (US3)**: Depends on Phase 2; can run in parallel with Phase 3 if staffed
- **Phase 6 (US4)**: Depends on Phase 3 (cancellation uses `SeatHoldService`) + Phase 4 (waitlist promotion on cancel) + Phase 5 (`CancellationPolicyService`)
- **Phase 7 (US5)**: Depends on Phase 2; independent of US1–US4
- **Phase 8 (US6)**: Depends on Phase 2 + Phase 3 (coupon at checkout)
- **Phase 9 (US7)**: Depends on Phase 2 + Phase 3 (notifications infrastructure)
- **Phase 10 (US8)**: Depends on Phase 2; settings wire in after all modules are built
- **Phase 11 (US9)**: Depends on Phases 3–8 (needs real booking/payment data)
- **Phase 12 (Polish)**: Depends on all user story phases

### Within Each Phase

- Tests marked `[P]` MUST be written and verified FAIL before implementation
- Models/repositories before services before controllers
- Services before UI (Next.js pages call API)
- All tasks marked `[P]` within a phase can run in parallel

### Parallel Opportunities

- All Phase 1 tasks marked `[P]` — run in parallel
- All Phase 2 tasks from T010 onwards — run in parallel after T009 (schema)
- Within Phase 3: T021–T024 (tests) in parallel with each other; T025–T026 (classes + schedules modules) in parallel; T030–T031 (two independent webhook handlers) in parallel; T034–T036 (Next.js pages) in parallel
- Phases 5 and 7 can start as soon as Phase 2 is done (no dependency on Phase 3)

---

## Parallel Example: User Story 1 (Phase 3)

```bash
# Launch all integration + API tests together (they MUST fail before implementation):
Task T021: "Integration test: concurrent seat claim"
Task T022: "Integration test: duplicate booking prevention"
Task T023: "API test: auth flow"
Task T024: "API test: full booking workflow"

# Launch independent module scaffolding together:
Task T025: "ClassesModule (CRUD)"
Task T026: "SchedulesModule (list + filter)"

# Launch independent Next.js pages together (after API is built):
Task T034: "Next.js class browse page"
Task T035: "Next.js booking history page"
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** — blocks everything)
3. Complete Phase 3: US1 — book + pay
4. **STOP AND VALIDATE**: test concurrent booking, Stripe flow end-to-end
5. Complete Phase 4: US2 — waitlist promotion
6. Complete Phase 5: US3 — admin catalog
7. **STOP AND DEMO**: full MVP demonstrable

### Incremental Delivery (all stories)

- Add P2 stories (US4–US6) one at a time; each is independently deployable behind a feature flag
- Add P3 stories (US7–US9) after P2 complete
- Each phase adds value without breaking previous stories

### Parallel Team Strategy

With 3 developers after Phase 2 completes:

- Developer A: Phase 3 (US1 — book+pay core)
- Developer B: Phase 5 (US3 — admin catalog, no US1 dependency)
- Developer C: Phase 7 (US5 — instructor dashboard, no US1 dependency)
- Once Phase 3 done: Developer A takes Phase 4 (US2 waitlist)
- Developers B/C take Phase 6 (US4) and Phase 8 (US6) after their phases complete

---

## Notes

- `[P]` tasks = different files, no dependency on incomplete tasks — safe to parallelise
- `[USn]` label = belongs to that user story for traceability
- Integration tests use a real PostgreSQL — no mocking of DB behaviour (per constitution, research §14)
- All webhook tests use Stripe fixture payloads + a valid test signing secret
- All times seeded, tested, and displayed in `Australia/Perth` (UTC+8, no DST)
- Commit after each task or logical group; stop at each phase checkpoint to validate independently
