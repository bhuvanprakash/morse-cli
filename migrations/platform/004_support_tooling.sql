CREATE SCHEMA IF NOT EXISTS indusbase_platform;

CREATE TABLE IF NOT EXISTS indusbase_platform.support_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    user_id UUID,
    actor_user_id UUID,
    actor_email TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    note TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_notes_project ON indusbase_platform.support_notes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_notes_user ON indusbase_platform.support_notes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS indusbase_platform.impersonation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_user_id UUID,
    requester_email TEXT,
    target_user_id UUID NOT NULL,
    target_project_id UUID,
    reason TEXT NOT NULL,
    approval_token TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | denied | expired
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_requests_status ON indusbase_platform.impersonation_requests(status, created_at DESC);
