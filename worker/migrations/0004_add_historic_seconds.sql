-- Add historic_seconds column for dual-baseline delay calculation
-- Note: May fail on existing databases where column already exists (safe to ignore)
-- New setups: applies cleanly
-- Existing setups: column already present, migration tracked as applied

ALTER TABLE traffic_samples ADD COLUMN historic_seconds INTEGER;
