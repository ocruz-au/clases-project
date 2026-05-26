# Reports Module

Aggregates business metrics over a date range for admin dashboards and CSV exports.

## Purpose

- `GET /admin/reports/bookings?from=&to=` — confirmed booking count
- `GET /admin/reports/revenue?from=&to=` — total revenue in cents + payment count
- `GET /admin/reports/attendance?from=&to=` — breakdown by CONFIRMED / ATTENDED / NO_SHOW
- `GET /admin/reports/cancellations?from=&to=` — cancellation count
- `GET /admin/reports/waitlist-conversion?from=&to=` — total, converted, conversion rate %

All endpoints require `ADMIN` or `SUPER_ADMIN` role.

## Date Range

`from` and `to` are Perth local calendar dates (`YYYY-MM-DD`). The service converts them to UTC bounds using `dateRangeUTC()` from `packages/shared`:

- `from` → midnight Perth (`UTC+8`) = 16:00 UTC previous day
- `to` (inclusive) → end of day Perth = 15:59:59.999 UTC same day

## Frontend

The admin Reports page (`apps/web/src/app/(admin)/reports/`) provides:

- Date range picker defaulting to the current calendar month
- Stat cards for bookings, revenue, cancellations, and waitlist conversion
- Attendance breakdown panel
- "Download CSV" button that exports all metrics client-side

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1admin~1reports`.
