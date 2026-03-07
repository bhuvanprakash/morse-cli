-- Migration: Create replication role and setup logical replication
-- Created: 2026-03-05

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- Create replication role with REPLICATION and LOGIN privileges
CREATE ROLE indusbase_replication WITH 
    REPLICATION 
    LOGIN 
    PASSWORD '${DB_REPLICATION_PASSWORD}';

-- Grant CONNECT on the database
GRANT CONNECT ON DATABASE ${DB_NAME} TO indusbase_replication;

-- Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO indusbase_replication;

-- Grant SELECT on all existing tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO indusbase_replication;

-- Grant SELECT on future tables (via default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT ON TABLES TO indusbase_replication;

-- Create logical replication slot for realtime changes
-- Using pgoutput plugin for PostgreSQL 10+ compatibility
SELECT pg_create_logical_replication_slot('indusbase_realtime', 'pgoutput');

-- Create publication for all tables in public schema
CREATE PUBLICATION indusbase_pub FOR ALL TABLES IN SCHEMA public;

-- ============================================================================
-- DOWN MIGRATION (Uncomment to rollback)
-- ============================================================================

/*
-- Drop the replication slot
SELECT pg_drop_replication_slot('indusbase_realtime');

-- Drop the publication
DROP PUBLICATION IF EXISTS indusbase_pub;

-- Revoke default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    REVOKE SELECT ON TABLES FROM indusbase_replication;

-- Revoke privileges on all tables
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM indusbase_replication;

-- Revoke schema usage
REVOKE USAGE ON SCHEMA public FROM indusbase_replication;

-- Revoke database connect
-- Note: This needs to be run on the specific database
-- REVOKE CONNECT ON DATABASE ${DB_NAME} FROM indusbase_replication;

-- Drop the replication role
DROP ROLE IF EXISTS indusbase_replication;
*/

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON ROLE indusbase_replication IS 'Replication role for logical replication (realtime changes)';
COMMENT ON PUBLICATION indusbase_pub IS 'Publication for all tables in public schema for realtime replication';
