-- Migration 012: Add a soft-deleted trip lifecycle state.
-- The trip row remains in place because bookings and check-ins reference it.
ALTER TABLE trips
  MODIFY COLUMN trip_status ENUM('SCHEDULED', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'DELETED')
  NOT NULL DEFAULT 'SCHEDULED';
