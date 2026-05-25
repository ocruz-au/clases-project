# Data Model: Class Booking Platform (Perth)

**Feature**: `001-class-booking-platform` | **Date**: 2026-05-24

Conventions applied to every entity:

- Primary keys are UUIDs.
- `createdAt` / `updatedAt` are `timestamptz` (UTC).
- Business entities carry `deletedAt timestamptz NULL` for soft delete (FR-029); default queries
  filter `deletedAt IS NULL`.
- All wall-clock fields shown to users are stored UTC and rendered in `Australia/Perth` (FR-006).

---

## Entities

### User

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| email | citext | unique (active) |
| name | text | |
| passwordHash | text | Argon2id; null if external provider |
| mfaSecret | text NULL | TOTP secret (encrypted at rest) |
| mfaEnabled | bool | required true for admin/super admin |
| status | enum(`ACTIVE`,`DISABLED`) | |
| deletedAt | timestamptz NULL | soft delete |

Relationships: has many `UserRole`; may have one `InstructorProfile`; has many `Booking`,
`WaitlistEntry`, `Payment`.

Validation: valid email; password meets security policy (from `Setting`).

### Role & UserRole

- **Role**: `id`, `key` enum(`STUDENT`,`INSTRUCTOR`,`ADMIN`,`SUPER_ADMIN`), `description`.
- **UserRole**: join of `userId` + `roleId`; unique `(userId, roleId)`. A user may hold multiple roles.

### InstructorProfile

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| userId | uuid (FK→User) | unique |
| bio | text NULL | |
| deletedAt | timestamptz NULL | |

Relationships: has many `ClassSession` (assigned).

### Category

`id`, `name` (unique active), `slug`, `description NULL`, `deletedAt`. Has many `Class`.

### Location

`id`, `name`, `address`, `timezone` (default `Australia/Perth`), `deletedAt`. Has many `Room`.

### Room

`id`, `locationId` (FK), `name`, `capacity` (int ≥ 0), `deletedAt`. Unique `(locationId, name)`.
Has many `ClassSession`.

### Class

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| title | text | |
| description | text | |
| categoryId | uuid (FK→Category) | |
| priceCents | int (≥0) | AUD minor units |
| currency | char(3) | default `AUD` |
| defaultCapacity | int (≥1) | |
| cancellationPolicyId | uuid (FK→CancellationPolicy) NULL | else global default |
| deletedAt | timestamptz NULL | |

Has many `AvailabilityRule`, `ClassSession`.

### AvailabilityRule

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| classId | uuid (FK→Class) | |
| roomId | uuid (FK→Room) | |
| instructorId | uuid (FK→InstructorProfile) | |
| rrule | text | iCal RRULE (recurrence) |
| startTimeLocal | time | Perth local start |
| durationMin | int (>0) | |
| capacityOverride | int NULL | else Class.defaultCapacity |
| activeFrom | date | |
| activeUntil | date NULL | |
| deletedAt | timestamptz NULL | |

Generates `ClassSession` rows (FR-005).

### ClassSession (the bookable occurrence)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| classId | uuid (FK→Class) | |
| roomId | uuid (FK→Room) | |
| instructorId | uuid (FK→InstructorProfile) | |
| startsAt | timestamptz | UTC; represents Perth local |
| endsAt | timestamptz | |
| capacity | int (≥1) | resolved at generation |
| status | enum(`SCHEDULED`,`CANCELLED`,`COMPLETED`) | |
| deletedAt | timestamptz NULL | |

Derived: `seatsTaken = count(active SeatHold) + count(CONFIRMED Booking)`;
`seatsAvailable = capacity - seatsTaken` (FR-008). Index on `(startsAt, status)`,
`(classId)`, `(instructorId)` for filtering (FR-007).

Invariant: `seatsTaken ≤ capacity` enforced via row-lock transaction (research §5).

### Booking

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| classSessionId | uuid (FK→ClassSession) | |
| userId | uuid (FK→User) | |
| status | enum(`HELD`,`CONFIRMED`,`CANCELLED`,`EXPIRED`,`NO_SHOW`,`ATTENDED`) | |
| seatHoldId | uuid (FK→SeatHold) NULL | |
| paymentId | uuid (FK→Payment) NULL | |
| couponId | uuid (FK→Coupon) NULL | |
| amountCents | int | price after discount |
| checkedInAt | timestamptz NULL | instructor action |
| cancelledAt | timestamptz NULL | |
| deletedAt | timestamptz NULL | |

Constraints:

- **Partial unique index** on `(classSessionId, userId)` WHERE `status IN ('HELD','CONFIRMED')` —
  prevents duplicate bookings (FR-009).

State machine (FR-011):

```
HELD --pay success--> CONFIRMED --cancel--> CANCELLED
HELD --hold expire/pay fail--> EXPIRED
CONFIRMED --session done + present--> ATTENDED
CONFIRMED --session done + absent--> NO_SHOW
```

Only listed transitions are permitted; transition attempts outside the machine are rejected.

### SeatHold

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| classSessionId | uuid (FK→ClassSession) | |
| userId | uuid (FK→User) | |
| source | enum(`CHECKOUT`,`WAITLIST_PROMOTION`) | |
| expiresAt | timestamptz | |
| status | enum(`ACTIVE`,`CONSUMED`,`RELEASED`) | |

"Active" = `status='ACTIVE' AND expiresAt > now()`. Counts toward `seatsTaken` (FR-010).

### WaitlistEntry

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| classSessionId | uuid (FK→ClassSession) | |
| userId | uuid (FK→User) | |
| position | int | order within session |
| status | enum(`WAITING`,`OFFERED`,`CONVERTED`,`REMOVED`,`SKIPPED`,`EXPIRED`) | |
| offeredSeatHoldId | uuid (FK→SeatHold) NULL | set on promotion |
| deletedAt | timestamptz NULL | |

Constraints: unique `(classSessionId, userId)` WHERE status active; unique
`(classSessionId, position)` WHERE status='WAITING'. State machine (FR-017–FR-020):

```
WAITING --promote--> OFFERED --pay--> CONVERTED
OFFERED --expire/fail--> EXPIRED (next entry promoted)
WAITING --admin remove--> REMOVED
WAITING --admin skip--> SKIPPED (re-queued or bypassed per admin)
```

### Payment

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| userId | uuid (FK→User) | |
| bookingId | uuid (FK→Booking) NULL | |
| stripeCheckoutSessionId | text NULL | |
| stripePaymentIntentId | text NULL | unique |
| amountCents | int | |
| currency | char(3) | `AUD` |
| status | enum(`PENDING`,`SUCCEEDED`,`FAILED`,`REFUNDED`,`PARTIALLY_REFUNDED`) | |
| deletedAt | timestamptz NULL | |

State machine (FR-013): `PENDING → SUCCEEDED|FAILED`; `SUCCEEDED → REFUNDED|PARTIALLY_REFUNDED`.
No raw card data stored (FR-016).

### Refund

`id`, `paymentId` (FK), `amountCents`, `reason`, `stripeRefundId` (unique), `status`
enum(`PENDING`,`SUCCEEDED`,`FAILED`), `createdBy` (FK→User). (FR-014)

### Coupon

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| code | text | unique (active) |
| type | enum(`PERCENT`,`FIXED`) | |
| value | int | percent (1–100) or fixed cents |
| validFrom | timestamptz | |
| validUntil | timestamptz | |
| maxRedemptions | int NULL | |
| redeemedCount | int | enforced ≤ max at checkout |
| deletedAt | timestamptz NULL | |

(FR-015)

### CancellationPolicy

`id`, `name`, `rules` (jsonb: e.g. `[{hoursBefore:24, refundPercent:100},{hoursBefore:0,
refundPercent:0}]`), `deletedAt`. Drives refund eligibility (FR-021/FR-022).

### Notification

`id`, `userId` (FK), `type` enum(`BOOKING_CONFIRMATION`,`CANCELLATION`,`WAITLIST_PROMOTION`,
`REMINDER`), `channel` enum(`EMAIL`), `payload` jsonb, `status` enum(`PENDING`,`SENT`,`FAILED`),
`sentAt timestamptz NULL`. (FR-026)

### AuditLog (append-only)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| actorId | uuid NULL | null = system |
| action | text | e.g. `BOOKING_CONFIRMED` |
| resourceType | text | |
| resourceId | text | |
| beforeState | jsonb NULL | |
| afterState | jsonb NULL | |
| ipAddress | inet NULL | |
| createdAt | timestamptz | no update/delete allowed |

Append-only; no `updatedAt`/`deletedAt` (FR-028, Constitution VII).

### ProcessedWebhookEvent

`id` (Stripe event id, PK/text), `type`, `processedAt timestamptz`. Guarantees idempotent webhook
handling (FR-013, SC-006).

### Setting

`key` (PK text), `value` jsonb, `scope` enum(`GLOBAL`,`SECURITY`), `updatedBy` (FK→User). Examples:
`seatHoldWindowMinutes`, `reminderLeadHours`, `defaultCancellationPolicyId`, `passwordPolicy`,
`rateLimits`. Managed by super admin (FR-003, US8).

### Review *(post-MVP)*

`id`, `classSessionId` (FK), `userId` (FK), `rating` (1–5), `comment NULL`, `deletedAt`. Only for
sessions the user `ATTENDED`.

---

## Key relationships (summary)

- `User` ⟶ many `UserRole` ⟶ `Role`
- `User` (1:1 optional) `InstructorProfile` ⟶ many `ClassSession`
- `Class` ⟶ many `AvailabilityRule` ⟶ generate `ClassSession`
- `ClassSession` ⟶ many `Booking`, `SeatHold`, `WaitlistEntry`
- `Booking` (1:1 optional) `Payment` ⟶ many `Refund`
- `Coupon` applied to `Booking`
- every state change ⟶ one `AuditLog` row

## Concurrency & integrity rules

1. Seat acquisition (checkout or promotion) runs in a transaction that `SELECT ... FOR UPDATE`s the
   `ClassSession` row, recounts active holds + confirmed bookings, and only inserts when
   `count < capacity` (FR-008, SC-002).
2. Duplicate bookings blocked by partial unique index (FR-009, SC-003).
3. Webhook processing is wrapped in a transaction guarded by `ProcessedWebhookEvent` (FR-013).
4. Cancellation, refund, and waitlist promotion each execute as a single transaction and emit audit
   rows; emails are queued only after commit (FR-027, FR-028).
