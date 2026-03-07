-- Migration: Create OAuth accounts table
-- Up

CREATE TABLE IF NOT EXISTS indusbase_auth.oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES indusbase_auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email CITEXT,
    name VARCHAR(255),
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(provider, provider_user_id)
);

-- Create indexes
CREATE INDEX idx_oauth_accounts_user_id ON indusbase_auth.oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON indusbase_auth.oauth_accounts(provider);
CREATE INDEX idx_oauth_accounts_provider_user_id ON indusbase_auth.oauth_accounts(provider_user_id);
CREATE INDEX idx_oauth_accounts_email ON indusbase_auth.oauth_accounts(email);

-- Create trigger for updated_at
CREATE TRIGGER update_oauth_accounts_updated_at
    BEFORE UPDATE ON indusbase_auth.oauth_accounts
    FOR EACH ROW
    EXECUTE FUNCTION indusbase_auth.update_updated_at_column();

-- Down

DROP TRIGGER IF EXISTS update_oauth_accounts_updated_at ON indusbase_auth.oauth_accounts;
DROP INDEX IF EXISTS indusbase_auth.idx_oauth_accounts_email;
DROP INDEX IF EXISTS indusbase_auth.idx_oauth_accounts_provider_user_id;
DROP INDEX IF EXISTS indusbase_auth.idx_oauth_accounts_provider;
DROP INDEX IF EXISTS indusbase_auth.idx_oauth_accounts_user_id;
DROP TABLE IF EXISTS indusbase_auth.oauth_accounts;
