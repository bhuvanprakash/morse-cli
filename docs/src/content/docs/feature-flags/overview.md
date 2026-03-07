---
title: Feature Flags Overview
description: Toggle features, run A/B tests, and manage remote config without redeployment.
---

## What are Feature Flags?

Feature flags let you turn features on or off without redeploying your app.
With IndusBase Feature Flags (indus-config), you can manage gradual rollouts,
user targeting, A/B tests, remote config, and kill switches.

## Quick Start

```bash
curl -X POST http://localhost:8000/config/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production",
    "user_id": "user-uuid-here",
    "user_properties": {"city": "Mumbai", "plan": "premium"}
  }'
```
