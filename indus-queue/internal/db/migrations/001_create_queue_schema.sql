-- Create indusbase_queue schema
CREATE SCHEMA IF NOT EXISTS indusbase_queue;

-- Create queues table
CREATE TABLE IF NOT EXISTS indusbase_queue.queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS indusbase_queue.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL REFERENCES indusbase_queue.queues(name) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    worker_id VARCHAR(255),
    invisible_until TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_queue_name_status ON indusbase_queue.jobs(queue_name, status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON indusbase_queue.jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_status_invisible_until ON indusbase_queue.jobs(status, invisible_until) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON indusbase_queue.jobs(priority, scheduled_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON indusbase_queue.queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON indusbase_queue.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
