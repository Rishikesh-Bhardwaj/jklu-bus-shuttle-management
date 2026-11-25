-- Migration 011: Resource lifecycle status for corridors, routes, and stops.
-- Existing IDs and historical trip records are preserved.
ALTER TABLE route_corridors
  ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE routes
  ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE stops
  ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';
