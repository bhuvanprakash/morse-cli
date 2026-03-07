-- Platform-level schema (separate from any project schema)
CREATE SCHEMA IF NOT EXISTS indusbase_platform;

CREATE TABLE IF NOT EXISTS indusbase_platform.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    plan        VARCHAR(30)  DEFAULT 'free',
    owner_email TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indusbase_platform.projects (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES indusbase_platform.organizations(id) ON DELETE CASCADE,
    name             VARCHAR(200) NOT NULL,
    slug             VARCHAR(100) NOT NULL,
    db_schema        VARCHAR(100) UNIQUE NOT NULL,
    jwt_secret       TEXT NOT NULL,
    anon_key         TEXT UNIQUE NOT NULL,
    service_role_key TEXT UNIQUE NOT NULL,
    region           VARCHAR(50) DEFAULT 'ap-south-1',
    status           VARCHAR(20) DEFAULT 'active',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_projects_anon_key ON indusbase_platform.projects(anon_key);
CREATE INDEX IF NOT EXISTS idx_projects_service_role_key ON indusbase_platform.projects(service_role_key);

CREATE TABLE IF NOT EXISTS indusbase_platform.project_members (
    project_id  UUID NOT NULL REFERENCES indusbase_platform.projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        VARCHAR(20) DEFAULT 'developer',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS indusbase_platform.usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES indusbase_platform.projects(id),
    metric      VARCHAR(50) NOT NULL,
    quantity    BIGINT NOT NULL DEFAULT 0,
    period      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, metric, period)
);
