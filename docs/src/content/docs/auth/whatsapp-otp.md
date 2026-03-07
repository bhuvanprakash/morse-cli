---
title: WhatsApp OTP Authentication
description: Authenticate Indian users via WhatsApp OTP using Gupshup API.
---

import IndiaFeatureBadge from '../../../components/IndiaFeatureBadge.astro';

<IndiaFeatureBadge />

WhatsApp OTP is the preferred authentication method for Indian mobile apps.
IndusBase integrates with the **Gupshup API** to send OTPs via WhatsApp to
any Indian phone number (91XXXXXXXXXX format).

## Why WhatsApp OTP for India?

- **98% delivery rate** — higher than SMS in India
- **Free for users** — no SMS charges
- **Trusted by users** — WhatsApp is used by 530M+ Indians
- **Works offline** — messages queue when users have poor connectivity

## Setup

### 1. Get Gupshup API Key

1. Sign up at [gupshup.io](https://www.gupshup.io)
2. Create a WhatsApp Business app
3. Get your API key from the dashboard
4. Register your sender number

### 2. Configure IndusBase

Add to your `.env`:

```bash
WHATSAPP_PROVIDER=gupshup
GUPSHUP_API_KEY=your_gupshup_api_key
GUPSHUP_APP_NAME=your_app_name
GUPSHUP_SENDER_NUMBER=919XXXXXXXXX
```

### 3. Send OTP

```bash
curl -X POST http://localhost:8000/auth/phone/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "919876543210",
    "type": "signin"
  }'
```

### 4. Verify OTP

```bash
curl -X POST http://localhost:8000/auth/phone/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "919876543210",
    "otp": "847291"
  }'
```
