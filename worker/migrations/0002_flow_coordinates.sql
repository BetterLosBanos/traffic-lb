-- Add coordinates column to flow_segments
-- Stores the actual road segment geometry from TomTom as JSON array of [lat, lng] pairs
ALTER TABLE flow_segments ADD COLUMN coordinates TEXT;

-- Drop old jam_factor from flow_segments (no-op in SQLite — keep column, just stop using it)
