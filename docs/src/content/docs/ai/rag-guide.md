---
title: Building a RAG Pipeline
description: Build a Retrieval-Augmented Generation (RAG) pipeline with IndusBase AI and Python.
---

A RAG pipeline lets you answer questions using your own database content.
This guide builds a document Q&A system in Python using **indusbase-py** and **Cohere**.

## Architecture

```text
User Query (Hindi or English)
       ↓
Embed query with Cohere multilingual
       ↓
Vector search in IndusBase AI
       ↓
Top 5 relevant document chunks
       ↓
Prompt LLM with chunks + query
       ↓
Answer in user's language
```

## Step 1: Install SDK

```bash
pip install indusbase-py
```

## Step 2: Create a Collection and Upload Documents

```python
from indusbase import create_client

client = create_client("http://localhost:8000", "your-anon-key")
client.ai.create_collection(name="product-docs", embedding_provider="cohere", similarity_metric="cosine")
client.ai.collection("product-docs").upsert([
    {"content": "IndusBase का उपयोग करके आप अपना बैकएंड 5 मिनट में बना सकते हैं।", "metadata": {"lang": "hi"}},
    {"content": "IndusBase supports PostgreSQL, realtime subscriptions, and edge functions.", "metadata": {"lang": "en"}}
])
```
