"""
Storage client for IndusBase.

Provides methods for file storage and management operations.
"""

from typing import Any, Dict, List, Optional, Union

from indusbase._http import SyncHTTPClient, AsyncHTTPClient
from indusbase.storage.bucket import BucketClient, AsyncBucketClient


class StorageClient:
    """
    Synchronous storage client for IndusBase.
    
    Provides methods for:
    - Referencing storage buckets
    - File operations (upload, download, list, delete)
    - Generating signed URLs
    """

    def __init__(self, http_client: SyncHTTPClient):
        """
        Initialize the storage client.

        Args:
            http_client: The underlying HTTP client
        """
        self._http = http_client

    def from_(self, bucket_name: str) -> BucketClient:
        """
        Reference a storage bucket.

        Args:
            bucket_name: The name of the bucket

        Returns:
            BucketClient: A bucket client for the specified bucket

        Example:
            >>> bucket = client.storage.from_("avatars")
            >>> bucket.upload("user.png", file_content)
        """
        return BucketClient(http_client=self._http, bucket_name=bucket_name)

    def list_buckets(self) -> List[Dict[str, Any]]:
        """
        List all storage buckets.

        Returns:
            List of bucket information dictionaries
        """
        return self._http.request("GET", "/storage/v1/bucket")

    def create_bucket(
        self,
        name: str,
        public: bool = False,
    ) -> Dict[str, Any]:
        """
        Create a new storage bucket.

        Args:
            name: The name of the bucket
            public: Whether the bucket is public (default: False)

        Returns:
            Dict containing the created bucket info
        """
        return self._http.request("POST", "/storage/v1/bucket", json={"name": name, "public": public})

    def delete_bucket(self, name: str) -> None:
        """
        Delete a storage bucket.

        Args:
            name: The name of the bucket to delete
        """
        return self._http.request("DELETE", f"/storage/v1/bucket/{name}")


class AsyncStorageClient:
    """
    Asynchronous storage client for IndusBase.
    
    Provides methods for:
    - Referencing storage buckets
    - File operations (upload, download, list, delete)
    - Generating signed URLs
    """

    def __init__(self, http_client: AsyncHTTPClient):
        """
        Initialize the async storage client.

        Args:
            http_client: The underlying async HTTP client
        """
        self._http = http_client

    def from_(self, bucket_name: str) -> AsyncBucketClient:
        """
        Reference a storage bucket.

        Args:
            bucket_name: The name of the bucket

        Returns:
            AsyncBucketClient: An async bucket client for the specified bucket

        Example:
            >>> bucket = await client.storage.from_("avatars")
            >>> await bucket.upload("user.png", file_content)
        """
        return AsyncBucketClient(http_client=self._http, bucket_name=bucket_name)

    async def list_buckets(self) -> List[Dict[str, Any]]:
        """
        List all storage buckets asynchronously.

        Returns:
            List of bucket information dictionaries
        """
        return await self._http.request("GET", "/storage/v1/bucket")

    async def create_bucket(
        self,
        name: str,
        public: bool = False,
    ) -> Dict[str, Any]:
        """
        Create a new storage bucket asynchronously.

        Args:
            name: The name of the bucket
            public: Whether the bucket is public

        Returns:
            Dict containing the created bucket info
        """
        return await self._http.request("POST", "/storage/v1/bucket", json={"name": name, "public": public})

    async def delete_bucket(self, name: str) -> None:
        """
        Delete a storage bucket asynchronously.

        Args:
            name: The name of the bucket to delete
        """
        return await self._http.request("DELETE", f"/storage/v1/bucket/{name}")
