---
title: Support Console
description: Enterprise support workflows in Studio with auditable admin operations.
---

## Capabilities

- Search users by email / phone / user ID
- Search projects by slug / project ID
- View support context (auth events, queue jobs, notifications)
- Add support notes with severity
- Request impersonation approval tokens (no silent login)
- Export support packet JSON

## Support Context Lookup

```bash
curl "http://localhost:8000/meta/support/context?user_id=USER_UUID&project_id=PROJECT_UUID" \
  -H "Authorization: Bearer $TOKEN"
```

## Create Support Note

```bash
curl -X POST http://localhost:8000/meta/support/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"USER_UUID",
    "project_id":"PROJECT_UUID",
    "severity":"high",
    "note":"Customer reported delayed webhook deliveries."
  }'
```

All actions are audit logged.
