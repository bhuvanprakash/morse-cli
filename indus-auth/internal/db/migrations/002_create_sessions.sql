-- Migration: Create sessions table
-- Up

CREATE TABLE IF NOT EXISTS indusbase_auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES indusbase_auth.users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON indusbase_auth.sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON indusbase_auth.sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON indusbase_auth.sessions(expires_at);
CREATE INDEX idx_sessions_is_revoked ON indusbase_auth.sessions(is_revoked);

-- Create trigger for updated_at
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON indusbase_auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION indusbase_auth.update_updated_at_column();

-- Down

DROP TRIGGER IF EXISTS update_sessions_updated_at ON indusbase_auth.sessions;
DROP INDEX IF EXISTS indusbase_auth.idx_sessions_is_revoked;
DROP INDEX IF EXISTS indusbase_auth.idx_sessions_expires_at;
DROP INDEX IF EXISTS indusbase_auth.idx_sessions_refresh_token;
DROP INDEX IF EXISTS indusbase_auth.idx_sessions_user_id;
DROP TABLE IF EXISTS indusbase_auth.sessions;
