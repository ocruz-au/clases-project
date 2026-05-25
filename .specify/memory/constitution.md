<!--
## Sync Impact Report

**Version change**: 0.0.0 (template) → 1.0.0
**Bump rationale**: MAJOR — initial adoption; all placeholder tokens replaced with 12 domain-specific
principles for a secure, modular, production-ready booking web application.

### Modified Principles
- All five template placeholders replaced with 12 concrete principles.

### Added Sections
- Core Principles I–XII (Clean Architecture, TypeScript Strict Mode, RBAC, Secure Authentication,
  Input Validation, Database Integrity, Audit Logging, Payment Security, Accessibility & Responsive
  UI, Automated Testing, Clear Documentation, Incremental Delivery by Modules)
- Quality Gates & Standards
- Development Workflow
- Governance

### Removed Sections
- Generic template placeholder comments (no content lost)

### Templates Requiring Updates
- `.specify/templates/plan-template.md` — ✅ Constitution Check gate present; references principles I–XII implicitly
- `.specify/templates/spec-template.md` — ✅ Requirements + success criteria sections align with principle-driven FRs
- `.specify/templates/tasks-template.md` — ✅ Phase structure aligns with incremental delivery; security hardening and accessibility in Polish phase

### Deferred Items
- None — all fields resolved.
-->

# Booking Platform Constitution

## Core Principles

### I. Clean Architecture

Every module MUST maintain clear separation of concerns across presentation, business logic, and
data access layers. Dependencies flow inward: the domain layer has no external dependencies.
Cross-cutting concerns (logging, authentication, validation) are handled via middleware or
decorators, never inline. Circular dependencies between modules are prohibited.

**Rationale**: Decoupled layers enable independent testing, safe replacement of infrastructure
components, and low-risk incremental delivery of new booking modules.

### II. TypeScript Strict Mode

All source code MUST be written in TypeScript with `"strict": true`. `noImplicitAny`,
`strictNullChecks`, `strictPropertyInitialization`, and `noUncheckedIndexedAccess` are
non-negotiable. The `any` type is permitted only at external system boundaries (e.g., third-party
API responses) and MUST be narrowed to a concrete type immediately. Type assertions (`as`) MUST
include an inline comment justifying why the assertion is safe.

**Rationale**: Strict types eliminate a category of runtime errors at compile time and make
large-scale refactoring across booking modules safe.

### III. Role-Based Access Control (RBAC)

Every API endpoint and UI route MUST declare required roles explicitly. Role checks MUST be
enforced at the service layer, not only at the route/controller layer. Roles (e.g., `guest`,
`customer`, `staff`, `admin`) are defined in a single central module; hardcoded role strings
outside that module are prohibited. Privilege escalation paths MUST be covered by automated tests.

**Rationale**: A booking system handles sensitive personal data and financial transactions;
unauthorized access at any layer is unacceptable and may violate data-protection regulations.

### IV. Secure Authentication

Authentication MUST use OAuth 2.0 / OpenID Connect or JWT with RS256 asymmetric signing.
Passwords MUST be hashed with bcrypt (cost ≥ 12) or Argon2id. Sessions MUST have configurable
expiry and MUST support revocation. MFA MUST be available for `staff` and `admin` roles. Auth
tokens MUST NOT be stored in `localStorage`; use `httpOnly`, `Secure`, `SameSite=Strict` cookies
or server-side sessions.

**Rationale**: Authentication compromise is the highest-impact security failure vector; defense in
depth at the credential, token, and session layers is required.

### V. Input Validation

All user-supplied input MUST be validated at the API boundary before reaching business logic.
Validation schemas (e.g., Zod, class-validator) MUST be co-located with their route handlers.
Server-side validation is non-negotiable regardless of any client-side validation present.
All database queries MUST use parameterised statements or a trusted ORM; string concatenation
into queries is strictly prohibited.

**Rationale**: Input validation is the most cost-effective control against injection attacks and
data integrity violations, applied at the earliest interception point.

### VI. Database Integrity

Schema changes MUST be managed through versioned, reversible migrations; ad-hoc schema edits in
production are prohibited. Foreign key constraints, NOT NULL constraints, and unique indexes MUST
be declared at the database level, not only enforced in application code. Multi-step writes that
must succeed or fail atomically MUST be wrapped in transactions. Booking and payment records MUST
use soft deletes (a `deleted_at` timestamp); hard deletes require documented justification.

**Rationale**: Booking data is a financial record; database-level constraints provide a last line
of defense against application bugs and partial-write corruption.

### VII. Audit Logging

All state-changing operations (bookings created/modified/cancelled, payments processed, role
assignments, admin actions) MUST emit structured audit log entries. Each entry MUST contain:
`timestamp` (ISO 8601), `actor_id`, `action`, `resource_type`, `resource_id`, `before_state`
(where applicable), `after_state`, and `ip_address`. Audit logs MUST be append-only and stored in
a separate store from application logs. Read access to audit logs MUST be restricted to `admin`
roles.

**Rationale**: Regulatory compliance and fraud investigation require a tamper-evident, queryable
history of all business-critical events.

### VIII. Payment Security

Payment card data MUST never be stored, logged, or transmitted by the application; all card
processing MUST be delegated to a PCI-DSS compliant provider (e.g., Stripe, Braintree). Webhooks
from payment providers MUST be verified using the provider-supplied HMAC signature before being
processed. Refund and cancellation flows MUST be idempotent with a provider-level idempotency
key. Application-level payment logs MUST record amount, currency, reference ID, and result — card
numbers and CVVs are prohibited in any log.

**Rationale**: PCI-DSS non-compliance and payment data breaches carry severe legal penalties;
delegating card handling to a certified provider eliminates the largest compliance surface.

### IX. Accessibility & Responsive UI

All UI components MUST meet WCAG 2.1 Level AA. Interactive elements MUST be keyboard-navigable
with a visible focus indicator meeting a 3:1 contrast ratio. Normal text MUST meet a 4.5:1
contrast ratio. All meaningful images MUST have descriptive `alt` text. The application MUST be
fully functional on viewports from 320 px to 2 560 px. Breakpoints and spacing MUST use design
tokens; hardcoded pixel values for layout are prohibited.

**Rationale**: Legal accessibility requirements (e.g., EAA, ADA) and predominant mobile usage in
the booking sector require both compliance and broad device coverage.

### X. Automated Testing

Unit tests are REQUIRED for all business logic and utility functions (≥ 80 % branch coverage on
the domain layer). Integration tests are REQUIRED for all API endpoints and database interactions.
End-to-end tests are REQUIRED for each critical user journey (booking, payment, cancellation).
All tests MUST run in CI on every pull request; a failing test blocks merge. Test data MUST be
isolated per test run with no shared mutable state between tests.

**Rationale**: Regressions in a booking and payment system have direct revenue impact; automated
tests are the primary safety net enabling incremental delivery without regressions.

### XI. Clear Documentation

Every public API endpoint MUST have an OpenAPI 3.x specification kept in sync with the
implementation. Every module MUST have a README describing its purpose, environment variables, and
external dependencies. Architecture Decision Records (ADRs) MUST be written for non-obvious
architectural choices. Inline code comments are reserved for the *why*, not the *what*. All
documentation MUST be updated in the same pull request as the code change it describes.

**Rationale**: A modular system maintained by multiple contributors requires documentation that
keeps pace with code to enable safe onboarding and modification.

### XII. Incremental Delivery by Modules

The application MUST be delivered as independently releasable modules: Authentication, Booking,
Payments, Notifications, Admin. Each module MUST have an approved API contract (OpenAPI spec +
domain events) before implementation begins. Modules MUST be deployable without coordinated
releases of other modules. Incomplete or experimental functionality MUST be gated behind feature
flags; partially-implemented features MUST NOT reach production users unflagged.

**Rationale**: Incremental delivery reduces deployment risk, enables early user feedback, and
keeps the main branch always releasable.

## Quality Gates & Standards

All pull requests MUST pass the following gates before merge:

- TypeScript compilation with zero errors (`tsc --noEmit`)
- ESLint with zero error-level violations
- Unit and integration test suite: 100 % pass, ≥ 80 % domain-layer branch coverage
- OWASP dependency audit (`npm audit` or equivalent) with no unaddressed high/critical CVEs
- Accessibility lint (`axe-core` or equivalent) with zero critical violations

Pull requests touching authentication, payments, or RBAC changes MUST receive an additional
review from a team member with security expertise.

OpenAPI specs MUST be validated against the running implementation in CI using a contract-diffing
tool on every PR that modifies an API route.

## Development Workflow

Modules are delivered in the following priority order in accordance with Principle XII:

1. **Foundation** — Auth, RBAC, database schema, migrations, audit logging infrastructure
2. **Core Booking** — Availability search, booking creation, modification, cancellation
3. **Payments** — Payment processing, refunds, idempotent webhook handling
4. **Notifications** — Email/SMS confirmations and reminders
5. **Admin & Reporting** — Dashboard, audit log viewer, analytics

Each module MUST have an approved spec, plan, and task list before implementation begins. A module
MUST NOT depend on another module's internal implementation — only on its published contract.

Branch naming convention: `feat/<module>-<###>-<short-description>`. All changes target `main`
via a pull request. Direct pushes to `main` are prohibited.

## Governance

This constitution supersedes all other project conventions. Conflicts MUST be resolved by amending
this constitution, not by creating in-code exceptions.

**Amendment procedure**:
1. Author proposes a change as a pull request modifying `.specify/memory/constitution.md`.
2. At least one senior engineer and one product stakeholder MUST approve.
3. All affected templates and guidance files MUST be updated in the same pull request.
4. The version MUST be bumped according to the versioning policy below.

**Versioning policy**:
- MAJOR: Removal or redefinition of an existing principle.
- MINOR: Addition of a new principle or materially expanded guidance.
- PATCH: Clarifications, wording refinements, or typo fixes.

**Compliance review**: Every PR reviewer MUST verify that the changes comply with the relevant
principles. An architecture review MUST be scheduled at the start of each new module.

**Version**: 1.0.0 | **Ratified**: 2026-05-24 | **Last Amended**: 2026-05-24
