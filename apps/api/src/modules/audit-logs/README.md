# Audit Logs Module

Provides a tamper-evident record of all significant administrative and system actions.

## Purpose

- `GET /admin/audit-logs` — paginated list with filters (ADMIN / SUPER_ADMIN)

Write operations are performed directly by other services — there is no public create endpoint.

## Schema

```
AuditLog {
  id          String   (cuid)
  actorId     String?  (null for system actions)
  action      String   (e.g. SETTING_UPDATED, BOOKING_CANCELLED_ADMIN)
  resourceType String  (e.g. Booking, Setting, User)
  resourceId  String
  before      Json?    (snapshot before change)
  after       Json?    (snapshot after change)
  createdAt   DateTime
}
```

## Logged Actions

| Action | Emitted by |
|--------|-----------|
| `BOOKING_CANCELLED_ADMIN` | `BookingsService` |
| `SETTING_UPDATED` | `SettingsService` |
| `REFUND_ISSUED` | `PaymentsService` |
| `COUPON_CREATED` | `CouponsService` |
| `WAITLIST_PROMOTED_MANUAL` | `WaitlistService` |
| `ATTENDANCE_MARKED` | `BookingsService` |

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1admin~1audit-logs`.
