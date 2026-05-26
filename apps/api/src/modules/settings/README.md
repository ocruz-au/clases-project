# Settings Module

Provides runtime-configurable platform settings with an in-process TTL cache.

## Purpose

- `GET /settings` — list all settings (SUPER_ADMIN)
- `GET /settings/:key` — get a single setting value (SUPER_ADMIN)
- `PUT /settings/:key` — update a setting value (SUPER_ADMIN); writes an audit log entry

## Configurable Settings

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| `seatHoldWindowMinutes` | number | 10 | How long a seat hold stays valid before expiry |
| `reminderLeadHours` | number | 24 | How many hours before a session the reminder is sent |
| `defaultCancellationPolicyId` | string | null | Falls back to `isDefault: true` policy if null |
| `sessionExpiryHours` | number | 1 | Hours after session start that remaining seats are freed |
| `maxLoginAttempts` | number | 5 | Failed login attempts before temporary lockout |

## Caching

`SettingsService` caches each key in memory with a 60-second TTL. Every `set()` call immediately updates the cache so reads after writes are always consistent within the same process.

## Audit Trail

Every `PUT /settings/:key` call creates an `AuditLog` row with `action: 'SETTING_UPDATED'`.

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1settings`.
