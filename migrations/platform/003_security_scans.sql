CREATE SCHEMA IF NOT EXISTS indusbase_platform;

CREATE TABLE IF NOT EXISTS indusbase_platform.security_scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type VARCHAR(50) NOT NULL,           -- dependency | container | secrets | sbom
    tool_name VARCHAR(100) NOT NULL,          -- trivy | npm-audit | pip-audit | cargo-audit | govulncheck | gitleaks
    status VARCHAR(20) NOT NULL,              -- success | failed | warning
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    report_url TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scan_runs_type_time
    ON indusbase_platform.security_scan_runs(scan_type, created_at DESC);

CREATE TABLE IF NOT EXISTS indusbase_platform.dependency_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_run_id UUID REFERENCES indusbase_platform.security_scan_runs(id) ON DELETE CASCADE,
    ecosystem VARCHAR(30) NOT NULL,           -- go | rust | npm | python
    package_name TEXT NOT NULL,
    installed_version TEXT,
    fixed_version TEXT,
    severity VARCHAR(20) NOT NULL,            -- low | medium | high | critical
    cve TEXT,
    advisory_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependency_findings_severity
    ON indusbase_platform.dependency_findings(severity, created_at DESC);

CREATE TABLE IF NOT EXISTS indusbase_platform.container_scan_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_run_id UUID REFERENCES indusbase_platform.security_scan_runs(id) ON DELETE CASCADE,
    image_name TEXT NOT NULL,
    package_name TEXT,
    installed_version TEXT,
    fixed_version TEXT,
    severity VARCHAR(20) NOT NULL,
    cve TEXT,
    title TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_container_scan_findings_severity
    ON indusbase_platform.container_scan_findings(severity, created_at DESC);
