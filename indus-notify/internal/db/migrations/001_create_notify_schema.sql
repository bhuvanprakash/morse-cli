CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS indusbase_notify;

CREATE TABLE IF NOT EXISTS indusbase_notify.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    device_name TEXT,
    app_version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_indusbase_notify_device_tokens_user_active
    ON indusbase_notify.device_tokens(user_id, is_active);

CREATE TABLE IF NOT EXISTS indusbase_notify.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    channel VARCHAR(20) NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    template_id UUID,
    provider VARCHAR(30),
    provider_message_id TEXT,
    status VARCHAR(20) DEFAULT 'queued',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_indusbase_notify_notifications_user_channel
    ON indusbase_notify.notifications(user_id, channel);
CREATE INDEX IF NOT EXISTS idx_indusbase_notify_notifications_status_created
    ON indusbase_notify.notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_indusbase_notify_notifications_created_desc
    ON indusbase_notify.notifications(created_at DESC);
