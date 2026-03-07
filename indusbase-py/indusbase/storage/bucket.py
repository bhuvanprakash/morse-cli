"""
Bucket client for IndusBase storage.

Provides methods for interacting with a specific storage bucket.
"""

from typing import Any, Dict, List, Optional, Union
import urllib.parse


class BucketClient:
    """
    Client for interacting with a specific storage bucket.
    
    Provides methods for:
    - Uploading files
    - Downloading files
    - Listing files
    - Deleting files
    - Generating signed URLs
    """

    def __init__(self, http_client: Any, bucket_name: str):
        """
        Initialize the bucket client.

        Args:
            http_client: The HTTP client
            bucket_name: The name of the bucket
        """
        self._http = http_client
        self._bucket = bucket_name

    def upload(
        self,
        path: str,
        content: Union[bytes, str],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upload a file to the bucket.

        Args:
            path: The path where the file will be stored
            content: The file content (bytes or string)
            options: Additional options (content_type, cache_control, etc.)

        Returns:
            Dict containing the uploaded file info

        Example:
            >>> with open("image.png", "rb") as f:
            ...     client.storage.from_("images").upload("avatars/user.png", f.read())
        """
        body = content.decode() if isinstance(content, bytes) else content
        return self._http.request(
            "POST",
            f"/storage/v1/object/{self._bucket}/{path.lstrip('/')}",
            data=body,
            headers=options or {},
        )

    def download(self, path: str) -> bytes:
        """
        Download a file from the bucket.

        Args:
            path: The path to the file

        Returns:
            bytes: The file content

        Example:
            >>> content = client.storage.from_("images").download("avatars/user.png")
        """
        result = self._http.request("GET", f"/storage/v1/object/{self._bucket}/{path.lstrip('/')}")
        data = result.get("data")
        if isinstance(data, str):
            return data.encode()
        if isinstance(data, bytes):
            return data
        return bytes(str(data), "utf-8")

    def list(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List files in the bucket.

        Args:
            path: The prefix path to list (default: root)

        Returns:
            List of file information dictionaries

        Example:
            >>> files = client.storage.from_("images").list("avatars/")
        """
        result = self._http.request(
            "POST",
            f"/storage/v1/object/list/{self._bucket}",
            json={"prefix": path or "", "limit": 100, "offset": 0},
        )
        return result.get("data") or []

    def delete(self, paths: Union[str, List[str]]) -> None:
        """
        Delete files from the bucket.

        Args:
            paths: Path or list of paths to delete

        Example:
            >>> client.storage.from_("images").delete("avatars/old-user.png")
        """
        path_list = [paths] if isinstance(paths, str) else paths
        self._http.request("DELETE", f"/storage/v1/object/{self._bucket}", json={"prefixes": path_list})

    def signed_url(self, path: str, expires_in: int = 60) -> str:
        """
        Generate a signed URL for temporary access.

        Args:
            path: The path to the file
            expires_in: URL expiration time in seconds (default: 60)

        Returns:
            str: The signed URL

        Example:
            >>> url = client.storage.from_("images").signed_url("private/doc.pdf", 3600)
        """
        result = self._http.request(
            "POST",
            f"/storage/v1/object/sign/{self._bucket}/{path.lstrip('/')}",
            json={"expiresIn": expires_in},
        )
        data = result.get("data") or {}
        return str(data.get("signedURL") or data.get("signed_url") or "")

    def get_public_url(self, path: str) -> str:
        """
        Get the public URL for a file.

        Args:
            path: The path to the file

        Returns:
            str: The public URL
        """
        base = self._http.url.rstrip("/")
        return f"{base}/storage/v1/object/public/{self._bucket}/{path.lstrip('/')}"

    def copy(
        self,
        source_path: str,
        destination_path: str,
    ) -> Dict[str, Any]:
        """
        Copy a file within the bucket.

        Args:
            source_path: The source file path
            destination_path: The destination file path

        Returns:
            Dict containing the copied file info
        """
        return self._http.request(
            "POST",
            "/storage/v1/object/copy",
            json={"bucketId": self._bucket, "sourceKey": source_path, "destinationKey": destination_path},
        )

    def move(
        self,
        source_path: str,
        destination_path: str,
    ) -> Dict[str, Any]:
        """
        Move a file within the bucket.

        Args:
            source_path: The source file path
            destination_path: The destination file path

        Returns:
            Dict containing the moved file info
        """
        return self._http.request(
            "POST",
            "/storage/v1/object/move",
            json={"bucketId": self._bucket, "sourceKey": source_path, "destinationKey": destination_path},
        )


class AsyncBucketClient(BucketClient):
    """
    Async version of BucketClient.
    
    Provides the same functionality but with async methods.
    """

    async def upload(
        self,
        path: str,
        content: Union[bytes, str],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upload a file asynchronously.

        Args:
            path: The path where the file will be stored
            content: The file content (bytes or string)
            options: Additional options

        Returns:
            Dict containing the uploaded file info
        """
        body = content.decode() if isinstance(content, bytes) else content
        return await self._http.request(
            "POST",
            f"/storage/v1/object/{self._bucket}/{path.lstrip('/')}",
            data=body,
            headers=options or {},
        )

    async def download(self, path: str) -> bytes:
        """
        Download a file asynchronously.

        Args:
            path: The path to the file

        Returns:
            bytes: The file content
        """
        result = await self._http.request("GET", f"/storage/v1/object/{self._bucket}/{path.lstrip('/')}")
        data = result.get("data")
        if isinstance(data, str):
            return data.encode()
        if isinstance(data, bytes):
            return data
        return bytes(str(data), "utf-8")

    async def list(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List files asynchronously.

        Args:
            path: The prefix path to list

        Returns:
            List of file information dictionaries
        """
        result = await self._http.request(
            "POST",
            f"/storage/v1/object/list/{self._bucket}",
            json={"prefix": path or "", "limit": 100, "offset": 0},
        )
        return result.get("data") or []

    async def delete(self, paths: Union[str, List[str]]) -> None:
        """
        Delete files asynchronously.

        Args:
            paths: Path or list of paths to delete
        """
        path_list = [paths] if isinstance(paths, str) else paths
        await self._http.request("DELETE", f"/storage/v1/object/{self._bucket}", json={"prefixes": path_list})

    async def signed_url(self, path: str, expires_in: int = 60) -> str:
        """
        Generate a signed URL asynchronously.

        Args:
            path: The path to the file
            expires_in: URL expiration time in seconds

        Returns:
            str: The signed URL
        """
        result = await self._http.request(
            "POST",
            f"/storage/v1/object/sign/{self._bucket}/{path.lstrip('/')}",
            json={"expiresIn": expires_in},
        )
        data = result.get("data") or {}
        return str(data.get("signedURL") or data.get("signed_url") or "")

    async def copy(
        self,
        source_path: str,
        destination_path: str,
    ) -> Dict[str, Any]:
        """
        Copy a file asynchronously.

        Args:
            source_path: The source file path
            destination_path: The destination file path

        Returns:
            Dict containing the copied file info
        """
        return await self._http.request(
            "POST",
            "/storage/v1/object/copy",
            json={"bucketId": self._bucket, "sourceKey": source_path, "destinationKey": destination_path},
        )

    async def move(
        self,
        source_path: str,
        destination_path: str,
    ) -> Dict[str, Any]:
        """
        Move a file asynchronously.

        Args:
            source_path: The source file path
            destination_path: The destination file path

        Returns:
            Dict containing the moved file info
        """
        return await self._http.request(
            "POST",
            "/storage/v1/object/move",
            json={"bucketId": self._bucket, "sourceKey": source_path, "destinationKey": destination_path},
        )
