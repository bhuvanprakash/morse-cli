-- Create webhooks table
CREATE TABLE IF NOT EXISTS indusbase_queue.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    event VARCHAR(255) NOT NULL,
    secret VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT true,
    headers JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cron_schedules table
CREATE TABLE IF NOT EXISTS indusbase_queue.cron_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    job_payload JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for webhooks table
CREATE INDEX IF NOT EXISTS idx_webhooks_event ON indusbase_queue.webhooks(event);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON indusbase_queue.webhooks(enabled);

-- Create indexes for cron_schedules table
CREATE INDEX IF NOT EXISTS idx_cron_schedules_enabled ON indusbase_queue.cron_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_next_run_at ON indusbase_queue.cron_schedules(next_run_at) WHERE enabled = true;

-- Create triggers for updated_at
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON indusbase_queue.webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cron_schedules_updated_at BEFORE UPDATE ON indusbase_queue.cron_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
