# indusbase-py - Python SDK

> Official Python client library for IndusBase

## Installation

```bash
pip install indusbase-py
```

For development:
```bash
pip install indusbase-py[dev]
```

## Quick Start

### Sync Usage

```python
from indusbase import create_client

# Create a sync client
client = create_client("https://your-project.indusbase.com", "your-api-key")

# Authentication
user = client.auth.sign_in_with_password("user@example.com", "password")
print(f"Logged in as: {user.user.email}")

# Database queries
response = client.db.table("products").select("*").eq("category", "electronics").execute()
products = response.data

# Insert data
client.db.table("orders").insert({
    "user_id": user.user.id,
    "total": 2999.00,
    "status": "pending"
}).execute()
```

### Async Usage

```python
import asyncio
from indusbase import create_async_client

async def main():
    # Create an async client
    client = await create_async_client("https://your-project.indusbase.com", "your-api-key")
    
    # Authentication
    user = await client.auth.sign_in_with_password("user@example.com", "password")
    
    # Database queries
    response = await client.db.table("products").select("*").execute()
    products = response.data
    
    # Clean up
    await client.close()

asyncio.run(main())
```

## Authentication

### Sign Up

```python
user = client.auth.sign_up(
    email="user@example.com",
    password="securepassword"
)
```

### Sign In

```python
user = client.auth.sign_in_with_password("user@example.com", "password")
```

### OAuth

```python
url = client.auth.sign_in_with_oauth(
    provider="google",
    redirect_to="https://your-app.com/callback"
)
# Redirect user to URL
```

### Verify OTP

```python
user = client.auth.verify_otp(
    email="user@example.com",
    otp="123456"
)
```

## Database Queries

### Select

```python
# Select all
response = client.db.table("todos").select("*").execute()
todos = response.data

# With filters
response = client.db.table("todos").select("*").eq("completed", False).execute()

# Specific columns
response = client.db.table("todos").select("id", "title").execute()
```

### Insert

```python
response = client.db.table("todos").insert({
    "title": "New task",
    "completed": False
}).execute()
```

### Update

```python
response = client.db.table("todos").update({
    "completed": True
}).eq("id", 123).execute()
```

### Delete

```python
response = client.db.table("todos").delete().eq("id", 123).execute()
```

### Filters

| Method | Description |
|--------|-------------|
| `.eq(column, value)` | Equals |
| `.neq(column, value)` | Not equals |
| `.gt(column, value)` | Greater than |
| `.gte(column, value)` | Greater or equal |
| `.lt(column, value)` | Less than |
| `.lte(column, value)` | Less or equal |
| `.like(column, pattern)` | LIKE pattern |
| `.ilike(column, pattern)` | ILIKE pattern |
| `.in_(column, values)` | IN array |

### Ordering & Pagination

```python
response = client.db.table("todos") \
    .select("*") \
    .order("created_at", desc=True) \
    .limit(10) \
    .execute()
```

## AI/RAG Pipeline

Build a Q&A system over your data with multilingual support:

```python
from indusbase import create_client

client = create_client("https://your-project.indusbase.com", "your-api-key")

# Index documents with auto-embedding
client.ai.collection("product-docs").upsert([
    {
        "content": "How to process payments in India using UPI...",
        "metadata": {"category": "payments", "lang": "en"}
    },
    {
        "content": "UPI भुगतान कैसे करें...",
        "metadata": {"category": "payments", "lang": "hi"}
    },
])

# Search in English
results = client.ai.collection("product-docs").search(
    "UPI payment integration",
    limit=5,
    filter={"lang": "en"}
)

print("Search results:")
for r in results["data"]:
    print(f"  {r['similarity']:.2f}: {r['content'][:80]}...")
```

### Async AI Example

```python
import asyncio
from indusbase import create_async_client

async def main():
    client = await create_async_client("https://your-project.indusbase.com", "your-api-key")
    
    # Create collection
    await client.ai.create_collection("documents", dimension=1536)
    
    # Get collection
    collection = client.ai.collection("documents")
    
    # Search
    results = await collection.search(
        "query text",
        limit=10,
        filter={"source": "pdf"}
    )
    
    await client.close()

asyncio.run(main())
```

## Storage

### Upload

```python
with open("document.pdf", "rb") as f:
    client.storage.from_("documents").upload("folder/document.pdf", f.read())
```

### Signed URL

```python
url = client.storage.from_("documents").signed_url("folder/document.pdf", 60)
```

### List Files

```python
files = client.storage.from_("documents").list("folder/")
```

### Delete

```python
client.storage.from_("documents").delete("folder/document.pdf")
```

## Edge Functions

```python
from indusbase import create_client

client = create_client("https://your-project.indusbase.com", "your-api-key")

# Invoke an edge function
response = client.functions.invoke(
    "process-payment",
    {"amount": 5000, "currency": "INR"}
)
print(response.data)
```

## API Reference

### Client Creation

| Method | Description |
|--------|-------------|
| `create_client(url, key)` | Create sync client |
| `create_async_client(url, key)` | Create async client |

### Authentication Methods

| Method | Description |
|--------|-------------|
| `sign_up(email, password, **kwargs)` | Register new user |
| `sign_in_with_password(email, password)` | Sign in with email/password |
| `sign_in_with_oauth(provider, redirect_to)` | Sign in with OAuth |
| `verify_otp(email, otp, type)` | Verify OTP |
| `get_user()` | Get current user |
| `update_user(**kwargs)` | Update user data |
| `sign_out()` | Sign out current user |

### Database Methods

| Method | Description |
|--------|-------------|
| `table(name)` | Reference a table |
| `.select(*columns)` | Select columns |
| `.insert(data)` | Insert row(s) |
| `.update(data)` | Update row(s) |
| `.delete()` | Delete row(s) |
| `.eq(column, value)` | Filter: equals |
| `.order(column, desc)` | Order by |
| `.limit(n)` | Limit results |
| `.offset(n)` | Offset results |

### AI Methods

| Method | Description |
|--------|-------------|
| `ai.collection(name)` | Get/create collection |
| `ai.list_collections()` | List all collections |
| `ai.create_collection(name, dimension)` | Create new collection |

## License

MIT License
