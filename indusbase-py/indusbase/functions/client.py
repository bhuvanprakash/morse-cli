"""
Functions client for IndusBase.

Provides methods for invoking Edge Functions.
"""

from typing import Any, Dict, Optional

from indusbase._http import SyncHTTPClient, AsyncHTTPClient


class FunctionsClient:
    """
    Synchronous functions client for IndusBase.
    
    Provides methods for:
    - Invoking Edge Functions
    - Managing function calls
    """

    def __init__(self, http_client: SyncHTTPClient):
        """
        Initialize the functions client.

        Args:
            http_client: The underlying HTTP client
        """
        self._http = http_client

    def invoke(
        self,
        function_name: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Invoke an Edge Function.

        Args:
            function_name: The name of the function to invoke
            options: Optional parameters including:
                - body: Request body (dict)
                - headers: Custom headers (dict)
                - method: HTTP method (GET, POST, etc.)

        Returns:
            Dict containing the function response

        Example:
            >>> response = client.functions.invoke("process-payment", {
            ...     "body": {"amount": 5000, "currency": "INR"}
            ... })
            >>> print(response["data"])
        """
        options = options or {}
        method = str(options.get("method", "POST")).upper()
        headers = options.get("headers") or {}
        body = options.get("body")
        return self._http.request(
            method,
            f"/functions/v1/{function_name}",
            json=body if isinstance(body, dict) else None,
            data=body if isinstance(body, str) else None,
            headers=headers,
        )


class AsyncFunctionsClient:
    """
    Asynchronous functions client for IndusBase.
    
    Provides methods for:
    - Invoking Edge Functions asynchronously
    - Managing function calls
    """

    def __init__(self, http_client: AsyncHTTPClient):
        """
        Initialize the async functions client.

        Args:
            http_client: The underlying async HTTP client
        """
        self._http = http_client

    async def invoke(
        self,
        function_name: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Invoke an Edge Function asynchronously.

        Args:
            function_name: The name of the function to invoke
            options: Optional parameters including:
                - body: Request body (dict)
                - headers: Custom headers (dict)
                - method: HTTP method (GET, POST, etc.)

        Returns:
            Dict containing the function response

        Example:
            >>> response = await client.functions.invoke("process-payment", {
            ...     "body": {"amount": 5000, "currency": "INR"}
            ... })
            >>> print(response["data"])
        """
        options = options or {}
        method = str(options.get("method", "POST")).upper()
        headers = options.get("headers") or {}
        body = options.get("body")
        return await self._http.request(
            method,
            f"/functions/v1/{function_name}",
            json=body if isinstance(body, dict) else None,
            data=body if isinstance(body, str) else None,
            headers=headers,
        )
