-- indus-ai Database Schema Migration
-- 
-- UP Migration: Create the indusbase_ai schema with pgvector support
-- DOWN Migration: Drop the indusbase_ai schema

-- =============================================================================
-- UP: Create schema and tables
-- =============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the indusbase_ai schema
CREATE SCHEMA IF NOT EXISTS indusbase_ai;

-- Create collections table
CREATE TABLE IF NOT EXISTS indusbase_ai.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table with vector embedding support
-- The embedding column stores vectors up to 1536 dimensions (vector(1536))
CREATE TABLE IF NOT EXISTS indusbase_ai.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES indusbase_ai.collections(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),  -- Max 1536 dimensions, smaller vectors are truncated on insert
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying

-- IVFFlat index for vector similarity search
-- Note: This index works best when the table has data
-- The lists parameter controls the number of clusters
CREATE INDEX IF NOT EXISTS idx_documents_collection_embedding 
    ON indusbase_ai.documents 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- GIN index for JSONB metadata filtering
CREATE INDEX IF NOT EXISTS idx_documents_metadata 
    ON indusbase_ai.documents USING gin(metadata);

-- Index on collection_id for faster document lookups by collection
CREATE INDEX IF NOT EXISTS idx_documents_collection_id 
    ON indusbase_ai.documents(collection_id);

-- Index on created_at for time-based sorting
CREATE INDEX IF NOT EXISTS idx_documents_created_at 
    ON indusbase_ai.documents(created_at DESC);

-- =============================================================================
-- DOWN: Drop schema and all tables
-- =============================================================================

DROP TABLE IF EXISTS indusbase_ai.documents CASCADE;
DROP TABLE IF EXISTS indusbase_ai.collections CASCADE;
DROP SCHEMA IF EXISTS indusbase_ai CASCADE;

-- Note: We keep the vector extension as it might be used by other tables
-- To drop it, run: DROP EXTENSION IF EXISTS vector;
