-- Migration: Create users table
-- Up

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create schema
CREATE SCHEMA IF NOT EXISTS indusbase_auth;

-- Create users table
CREATE TABLE IF NOT EXISTS indusbase_auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_users_email ON indusbase_auth.users(email);
CREATE INDEX idx_users_phone ON indusbase_auth.users(phone);
CREATE INDEX idx_users_created_at ON indusbase_auth.users(created_at);
CREATE INDEX idx_users_role ON indusbase_auth.users(role);
CREATE INDEX idx_users_status ON indusbase_auth.users(status);
CREATE INDEX idx_users_deleted_at ON indusbase_auth.users(deleted_at) WHERE deleted_at IS NULL;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION indusbase_auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON indusbase_auth.users
    FOR EACH ROW
    EXECUTE FUNCTION indusbase_auth.update_updated_at_column();

-- Down

DROP TRIGGER IF EXISTS update_users_updated_at ON indusbase_auth.users;
DROP FUNCTION IF EXISTS indusbase_auth.update_updated_at_column();
DROP INDEX IF EXISTS indusbase_auth.idx_users_deleted_at;
DROP INDEX IF EXISTS indusbase_auth.idx_users_status;
DROP INDEX IF EXISTS indusbase_auth.idx_users_role;
DROP INDEX IF EXISTS indusbase_auth.idx_users_created_at;
DROP INDEX IF EXISTS indusbase_auth.idx_users_phone;
DROP INDEX IF EXISTS indusbase_auth.idx_users_email;
DROP TABLE IF EXISTS indusbase_auth.users;
DROP SCHEMA IF EXISTS indusbase_auth;
