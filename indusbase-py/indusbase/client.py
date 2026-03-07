"""
Main IndusBase client implementations.

Provides both synchronous and asynchronous clients.
"""

from typing import Optional

from indusbase._http import SyncHTTPClient, AsyncHTTPClient
from indusbase.auth.client import AuthClient, AsyncAuthClient
from indusbase.db.client import QueryClient, AsyncQueryClient
from indusbase.storage.client import StorageClient, AsyncStorageClient
from indusbase.realtime.client import AsyncRealtimeClient
from indusbase.functions.client import FunctionsClient, AsyncFunctionsClient
from indusbase.ai.client import AIClient, AsyncAIClient
from indusbase.notify.client import NotifyClient, AsyncNotifyClient
from indusbase.config.client import ConfigClient, AsyncConfigClient
from indusbase.billing.client import BillingClient, AsyncBillingClient


class IndusBaseClient:
    """
    Synchronous client for IndusBase.
    
    Provides access to all IndusBase services:
    - Auth: User authentication and management
    - DB: Database queries and operations
    - Storage: File storage and management
    - Functions: Edge function invocation
    - AI: Vector embeddings and semantic search
    """

    def __init__(self, url: str, key: str, timeout: int = 30):
        """
        Initialize the synchronous IndusBase client.

        Args:
            url: Base URL of the IndusBase project
            key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.url = url
        self.key = key
        self._http = SyncHTTPClient(url=url, key=key, timeout=timeout)
        
        # Initialize service clients
        self.auth = AuthClient(http_client=self._http)
        self.db = QueryClient(http_client=self._http)
        self.storage = StorageClient(http_client=self._http)
        self.functions = FunctionsClient(http_client=self._http)
        self.ai = AIClient(http_client=self._http)
        self.notify = NotifyClient(http=self._http)
        self.config = ConfigClient(http=self._http)
        self.billing = BillingClient(http=self._http)

    def close(self) -> None:
        """Close the client and release resources."""
        self._http.close()

    def __enter__(self) -> "IndusBaseClient":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()


class AsyncIndusBaseClient:
    """
    Asynchronous client for IndusBase.
    
    Provides access to all IndusBase services:
    - Auth: User authentication and management
    - DB: Database queries and operations
    - Storage: File storage and management
    - Functions: Edge function invocation
    - AI: Vector embeddings and semantic search
    - Realtime: WebSocket subscriptions
    """

    def __init__(self, url: str, key: str, timeout: int = 30):
        """
        Initialize the asynchronous IndusBase client.

        Args:
            url: Base URL of the IndusBase project
            key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.url = url
        self.key = key
        self._http = AsyncHTTPClient(url=url, key=key, timeout=timeout)
        
        # Initialize service clients
        self.auth = AsyncAuthClient(http_client=self._http)
        self.db = AsyncQueryClient(http_client=self._http)
        self.storage = AsyncStorageClient(http_client=self._http)
        self.functions = AsyncFunctionsClient(http_client=self._http)
        self.ai = AsyncAIClient(http_client=self._http)
        self.notify = AsyncNotifyClient(http=self._http)
        self.config = AsyncConfigClient(http=self._http)
        self.billing = AsyncBillingClient(http=self._http)

    async def close(self) -> None:
        """Close the client and release resources."""
        await self._http.close()

    async def __aenter__(self) -> "AsyncIndusBaseClient":
        """Async context manager entry."""
        await self._http._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()
