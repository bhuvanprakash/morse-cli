"""
HTTP client wrappers for IndusBase.

Provides synchronous and asynchronous HTTP clients based on httpx.
"""

from typing import Any, Dict, Optional, Union
import httpx
import json


class SyncHTTPClient:
    """
    Synchronous HTTP client wrapper around httpx.
    
    Handles all HTTP communication with the IndusBase API.
    """

    def __init__(self, url: str, key: str, timeout: int = 30):
        """
        Initialize the synchronous HTTP client.

        Args:
            url: Base URL of the IndusBase project
            key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.url = url.rstrip("/")
        self.key = key
        self.timeout = timeout
        self._client = httpx.Client(
            base_url=self.url,
            timeout=timeout,
            headers=self._get_headers(),
        )
        self._access_token: str = ""
        self._refresh_token: str = ""

    def _get_headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        return {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "User-Agent": "indusbase-py/0.1.0",
        }

    def set_tokens(self, access_token: str, refresh_token: str = "") -> None:
        self._access_token = access_token
        self._refresh_token = refresh_token
        self._client.headers["Authorization"] = f"Bearer {access_token}"

    def clear_tokens(self) -> None:
        self._access_token = ""
        self._refresh_token = ""
        self._client.headers["Authorization"] = f"Bearer {self.key}"

    def _normalize_path(self, path: str) -> str:
        return path if path.startswith("/") else f"/{path}"

    def _decode_response(self, response: httpx.Response) -> Dict[str, Any]:
        try:
            return response.json()
        except Exception:
            raw = response.text
            if response.is_error:
                return {"data": None, "error": {"code": "HTTP_ERROR", "message": raw or f"HTTP {response.status_code}"}}
            return {"data": raw, "error": None}

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a GET request.

        Args:
            path: API endpoint path
            params: Query parameters
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return self.request("GET", self._normalize_path(path), params=params, headers=merged_headers)

    def post(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a POST request.

        Args:
            path: API endpoint path
            json: JSON body
            data: Form data
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        kwargs: Dict[str, Any] = {"headers": merged_headers}
        if json is not None:
            kwargs["json"] = json
        if data is not None:
            kwargs["data"] = data
        return self.request("POST", self._normalize_path(path), **kwargs)

    def put(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a PUT request.

        Args:
            path: API endpoint path
            json: JSON body
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return self.request("PUT", self._normalize_path(path), json=json, headers=merged_headers)

    def patch(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a PATCH request.

        Args:
            path: API endpoint path
            json: JSON body
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return self.request("PATCH", self._normalize_path(path), json=json, headers=merged_headers)

    def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a DELETE request.

        Args:
            path: API endpoint path
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return self.request("DELETE", self._normalize_path(path), headers=merged_headers)

    def request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Send a generic HTTP request.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            path: API endpoint path
            **kwargs: Additional arguments to pass to httpx

        Returns:
            httpx.Response: The response object
        """
        try:
            response = self._client.request(method.upper(), self._normalize_path(path), **kwargs)
            return self._decode_response(response)
        except httpx.RequestError as exc:
            return {"data": None, "error": {"code": "REQUEST_ERROR", "message": str(exc)}}

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()


class AsyncHTTPClient:
    """
    Asynchronous HTTP client wrapper around httpx.
    
    Handles all HTTP communication with the IndusBase API.
    """

    def __init__(self, url: str, key: str, timeout: int = 30):
        """
        Initialize the asynchronous HTTP client.

        Args:
            url: Base URL of the IndusBase project
            key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.url = url.rstrip("/")
        self.key = key
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        self._access_token: str = ""
        self._refresh_token: str = ""

    def _get_headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        return {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "User-Agent": "indusbase1.0",
        }

    async def __aenter__(self) -> "AsyncHTTPClient":
        """Async context manager entry."""
        self._client = httpx.AsyncClient(
            base_url=self.url,
            timeout=self.timeout,
            headers=self._get_headers(),
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    async def _ensure_client(self) -> httpx.AsyncClient:
        """Ensure the async client is initialized."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.url,
                timeout=self.timeout,
                headers=self._get_headers(),
            )
        return self._client

    def set_tokens(self, access_token: str, refresh_token: str = "") -> None:
        self._access_token = access_token
        self._refresh_token = refresh_token
        if self._client is not None:
            self._client.headers["Authorization"] = f"Bearer {access_token}"

    def clear_tokens(self) -> None:
        self._access_token = ""
        self._refresh_token = ""
        if self._client is not None:
            self._client.headers["Authorization"] = f"Bearer {self.key}"

    def _normalize_path(self, path: str) -> str:
        return path if path.startswith("/") else f"/{path}"

    def _decode_response(self, response: httpx.Response) -> Dict[str, Any]:
        try:
            return response.json()
        except Exception:
            raw = response.text
            if response.is_error:
                return {"data": None, "error": {"code": "HTTP_ERROR", "message": raw or f"HTTP {response.status_code}"}}
            return {"data": raw, "error": None}

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a GET request.

        Args:
            path: API endpoint path
            params: Query parameters
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return await self.request("GET", self._normalize_path(path), params=params, headers=merged_headers)

    async def post(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a POST request.

        Args:
            path: API endpoint path
            json: JSON body
            data: Form data
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        kwargs: Dict[str, Any] = {"headers": merged_headers}
        if json is not None:
            kwargs["json"] = json
        if data is not None:
            kwargs["data"] = data
        return await self.request("POST", self._normalize_path(path), **kwargs)

    async def put(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a PUT request.

        Args:
            path: API endpoint path
            json: JSON body
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return await self.request("PUT", self._normalize_path(path), json=json, headers=merged_headers)

    async def patch(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a PATCH request.

        Args:
            path: API endpoint path
            json: JSON body
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return await self.request("PATCH", self._normalize_path(path), json=json, headers=merged_headers)

    async def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send a DELETE request.

        Args:
            path: API endpoint path
            headers: Additional headers

        Returns:
            httpx.Response: The response object
        """
        merged_headers = {**(headers or {})}
        return await self.request("DELETE", self._normalize_path(path), headers=merged_headers)

    async def request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Send a generic HTTP request.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            path: API endpoint path
            **kwargs: Additional arguments to pass to httpx

        Returns:
            httpx.Response: The response object
        """
        try:
            client = await self._ensure_client()
            if self._access_token:
                client.headers["Authorization"] = f"Bearer {self._access_token}"
            response = await client.request(method.upper(), self._normalize_path(path), **kwargs)
            return self._decode_response(response)
        except httpx.RequestError as exc:
            return {"data": None, "error": {"code": "REQUEST_ERROR", "message": str(exc)}}

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
