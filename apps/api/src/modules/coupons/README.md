# Coupons Module

Manages discount coupons that can be applied at checkout to reduce the booking price.

## Purpose

- `POST /coupons` — create a coupon (ADMIN / SUPER_ADMIN)
- `GET /coupons` — list all active coupons (ADMIN / SUPER_ADMIN)
- `GET /coupons/:code` — look up a coupon by code (authenticated users, for checkout preview)
- `DELETE /coupons/:id` — deactivate a coupon (ADMIN / SUPER_ADMIN)
- `POST /bookings` — accepts optional `couponCode` field; applies discount before creating a payment

## Coupon Types

| Type | Effect |
|------|--------|
| `PERCENTAGE` | Reduces price by a percentage (e.g. 20 = 20% off) |
| `FIXED_CENTS` | Reduces price by a fixed amount in cents (e.g. 1000 = $10 off) |

## Validation Rules

- `maxUses`: optional cap on total redemptions; enforced atomically in a transaction
- `expiresAt`: optional expiry timestamp; expired coupons return 404 on lookup
- `isActive`: boolean flag; deactivated coupons are excluded from all queries
- A coupon cannot reduce the booking price below 0

## Audit Trail

Coupon creation emits a `COUPON_CREATED` audit log entry.

## Public contract

See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1coupons`.
