CREATE SCHEMA IF NOT EXISTS indusbase_audit;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS indusbase_audit.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    actor_user_id UUID,
    actor_email TEXT,
    actor_type VARCHAR(30) NOT NULL, -- user | service | system | scim
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- info | warn | error | critical
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_project ON indusbase_audit.audit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON indusbase_audit.audit_events(actor_user_id, actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON indusbase_audit.audit_events(action, resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON indusbase_audit.audit_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON indusbase_audit.audit_events(created_at DESC);
