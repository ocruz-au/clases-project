# Feature Specification: Class Booking Platform (Perth)

**Feature Branch**: `001-class-booking-platform`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Build a web application for booking classes in Perth, Australia. The app
must support students, instructors, admins, and super admins... [full booking platform with capacity
control, waitlists, Stripe payments, seat holds, notifications, audit logs, soft delete, and
Australia/Perth timezone handling]"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student books and pays for a class (Priority: P1)

A student registers, logs in, browses available classes (filtering by date, category, instructor, and
location), selects a class with available seats, and completes payment. The seat is held during
checkout and confirmed only after payment succeeds. The student receives a booking confirmation email.

**Why this priority**: This is the core revenue path. Without browse → book → pay → confirm, the
product delivers no value. It is the minimum viable slice.

**Independent Test**: Register a student, seed one class with open capacity, complete a Stripe test
payment, and verify a confirmed booking plus a confirmation email — all without any other story
present.

**Acceptance Scenarios**:

1. **Given** a class with available capacity, **When** the student starts checkout, **Then** a
   temporary seat hold is created and counted against capacity for the hold window.
2. **Given** a held seat, **When** payment succeeds (confirmed via Stripe webhook), **Then** the
   booking becomes `CONFIRMED`, the seat is permanently allocated, and a confirmation email is sent.
3. **Given** a held seat, **When** payment fails or the hold window expires, **Then** the hold is
   released, capacity is restored, and no booking is confirmed.
4. **Given** a student already holding a confirmed booking for a class time slot, **When** they try to
   book the same time slot again, **Then** the system rejects the duplicate booking.
5. **Given** a class at full capacity, **When** the student attempts to book, **Then** booking is
   refused and the waitlist option is offered.

---

### User Story 2 - Waitlist with automatic promotion and seat hold (Priority: P1)

When a class is full, a student joins the waitlist and keeps their queue position. When a seat frees up
(a cancellation or expired hold), the next eligible waitlisted student is promoted automatically: they
receive a temporary seat hold and must complete payment within a configurable window. If they fail or
let the hold expire, the seat passes to the next waitlisted student.

**Why this priority**: Capacity is the central constraint of the business; the waitlist is how revenue
is recovered when classes fill. It is core to the MVP alongside booking.

**Independent Test**: Fill a class, add two students to the waitlist, cancel a confirmed booking, and
verify the first waitlisted student receives a seat hold + promotion email; let the hold expire and
verify the second student is promoted.

**Acceptance Scenarios**:

1. **Given** a full class, **When** a student joins the waitlist, **Then** they are appended to the
   ordered queue and notified of their position.
2. **Given** a freed seat, **When** the system promotes the next eligible student, **Then** that
   student receives a seat hold and a promotion notification with the payment deadline.
3. **Given** a promoted student, **When** they pay within the window, **Then** their booking is
   confirmed and they are removed from the waitlist.
4. **Given** a promoted student, **When** the hold expires or payment fails, **Then** the seat is
   offered to the next eligible waitlisted student.
5. **Given** an ordered waitlist, **When** an admin removes, skips, or manually promotes a student,
   **Then** the queue order and promotion behavior reflect the admin action and the action is audited.

---

### User Story 3 - Admin manages classes, schedules, and capacity (Priority: P1)

An admin creates and manages categories, locations, rooms, instructors, and classes; defines
availability rules that generate scheduled class sessions; sets capacity and cancellation policies; and
oversees bookings and waitlists from a dashboard.

**Why this priority**: There is nothing for students to book until an admin can create the catalog and
schedule. This is foundational to the MVP.

**Independent Test**: As an admin, create a location, room, category, instructor, and a class with an
availability rule; generate a schedule; and verify the generated sessions appear as bookable to a
student with correct capacity and Perth-local times.

**Acceptance Scenarios**:

1. **Given** an availability rule, **When** the admin generates a schedule, **Then** class sessions are
   created with Australia/Perth-local start/end times and the configured capacity.
2. **Given** a scheduled session, **When** the admin edits capacity or cancellation policy, **Then**
   the change applies to future bookings and is audit logged.
3. **Given** a session with bookings, **When** the admin cancels the session, **Then** affected
   students are notified and refunds are initiated per policy.
4. **Given** a waitlist, **When** the admin views it, **Then** the queue order and each entry's status
   are visible, with controls to remove, skip, or manually promote.

---

### User Story 4 - Student cancels a booking and receives a refund (Priority: P2)

A student cancels a confirmed booking. The system applies the class's cancellation policy to determine
refund eligibility, processes any refund through Stripe, frees the seat (triggering waitlist
promotion), and sends a cancellation email.

**Why this priority**: Cancellation and refunds are expected of any paid booking product, but the
product can launch and transact without them for a short pilot. Hence P2, immediately after MVP.

**Independent Test**: Confirm a booking, cancel it within the policy window, and verify the refund is
issued, the seat is freed, and a cancellation email is sent.

**Acceptance Scenarios**:

1. **Given** a confirmed booking within the refundable window, **When** the student cancels, **Then** a
   refund is issued per policy and the booking becomes `CANCELLED`.
2. **Given** a confirmed booking outside the refundable window, **When** the student cancels, **Then**
   the booking is cancelled with no (or partial) refund per policy and the student is informed.
3. **Given** a cancellation that frees a seat, **When** a waitlist exists, **Then** the next eligible
   student is promoted.

---

### User Story 5 - Instructor manages their classes and attendance (Priority: P2)

An instructor logs in and views their assigned class sessions, attendee lists, remaining capacity,
cancellations, and no-shows, and records check-ins and no-shows for attendees.

**Why this priority**: Operationally important for running classes, but the booking and payment flow
can launch before instructor tooling is complete.

**Independent Test**: Assign an instructor to a session with confirmed attendees, log in as the
instructor, and verify the attendee list, then mark check-ins and a no-show.

**Acceptance Scenarios**:

1. **Given** an assigned session, **When** the instructor opens it, **Then** they see the attendee
   list, capacity, and cancellation counts.
2. **Given** an attendee, **When** the instructor records a check-in or no-show, **Then** the
   attendance status updates and is audit logged.
3. **Given** a session not assigned to them, **When** the instructor attempts to view it, **Then**
   access is denied.

---

### User Story 6 - Admin manages users, roles, payments, refunds, and coupons (Priority: P2)

An admin manages user accounts and role assignments, reviews payments and issues refunds, and creates
and manages coupons applied at checkout.

**Why this priority**: Necessary for ongoing operations and growth, but not required to demonstrate the
core transactional loop.

**Independent Test**: As an admin, change a user's role, issue a manual refund for a payment, and
create a coupon, then verify a student sees the discount applied at checkout.

**Acceptance Scenarios**:

1. **Given** a user, **When** the admin changes their role, **Then** the user's permissions change and
   the action is audit logged.
2. **Given** a payment, **When** the admin issues a refund, **Then** the refund is processed via Stripe
   and the payment status updates.
3. **Given** an active coupon, **When** a student applies it at checkout, **Then** the price is
   discounted per the coupon rules and usage limits are enforced.

---

### User Story 7 - Reminder notifications (Priority: P3)

Students receive reminder emails ahead of their booked class sessions.

**Why this priority**: Improves attendance and experience but is not required for the core loop.

**Independent Test**: Confirm a booking for a near-future session and verify a reminder email is sent at
the configured lead time.

**Acceptance Scenarios**:

1. **Given** a confirmed upcoming booking, **When** the reminder lead time is reached, **Then** a
   reminder email is sent once.

---

### User Story 8 - Super admin manages global and security settings (Priority: P3)

A super admin configures global application settings (e.g., default hold window, reminder lead time,
default cancellation policy) and security settings (e.g., password and session policy, rate limits).

**Why this priority**: Valuable for governance and tuning, but sensible defaults allow launch without a
dedicated settings UI.

**Independent Test**: As a super admin, change the seat-hold window and verify new checkouts use the
updated window; confirm a non-super-admin cannot access these settings.

**Acceptance Scenarios**:

1. **Given** super admin access, **When** a global setting is changed, **Then** the new value governs
   subsequent behavior and the change is audit logged.
2. **Given** a non-super-admin user, **When** they attempt to access global/security settings, **Then**
   access is denied.

---

### User Story 9 - Reports (Priority: P3)

An admin views reports on bookings, attendance, revenue, cancellations, and waitlist conversion.

**Why this priority**: Supports business decisions; not part of the core transactional loop.

**Independent Test**: With seeded bookings and payments, open the reports view and verify totals match
the underlying data.

**Acceptance Scenarios**:

1. **Given** booking and payment data, **When** the admin opens a report for a date range, **Then** the
   figures reflect the data for that range in Perth-local time.

---

### Edge Cases

- Two students attempt to claim the last remaining seat simultaneously — exactly one succeeds; the
  other is refused or offered the waitlist (no overbooking).
- A Stripe webhook arrives more than once for the same payment (at-least-once delivery) — the system
  processes it idempotently and does not double-confirm or double-charge.
- A Stripe webhook is delayed and arrives after the hold has expired — the system reconciles to a
  consistent state (either honor the paid seat or refund), never leaving an orphaned charge.
- A promoted waitlisted student's hold expires at the same instant they submit payment — the outcome is
  deterministic and only one resolution is recorded.
- A class session crosses a date boundary or a daylight-saving change elsewhere — times remain correct
  and unambiguous in Australia/Perth (which does not observe DST).
- An admin deletes a class, instructor, or user that has historical bookings — soft delete preserves
  records and audit history; historical reports remain accurate.
- A coupon is applied at checkout but its usage limit is reached before payment confirms — the discount
  is rejected and the student is informed before being charged.
- A refund fails at the payment provider — the booking/payment state reflects the failure and the issue
  is surfaced for admin follow-up.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts, roles, and access**

- **FR-001**: System MUST allow students to register and log in securely.
- **FR-002**: System MUST support four roles — student, instructor, admin, super admin — with
  role-based access enforced on every protected action.
- **FR-003**: System MUST allow admins to create, edit, and deactivate users and assign roles, and
  allow super admins to manage global and security settings.

**Catalog and scheduling**

- **FR-004**: Admins MUST be able to manage categories, locations, rooms, instructors, and classes.
- **FR-005**: Admins MUST be able to define availability rules that generate scheduled class sessions
  with capacity, and edit generated schedules.
- **FR-006**: System MUST store and display all class dates/times in the Australia/Perth timezone
  unambiguously.

**Browsing and booking**

- **FR-007**: Students MUST be able to view available classes and filter by date, category, instructor,
  and location.
- **FR-008**: System MUST prevent overbooking: confirmed bookings plus active seat holds MUST never
  exceed a session's capacity.
- **FR-009**: System MUST prevent a student from holding more than one active/confirmed booking for the
  same class time slot (no duplicate bookings).
- **FR-010**: System MUST create a temporary seat hold when checkout begins and release it
  automatically when payment fails or the configurable hold window expires.
- **FR-011**: System MUST support a booking status workflow (e.g., held → confirmed → cancelled /
  expired / no-show) and only advance status through valid transitions.

**Payments**

- **FR-012**: System MUST process payments via Stripe and confirm bookings only after payment success
  is verified by a Stripe webhook with a verified signature.
- **FR-013**: System MUST support a payment status workflow (e.g., pending → succeeded / failed /
  refunded) and handle webhook events idempotently.
- **FR-014**: Admins MUST be able to issue full or partial refunds, and the system MUST process them via
  Stripe and update payment status.
- **FR-015**: Admins MUST be able to create and manage coupons with discount rules, validity periods,
  and usage limits enforced at checkout.
- **FR-016**: System MUST NOT store raw payment card data; all card handling is delegated to Stripe.

**Waitlists**

- **FR-017**: When a class is full, students MUST be able to join an ordered waitlist and see their
  position.
- **FR-018**: When a seat becomes available, the system MUST automatically promote the next eligible
  waitlisted student by issuing a seat hold and a promotion notification with a payment deadline.
- **FR-019**: If a promoted student fails to pay within the window or the hold expires, the system MUST
  offer the seat to the next eligible waitlisted student.
- **FR-020**: Admins MUST be able to view waitlist order and remove, skip, or manually promote students.

**Cancellation**

- **FR-021**: Students MUST be able to cancel bookings, and the system MUST apply the class's
  cancellation policy to determine refund eligibility.
- **FR-022**: Admins MUST be able to define cancellation policies per class (or a global default).
- **FR-023**: When a booking is cancelled, the freed seat MUST trigger waitlist promotion where
  applicable.

**Instructor operations**

- **FR-024**: Instructors MUST be able to view their assigned sessions, attendee lists, capacity, and
  cancellation/no-show counts.
- **FR-025**: Instructors MUST be able to record check-ins and no-shows for attendees.

**Notifications**

- **FR-026**: System MUST send booking confirmation, cancellation, waitlist-promotion, and reminder
  emails.

**Integrity, audit, and data lifecycle**

- **FR-027**: All booking, payment, cancellation, refund, and waitlist actions MUST be transaction-safe
  (atomic) and leave no partial state on failure.
- **FR-028**: All state-changing actions MUST be recorded in an append-only audit log capturing actor,
  action, target, before/after where applicable, and timestamp.
- **FR-029**: System MUST use soft delete for business records (users, classes, bookings, etc.) so
  historical data and audit trails are preserved.
- **FR-030**: System MUST provide admin reports covering bookings, attendance, revenue, cancellations,
  and waitlist conversion over selectable date ranges.

### Key Entities *(include if feature involves data)*

- **User**: A person with an account; has one or more roles (student, instructor, admin, super admin),
  authentication credentials, and contact email.
- **Role / Permission**: Named role governing allowed actions; assigned to users.
- **Instructor**: A user who teaches; linked to assigned class sessions.
- **Category**: Classification for classes (e.g., yoga, pilates).
- **Location**: A physical venue; contains rooms.
- **Room**: A bookable space within a location with a capacity.
- **Class**: A type/offering (title, description, category, price, default capacity, cancellation
  policy).
- **Availability Rule**: A recurrence definition used to generate class sessions.
- **Class Session (Schedule)**: A specific dated occurrence of a class at a location/room with an
  instructor, start/end time (Perth), and capacity.
- **Booking**: A student's reservation for a session, with status (held, confirmed, cancelled, expired,
  no-show) and link to a payment.
- **Seat Hold**: A temporary reservation of a seat during checkout/promotion with an expiry time.
- **Waitlist Entry**: A student's ordered position on a full session's waitlist, with status.
- **Payment**: A Stripe-backed charge for a booking with status (pending, succeeded, failed, refunded).
- **Refund**: A full/partial reversal of a payment.
- **Coupon**: A discount with rules, validity window, and usage limits.
- **Cancellation Policy**: Rules determining refund eligibility based on time before the session.
- **Notification**: An email event (confirmation, cancellation, promotion, reminder) and its delivery
  status.
- **Audit Log Entry**: An append-only record of a state-changing action.
- **Setting**: A global or security configuration value managed by super admins.
- **Review** *(post-MVP)*: A student's rating/feedback for a completed class session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new student can go from registration to a confirmed, paid booking in under 5 minutes.
- **SC-002**: The system never confirms more bookings than a session's capacity, verified under
  concurrent booking attempts (0 overbooking incidents).
- **SC-003**: 100% of duplicate-booking attempts for the same time slot by the same student are
  prevented.
- **SC-004**: 100% of seat holds are released automatically when payment fails or the hold window
  expires, with capacity restored.
- **SC-005**: When a seat frees on a class with a waitlist, the next eligible student is offered the
  seat within 1 minute.
- **SC-006**: 100% of confirmed payments result in exactly one confirmed booking and one confirmation
  email, even when payment webhooks are delivered more than once.
- **SC-007**: Every booking, payment, cancellation, refund, and waitlist action has a corresponding
  audit log entry (100% coverage).
- **SC-008**: All class times shown to users match the intended Australia/Perth local time with no
  off-by-timezone errors.
- **SC-009**: Refunds for eligible cancellations are initiated within 1 minute of the cancellation.
- **SC-010**: No business record is ever hard-deleted; historical reports remain accurate after
  deletions.

## Assumptions

- Email delivery (confirmations, cancellations, promotions, reminders) is sufficient for notifications;
  SMS/push are out of scope for the initial release.
- A single business operates in Perth; multi-tenant/multi-city operation is out of scope for v1.
- Australia/Perth does not observe daylight saving time; the system still stores timezone-aware
  timestamps to remain correct if policy changes.
- Stripe is the sole payment provider and is the system of record for charges and refunds.
- Default values exist for configurable items (seat-hold window, reminder lead time, default
  cancellation policy) so the product can launch before the super-admin settings UI is complete.
- Students pay per class at booking time; subscriptions/class-packs are out of scope for v1.
- Reviews are a post-MVP enhancement and are not part of the initial transactional loop.
- Standard web performance and accessibility expectations apply per the project constitution.
