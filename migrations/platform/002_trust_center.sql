CREATE SCHEMA IF NOT EXISTS indusbase_platform;

CREATE TABLE IF NOT EXISTS indusbase_platform.trust_center_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_status_text TEXT NOT NULL DEFAULT 'All systems operational',
    security_contact_email TEXT NOT NULL DEFAULT 'security@indusbase.com',
    faq JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indusbase_platform.subprocessors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'ap-south-1',
    website TEXT,
    data_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subprocessors_active ON indusbase_platform.subprocessors(is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS indusbase_platform.compliance_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework TEXT NOT NULL,
    target_date DATE,
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indusbase_platform.public_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    impact TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'investigating',
    postmortem_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
