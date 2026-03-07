# indus-notify

Multi-channel notification service for IndusBase. Supports push notifications
(FCM + APNs), SMS (2Factor.in with Twilio fallback), email (SendGrid with SMTP
fallback), WhatsApp templated delivery, templates, and delivery history.

## Features

- Push notifications to Android, iOS, and Web devices
- India-first SMS delivery with mandatory DLT template support
- Email delivery with SendGrid or SMTP fallback
- WhatsApp delivery via Twilio-compatible API
- Template CRUD with `{{variable}}` rendering and preview
- Notification history and delivery statistics
- Batch SMS and email fan-out through `indus-queue`

## Environment

Required:

- `DATABASE_URL`
- `INTERNAL_SECRET`

Optional providers:

- `FCM_CREDENTIALS_JSON`
- `APNS_KEY_P8`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `APNS_PRODUCTION`
- `TWOFACTOR_API_KEY`
- `TWOFACTOR_SENDER_ID`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SENDGRID_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `WHATSAPP_API_KEY`
- `WHATSAPP_SENDER`
- `AUTH_SERVICE_URL`
- `QUEUE_SERVICE_URL`

## Run

```bash
go mod tidy
go run ./cmd/server
```

## Example Hindi Push

```json
{
  "user_id": "3e99f42e-6b38-4d75-a89d-10ce8e92b5a2",
  "title": "ऑर्डर कन्फर्म हो गया! 🎉",
  "body": "आपका ऑर्डर #12345 कन्फर्म हो गया है।"
}
```
