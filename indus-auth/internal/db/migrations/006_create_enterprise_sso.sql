-- Migration: Create enterprise SSO schema objects
-- Up

CREATE TABLE IF NOT EXISTS indusbase_auth.verified_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,
    project_id UUID,
    domain VARCHAR(255) UNIQUE NOT NULL,
    verification_token TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verified_domains_domain ON indusbase_auth.verified_domains(domain);
CREATE INDEX IF NOT EXISTS idx_verified_domains_project ON indusbase_auth.verified_domains(project_id);

CREATE TABLE IF NOT EXISTS indusbase_auth.enterprise_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,
    project_id UUID,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) NOT NULL,
    provider_type VARCHAR(20) NOT NULL, -- saml | oidc
    provider_name VARCHAR(120) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_connections_slug ON indusbase_auth.enterprise_connections(slug);
CREATE INDEX IF NOT EXISTS idx_enterprise_connections_domain ON indusbase_auth.enterprise_connections(domain);
CREATE INDEX IF NOT EXISTS idx_enterprise_connections_project ON indusbase_auth.enterprise_connections(project_id);

CREATE TABLE IF NOT EXISTS indusbase_auth.saml_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES indusbase_auth.enterprise_connections(id) ON DELETE CASCADE,
    certificate_pem TEXT NOT NULL,
    fingerprint_sha256 TEXT,
    not_before TIMESTAMPTZ,
    not_after TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saml_cert_connection ON indusbase_auth.saml_certificates(connection_id, is_active);

CREATE TABLE IF NOT EXISTS indusbase_auth.identity_provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES indusbase_auth.enterprise_connections(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES indusbase_auth.users(id) ON DELETE CASCADE,
    email TEXT,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, external_user_id)
);
CREATE INDEX IF NOT EXISTS idx_idp_mappings_user ON indusbase_auth.identity_provider_mappings(user_id);

CREATE TABLE IF NOT EXISTS indusbase_auth.sso_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES indusbase_auth.enterprise_connections(id) ON DELETE SET NULL,
    provider_type VARCHAR(20) NOT NULL,
    provider_name VARCHAR(120) NOT NULL,
    domain VARCHAR(255),
    email TEXT,
    status VARCHAR(20) NOT NULL, -- success | failed
    failure_code VARCHAR(80),
    failure_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_created ON indusbase_auth.sso_login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_connection ON indusbase_auth.sso_login_events(connection_id);

-- Down
DROP TABLE IF EXISTS indusbase_auth.sso_login_events;
DROP TABLE IF EXISTS indusbase_auth.identity_provider_mappings;
DROP TABLE IF EXISTS indusbase_auth.saml_certificates;
DROP TABLE IF EXISTS indusbase_auth.enterprise_connections;
DROP TABLE IF EXISTS indusbase_auth.verified_domains;
