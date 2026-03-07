-- Migration: Create OTP codes table
-- Up

CREATE TABLE IF NOT EXISTS indusbase_auth.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT,
    phone VARCHAR(20),
    code VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'email_verification',
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 3 NOT NULL,
    is_used BOOLEAN DEFAULT FALSE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_otp_codes_email ON indusbase_auth.otp_codes(email);
CREATE INDEX idx_otp_codes_phone ON indusbase_auth.otp_codes(phone);
CREATE INDEX idx_otp_codes_expires_at ON indusbase_auth.otp_codes(expires_at);
CREATE INDEX idx_otp_codes_type ON indusbase_auth.otp_codes(type);

-- Down

DROP INDEX IF EXISTS indusbase_auth.idx_otp_codes_type;
DROP INDEX IF EXISTS indusbase_auth.idx_otp_codes_expires_at;
DROP INDEX IF EXISTS indusbase_auth.idx_otp_codes_phone;
DROP INDEX IF EXISTS indusbase_auth.idx_otp_codes_email;
DROP TABLE IF EXISTS indusbase_auth.otp_codes;
