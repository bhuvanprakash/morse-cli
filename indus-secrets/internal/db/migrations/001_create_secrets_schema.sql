CREATE SCHEMA IF NOT EXISTS indusbase_secrets;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS indusbase_secrets.secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    scope TEXT NOT NULL, -- platform|organization|project|function
    organization_id UUID,
    project_id UUID,
    function_id TEXT,
    active_version INT NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_secrets_scope ON indusbase_secrets.secrets(scope, project_id, organization_id);

CREATE TABLE IF NOT EXISTS indusbase_secrets.secret_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID NOT NULL REFERENCES indusbase_secrets.secrets(id) ON DELETE CASCADE,
    version INT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,
    UNIQUE(secret_id, version)
);
CREATE INDEX IF NOT EXISTS idx_secret_versions_secret ON indusbase_secrets.secret_versions(secret_id, version DESC);

CREATE TABLE IF NOT EXISTS indusbase_secrets.rotation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID NOT NULL REFERENCES indusbase_secrets.secrets(id) ON DELETE CASCADE,
    from_version INT,
    to_version INT NOT NULL,
    action TEXT NOT NULL, -- rotate|rollback
    actor TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
