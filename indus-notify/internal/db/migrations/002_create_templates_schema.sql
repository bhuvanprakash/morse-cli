CREATE TABLE IF NOT EXISTS indusbase_notify.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    channel VARCHAR(20) NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    whatsapp_template_name TEXT,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO indusbase_notify.templates (name, channel, subject, body, variables)
VALUES
('payment-success-sms', 'sms', NULL,
 'Dear {{name}}, Rs.{{amount}} paid successfully to {{merchant}} via {{method}}. Ref: {{ref_id}}. -IndusBase',
 ARRAY['name', 'amount', 'merchant', 'method', 'ref_id']),

('order-confirmed-push', 'push', 'Order Confirmed! 🎉',
 'Your order #{{order_id}} for Rs.{{amount}} has been confirmed. Expected delivery: {{delivery_date}}',
 ARRAY['order_id', 'amount', 'delivery_date']),

('otp-email', 'email', 'Your IndusBase verification code',
 'Hi {{name}},\n\nYour OTP is: {{otp}}\n\nValid for 10 minutes. Do not share this code.\n\n-IndusBase Team',
 ARRAY['name', 'otp']),

('kyc-approved-whatsapp', 'whatsapp', NULL,
 'Namaste {{name}}! Your KYC verification is complete. You can now access all features. - {{app_name}}',
 ARRAY['name', 'app_name']),

('payment-failed-push', 'push', 'Payment Failed',
 'Payment of Rs.{{amount}} failed. {{reason}}. Please retry or contact support.',
 ARRAY['amount', 'reason'])
ON CONFLICT (name) DO NOTHING;
