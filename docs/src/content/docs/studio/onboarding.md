---
title: Studio Onboarding
description: First-run onboarding flow for creating an org, provisioning a project, and entering control-plane context.
---

Studio onboarding is a guided 5-step flow for first-time users.

## Steps

1. Welcome and architecture overview
2. Create first project (region defaults to `ap-south-1`)
3. Copy API keys and SDK quick-start snippets
4. Notifications provider checklist
5. Launch into dashboard

## Reliability Features

- Organization bootstrap if none exists
- Project slug auto-generation
- Retry path on provisioning failure
- Skip flow with explicit confirmation
- Context handoff into dashboard after success

## Seed First, Then Onboard

```bash
make seed
open http://localhost:3000/onboarding
```

## If Project Creation Fails

- Check `http://localhost:8000/meta/projects` availability through gateway
- Verify auth token is valid
- Confirm platform migrations were applied
- Retry from onboarding step 2
