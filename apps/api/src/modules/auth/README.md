# Auth Module

Handles user registration, login, JWT issuance, and RBAC guards.

## Purpose

- `POST /auth/register` — create a new user (STUDENT role by default)
- `POST /auth/login` — validate credentials and return a signed JWT
- `JwtAuthGuard` — validates `Bearer <token>` on protected routes
- `RolesGuard` + `@Roles(...)` — enforces role-based access on handlers
- `@CurrentUser()` — param decorator that extracts the authenticated user from the request

## Env vars

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing secret for JWT tokens (minimum 32 chars) |
| `JWT_EXPIRY` | Token TTL (default: `7d`) |

## Public contract

`POST /auth/register` · `POST /auth/login`  
See `specs/001-class-booking-platform/contracts/openapi.yaml` → `#/paths/~1auth`.
