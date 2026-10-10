-- ====================================================================
-- FrostLedger Migration 001: Initial Core Schema and Immutability Triggers
-- ====================================================================

-- 1. Devices table
CREATE TABLE IF NOT EXISTS devices (
  device_id VARCHAR(128) PRIMARY KEY,
  org_id VARCHAR(128) NOT NULL,
  public_key VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);

-- 2. Profiles table (Versioned & Immutable)
CREATE TABLE IF NOT EXISTS profiles (
  profile_id VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL,
  parameters JSONB NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, version)
);

-- Database Trigger enforcing profile immutability
CREATE OR REPLACE FUNCTION prevent_profile_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'profiles table is immutable by version: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_immutability ON profiles;
CREATE TRIGGER trg_profile_immutability
BEFORE UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_profile_mutation();

-- 3. Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id VARCHAR(128) PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL REFERENCES devices(device_id),
  profile_id VARCHAR(128) NOT NULL,
  profile_version INTEGER NOT NULL,
  profile_hash VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (profile_id, profile_version) REFERENCES profiles(profile_id, version)
);

-- 4. Batches table (Unique sequence per device)
CREATE TABLE IF NOT EXISTS batches (
  batch_id VARCHAR(64) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  device_id VARCHAR(128) NOT NULL REFERENCES devices(device_id),
  sequence_no BIGINT NOT NULL,
  prev_hash VARCHAR(64) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_sequence UNIQUE (device_id, sequence_no)
);

-- 5. Events table
CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR(64) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  type VARCHAR(64) NOT NULL,
  magnitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- 6. Anchors table
CREATE TABLE IF NOT EXISTS anchors (
  batch_id VARCHAR(64) PRIMARY KEY REFERENCES batches(batch_id),
  tx_hash VARCHAR(128) NULL,
  chain VARCHAR(64) NOT NULL DEFAULT 'polygon-amoy',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  anchored_at TIMESTAMPTZ NULL
);

-- 7. Shelf life trail table
CREATE TABLE IF NOT EXISTS shelf_life_trail (
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  batch_id VARCHAR(64) NOT NULL REFERENCES batches(batch_id),
  mkt DOUBLE PRECISION NOT NULL,
  consumed_fraction DOUBLE PRECISION NOT NULL,
  remaining_life DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shipment_id, batch_id)
);

-- 8. Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  alert_id VARCHAR(64) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  type VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL, -- deterministic | security
  acknowledged_by VARCHAR(128) NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AI Insights table
CREATE TABLE IF NOT EXISTS ai_insights (
  insight_id VARCHAR(64) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  kind VARCHAR(32) NOT NULL, -- anomaly | forecast | risk | spoofing
  score DOUBLE PRECISION NOT NULL,
  severity VARCHAR(32) NOT NULL, -- info | warning | critical
  explanation TEXT NOT NULL,
  input_ref VARCHAR(128) NOT NULL,
  warmup_status VARCHAR(32) NOT NULL, -- warming_up | active
  model_name VARCHAR(64) NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. AI Model State table
CREATE TABLE IF NOT EXISTS ai_model_state (
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  model_version VARCHAR(32) NOT NULL,
  state JSONB NOT NULL,
  last_batch_id VARCHAR(64) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shipment_id, model_version)
);

-- 11. AI Notifications table
CREATE TABLE IF NOT EXISTS ai_notifications (
  notification_id VARCHAR(64) PRIMARY KEY,
  insight_id VARCHAR(64) NOT NULL REFERENCES ai_insights(insight_id),
  shipment_id VARCHAR(128) NOT NULL REFERENCES shipments(shipment_id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL -- sent | suppressed | failed
);

-- 12. AI Evaluations table
CREATE TABLE IF NOT EXISTS ai_evaluations (
  evaluation_id VARCHAR(64) PRIMARY KEY,
  model_name VARCHAR(64) NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  precision DOUBLE PRECISION NOT NULL,
  recall DOUBLE PRECISION NOT NULL,
  false_alert_rate DOUBLE PRECISION NOT NULL,
  avg_lead_time_seconds DOUBLE PRECISION NOT NULL,
  dataset_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Audit Log table (Append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  log_id VARCHAR(64) PRIMARY KEY,
  actor VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  target VARCHAR(256) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database Trigger enforcing audit_log append-only
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log table is append-only: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutability ON audit_log;
CREATE TRIGGER trg_audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- 14. Users table
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(64) PRIMARY KEY,
  org_id VARCHAR(128) NOT NULL,
  email VARCHAR(256) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(32) NOT NULL, -- operator | receiver | auditor | admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- Role Configuration: ai_service_role
-- Read-only on official tables, INSERT/UPDATE on the 4 AI tables.
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_service_role') THEN
    CREATE ROLE ai_service_role WITH LOGIN PASSWORD 'ai_service_password';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Role already exists
    NULL;
  WHEN insufficient_privilege THEN
    -- If executed in environments without superuser role creation
    NULL;
END
$$;

-- Grant SELECT on official tables
GRANT SELECT ON devices, profiles, shipments, batches, events, anchors, shelf_life_trail, alerts, audit_log, users TO ai_service_role;

-- Grant SELECT, INSERT, UPDATE on AI tables
GRANT SELECT, INSERT, UPDATE ON ai_insights, ai_model_state, ai_notifications, ai_evaluations TO ai_service_role;

-- Revoke write privileges on official tables explicitly
REVOKE INSERT, UPDATE, DELETE ON devices, profiles, shipments, batches, events, anchors, shelf_life_trail, alerts, audit_log, users FROM ai_service_role;
