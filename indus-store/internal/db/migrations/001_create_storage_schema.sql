-- Create storage schema
CREATE SCHEMA IF NOT EXISTS indusbase_storage;

-- Buckets table
CREATE TABLE IF NOT EXISTS indusbase_storage.buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    public BOOLEAN DEFAULT false,
    allowed_mime_types TEXT[],
    file_size_limit BIGINT DEFAULT 52428800, -- 50MB default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Objects table
CREATE TABLE IF NOT EXISTS indusbase_storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id UUID NOT NULL REFERENCES indusbase_storage.buckets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT,
    etag TEXT,
    storage_backend VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bucket_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buckets_owner_id ON indusbase_storage.buckets(owner_id);
CREATE INDEX IF NOT EXISTS idx_buckets_name ON indusbase_storage.buckets(name);

CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON indusbase_storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_objects_owner_id ON indusbase_storage.objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_objects_name ON indusbase_storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_name ON indusbase_storage.objects(bucket_id, name);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION indusbase_storage.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_buckets_updated_at ON indusbase_storage.buckets;
CREATE TRIGGER update_buckets_updated_at
    BEFORE UPDATE ON indusbase_storage.buckets
    FOR EACH ROW
    EXECUTE FUNCTION indusbase_storage.update_updated_at_column();

DROP TRIGGER IF EXISTS update_objects_updated_at ON indusbase_storage.objects;
CREATE TRIGGER update_objects_updated_at
    BEFORE UPDATE ON indusbase_storage.objects
    FOR EACH ROW
    EXECUTE FUNCTION indusbase_storage.update_updated_at_column();
