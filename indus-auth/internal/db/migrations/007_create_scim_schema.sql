-- Migration: Create SCIM provisioning schema objects
-- Up

CREATE TABLE IF NOT EXISTS indusbase_auth.scim_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES indusbase_auth.enterprise_connections(id) ON DELETE CASCADE,
    project_id UUID,
    name VARCHAR(120) NOT NULL,
    token_prefix VARCHAR(24) NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_connection ON indusbase_auth.scim_tokens(connection_id);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_active ON indusbase_auth.scim_tokens(revoked_at, expires_at);

-- Down
DROP TABLE IF EXISTS indusbase_auth.scim_tokens;
