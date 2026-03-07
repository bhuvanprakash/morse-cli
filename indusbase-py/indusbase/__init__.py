"""
IndusBase Python SDK

India's Postgres-native Backend-as-a-Service (BaaS) platform.
Supports both sync and async usage.
"""

from indusbase.client import IndusBaseClient, AsyncIndusBaseClient
from indusbase.db.builder import QueryBuilder
from indusbase.auth.types import User, Session
from indusbase.notify.client import NotifyClient, AsyncNotifyClient
from indusbase.config.client import ConfigClient, AsyncConfigClient
from indusbase.billing.client import BillingClient, AsyncBillingClient

__version__ = "0.1.0"

__all__ = [
    "create_client",
    "create_async_client",
    "IndusBaseClient",
    "AsyncIndusBaseClient",
    "User",
    "Session",
    "QueryBuilder",
    "NotifyClient",
    "AsyncNotifyClient",
    "ConfigClient",
    "AsyncConfigClient",
    "BillingClient",
    "AsyncBillingClient",
]


def create_client(url: str, key: str) -> "IndusBaseClient":
    """
    Create a synchronous IndusBase client.

    Args:
        url: The base URL of your IndusBase project (e.g., https://your-project.indusbase.com)
        key: Your API key or service role key

    Returns:
        IndusBaseClient: A synchronous client instance

    Example:
        >>> from indusbase import create_client
        >>> client = create_client("https://your-project.indusbase.com", "your-api-key")
        >>> user = client.auth.sign_in_with_password("user@example.com", "password")
    """
    return IndusBaseClient(url=url, key=key)


async def create_async_client(url: str, key: str) -> "AsyncIndusBaseClient":
    """
    Create an asynchronous IndusBase client.

    Args:
        url: The base URL of your IndusBase project (e.g., https://your-project.indusbase.com)
        key: Your API key or service role key

    Returns:
        AsyncIndusBaseClient: An asynchronous client instance

    Example:
        >>> import asyncio
        >>> from indusbase import create_async_client
        >>>
        >>> async def main():
        ...     client = await create_async_client("https://your-project.indusbase.com", "your-api-key")
        ...     user = await client.auth.sign_in_with_password("user@example.com", "password")
        ...     await client.close()
        >>>
        >>> asyncio.run(main())
    """
    return AsyncIndusBaseClient(url=url, key=key)
