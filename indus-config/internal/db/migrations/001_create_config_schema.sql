CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS indusbase_config;

CREATE TABLE IF NOT EXISTS indusbase_config.environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    is_production BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO indusbase_config.environments (name, description, is_production)
VALUES
  ('development', 'Local development environment', FALSE),
  ('staging', 'Pre-production staging environment', FALSE),
  ('production', 'Live production environment', TRUE)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS indusbase_config.flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(200) NOT NULL,
    environment_id UUID NOT NULL REFERENCES indusbase_config.environments(id),
    description TEXT DEFAULT '',
    value_type VARCHAR(20) DEFAULT 'boolean',
    default_value TEXT NOT NULL DEFAULT 'false',
    targeting_rules JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(key, environment_id)
);

CREATE TABLE IF NOT EXISTS indusbase_config.remote_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(200) NOT NULL,
    environment_id UUID NOT NULL REFERENCES indusbase_config.environments(id),
    value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string',
    description TEXT DEFAULT '',
    is_secret BOOLEAN DEFAULT FALSE,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(key, environment_id)
);

INSERT INTO indusbase_config.remote_configs (key, environment_id, value, value_type, description)
SELECT 'app_upi_enabled', id, 'true', 'boolean', 'Enable UPI payment flow'
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.remote_configs (key, environment_id, value, value_type, description)
SELECT 'app_min_version_android', id, '2.1.0', 'string', 'Minimum Android app version'
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.remote_configs (key, environment_id, value, value_type, description)
SELECT 'app_min_version_ios', id, '2.1.0', 'string', 'Minimum iOS app version'
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.flags (key, environment_id, description, value_type, default_value, targeting_rules, is_active)
SELECT 'whatsapp_otp_enabled', id, 'Enable WhatsApp OTP login', 'boolean', 'true', '[]'::jsonb, TRUE
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.flags (key, environment_id, description, value_type, default_value, targeting_rules, is_active)
SELECT 'aadhaar_kyc_enabled', id, 'Enable Aadhaar eKYC', 'boolean', 'false', '[]'::jsonb, TRUE
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.flags (key, environment_id, description, value_type, default_value, targeting_rules, is_active)
SELECT 'upi_autopay_enabled', id, 'Enable UPI autopay flows', 'boolean', 'false', '[]'::jsonb, TRUE
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

INSERT INTO indusbase_config.flags (key, environment_id, description, value_type, default_value, targeting_rules, is_active)
SELECT 'hindi_ui_enabled', id, 'Enable Hindi UI', 'boolean', 'true', '[]'::jsonb, TRUE
FROM indusbase_config.environments WHERE name = 'production'
ON CONFLICT (key, environment_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_indusbase_config_flags_env_active ON indusbase_config.flags(environment_id, is_active);
CREATE INDEX IF NOT EXISTS idx_indusbase_config_remote_env ON indusbase_config.remote_configs(environment_id);
