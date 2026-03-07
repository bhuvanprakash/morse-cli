# IndusBase Python SDK

<p align="center">
  <a href="https://pypi.org/project/indusbase-py/">
    <img src="https://img.shields.io/pypi/v/indusbase-py.svg" alt="PyPI version">
  </a>
  <a href="https://pypi.org/project/indusbase-py/">
    <img src="https://img.shields.io/pypi/pyversions/indusbase-py.svg" alt="Python versions">
  </a>
  <a href="https://github.com/indusbase/indusbase-py/blob/main/LICENSE">
    <img src="https://img.shields.io/pypi/l/indusbase-py.svg" alt="License">
  </a>
</p>

IndusBase is India's Postgres-native Backend-as-a-Service (BaaS) platform. This Python SDK provides seamless integration for Indian data scientists, ML engineers, and web developers building applications with Django, FastAPI, or any Python framework.

## Features

- **Authentication**: Email/password, OAuth, OTP verification
- **Database**: Query builder with filtering, sorting, pagination
- **Storage**: File uploads, downloads, signed URLs, bucket management
- **Real-time**: WebSocket subscriptions for live data
- **Edge Functions**: Serverless function invocation
- **AI/RAG**: Vector embeddings, semantic search, document indexing

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

## AI/RAG Pipeline Example

Build a Q&A system over your IndusBase data with multilingual support:

```python
from indusbase import create_client

client = create_client("https://your-project.indusbase.com", "your-api-key")

# Index documents with auto-embedding
client.ai.collection("product-docs").upsert([
    {
        "content": "How to process payments in India using UPI. UPI (Unified Payments Interface) is a real-time payment system...",
        "metadata": {"category": "payments", "lang": "en"}
    },
    {
        "content": "UPI भुगतान कैसे करें। यूनिफाइड पेमेंट्स इंटरफेस (UPI) एक रियल-टाइम पेमेंट सिस्टम है...",
        "metadata": {"category": "payments", "lang": "hi"}
    },
    {
        "content": "Credit card payment processing in India requires RBI compliance...",
        "metadata": {"category": "payments", "lang": "en"}
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

# Search in Hindi
results_hi = client.ai.collection("product-docs").search(
    "UPI भुगतान",
    limit=5,
    filter={"lang": "hi"}
)

print("\nHindi results:")
for r in results_hi["data"]:
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
    
    # Get collection and use
    collection = client.ai.collection("documents")
    
    # Embed text
    embeddings = await collection.embed("Your text here")
    
    # Search
    results = await collection.search(
        "query text",
        limit=10,
        filter={"source": "pdf"}
    )
    
    await client.close()

asyncio.run(main())
```

## Storage Example

```python
from indusbase import create_client

client = create_client("https://your-project.indusbase.com", "your-api-key")

# Upload a file
with open("document.pdf", "rb") as f:
    client.storage.from_("documents").upload("folder/document.pdf", f.read())

# Get a signed URL (valid for 60 seconds)
url = client.storage.from_("documents").signed_url("folder/document.pdf", 60)

# List files
files = client.storage.from_("documents").list("folder/")

# Delete a file
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

- `create_client(url: str, key: str) -> IndusBaseClient` - Create sync client
- `create_async_client(url: str, key: str) -> AsyncIndusBaseClient` - Create async client

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
| `.neq(column, value)` | Filter: not equals |
| `.gt(column, value)` | Filter: greater than |
| `.gte(column, value)` | Filter: greater or equal |
| `.lt(column, value)` | Filter: less than |
| `.lte(column, value)` | Filter: less or equal |
| `.like(column, pattern)` | Filter: LIKE |
| `.ilike(column, pattern)` | Filter: ILIKE |
| `.in_(column, values)` | Filter: IN |
| `.order(column, desc)` | Order by |
| `.limit(n)` | Limit results |
| `.offset(n)` | Offset results |

### AI Methods

| Method | Description |
|--------|-------------|
| `ai.collection(name)` | Get/create collection |
| `ai.list_collections()` | List all collections |
| `ai.create_collection(name, dimension)` | Create new collection |

### Collection Methods

| Method | Description |
|--------|-------------|
| `.upsert(documents)` | Add documents with embeddings |
| `.search(query, limit, filter)` | Semantic search |
| `.delete(ids)` | Delete documents |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Documentation](https://docs.indusbase.com)
- [API Reference](https://api.indusbase.com)
- [GitHub](https://github.com/indusbase/indusbase-py)
