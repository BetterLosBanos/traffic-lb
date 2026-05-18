-- Traffic samples: one row per cron tick per direction
-- Stores data from all 3 TomTom APIs (Routing, Flow Segment, Incidents)
CREATE TABLE traffic_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,                    -- 'northbound' | 'southbound'

  -- Routing API
  duration_seconds INTEGER NOT NULL,          -- travel time with traffic
  no_traffic_seconds INTEGER NOT NULL,        -- free-flow travel time
  historic_seconds INTEGER,                   -- typical for this time/day
  delay_seconds INTEGER NOT NULL,             -- duration - no_traffic
  congestion_ratio REAL NOT NULL,             -- duration / no_traffic
  distance_meters INTEGER NOT NULL,
  traffic_delay_seconds INTEGER,              -- live incident delay only

  -- Flow Segment (sampled at route midpoint)
  current_speed_kph REAL,
  free_flow_speed_kph REAL,
  jam_factor REAL,

  -- Incidents (stored as JSON array)
  incidents TEXT,                             -- JSON: [{type, severity, description, roadName}]

  -- Debug / audit
  provider TEXT NOT NULL DEFAULT 'tomtom',
  api_status TEXT NOT NULL DEFAULT 'ok',      -- 'ok' | 'partial' | 'error'
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Route segment speeds for map coloring
-- One row per sample point per collection tick
CREATE TABLE flow_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL REFERENCES traffic_samples(id),
  direction TEXT NOT NULL,
  point_index INTEGER NOT NULL,               -- 0-based index along route
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  current_speed_kph REAL NOT NULL,
  free_flow_speed_kph REAL NOT NULL,
  jam_factor REAL NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_samples_direction ON traffic_samples(direction);
CREATE INDEX idx_samples_created ON traffic_samples(created_at);
CREATE INDEX idx_segments_sample ON flow_segments(sample_id);
CREATE INDEX idx_segments_created ON flow_segments(created_at);
