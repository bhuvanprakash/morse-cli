---
title: Aadhaar eKYC
description: Verify Indian users' identity using Aadhaar OTP via UIDAI API.
---

import IndiaFeatureBadge from '../../../components/IndiaFeatureBadge.astro';

<IndiaFeatureBadge />

:::caution[Regulatory Requirement]
Aadhaar-based eKYC requires a **UIDAI Sub-AUA/AUA license**.
You must apply at [uidai.gov.in](https://uidai.gov.in) before using this feature
in production. IndusBase provides the integration layer; compliance is your responsibility.
:::

## What is Aadhaar eKYC?

Aadhaar eKYC lets users verify their identity using their 12-digit Aadhaar number
and a one-time password sent to their Aadhaar-registered mobile number.

## API Usage

### Step 1: Request OTP

```bash
curl -X POST http://localhost:8000/auth/aadhaar/send-otp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"aadhaar_number": "XXXX XXXX XXXX"}'
```

### Step 2: Verify OTP + Get KYC Data

```bash
curl -X POST http://localhost:8000/auth/aadhaar/verify-otp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "aadhaar_number": "XXXX XXXX XXXX",
    "otp": "123456",
    "transaction_id": "txn_abc123"
  }'
```
