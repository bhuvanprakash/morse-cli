---
title: API Reference
description: Complete API reference for all IndusBase endpoints.
---

All requests go through the API gateway at port **8000**.

## Authentication Header

All protected endpoints require:

```text
Authorization: Bearer {access_token}
```

## Response Format

All responses follow this shape:

```json
{"data": {...}, "error": null}
{"data": null, "error": {"code": "ERROR_CODE", "message": "Human readable"}}
```
