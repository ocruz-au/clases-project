-- Partial unique index: prevents duplicate ACTIVE bookings (HELD or CONFIRMED)
-- for the same (classSessionId, userId) pair. Prisma schema DSL does not support
-- WHERE clauses on indexes; this raw migration handles it.
CREATE UNIQUE INDEX IF NOT EXISTS booking_active_unique
  ON bookings ("classSessionId", "userId")
  WHERE status IN ('HELD', 'CONFIRMED');

-- Partial unique index: ensures a user is on the waitlist only once per session
-- (ignoring REMOVED, SKIPPED, EXPIRED, CONVERTED terminal states).
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_entry_active_unique
  ON waitlist_entries ("classSessionId", "userId")
  WHERE status NOT IN ('REMOVED', 'SKIPPED', 'EXPIRED', 'CONVERTED');

-- Partial unique index: ensures position numbers within a session are unique
-- only among WAITING entries (avoids conflicts after removals/skips).
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_position_unique
  ON waitlist_entries ("classSessionId", position)
  WHERE status = 'WAITING';
