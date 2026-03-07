---
title: Studio Project Switching
description: Active organization/project/environment context handling in Studio.
---

Studio is multi-project aware and preserves context between sessions.

## Context Controls

- Project selector in the top header
- Environment selector (`development`, `staging`, `production`)
- Manual refresh action for org/project context

## Persistence

Studio stores these values in local storage:

- `active_org_id`
- `active_project_id`
- `active_environment`
- `active_project_anon_key` (when available)

## Request Headers

The shared Studio API client attaches:

- `Authorization: Bearer <token>`
- `X-IndusBase-Project-ID: <project_id>`
- `X-IndusBase-Environment: <environment>`
- `apikey: <anon_key>` (if present)

## Context Troubleshooting

If the wrong project appears:

1. Switch project from the header selector.
2. Click **Refresh** beside the selector.
3. Re-open the page or run `localStorage.clear()` and sign in again.
