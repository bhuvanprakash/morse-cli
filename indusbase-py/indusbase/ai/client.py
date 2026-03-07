"""
AI client for IndusBase.

Provides AI/RAG functionality including vector embeddings and semantic search.
Designed for ML engineers building RAG pipelines.
"""

from typing import Any, Dict, List, Optional, Union

from indusbase._http import SyncHTTPClient, AsyncHTTPClient


class SyncCollectionClient:
    """
    Synchronous client for interacting with an AI collection.
    
    Provides methods for:
    - Upserting documents with auto-embedding
    - Semantic search
    - Deleting documents
    """

    def __init__(self, http_client: SyncHTTPClient, collection_name: str):
        """
        Initialize the collection client.

        Args:
            http_client: The HTTP client
            collection_name: The name of the collection
        """
        self._http = http_client
        self._collection = collection_name

    def upsert(
        self,
        documents: List[Dict[str, Any]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upsert documents into the collection with auto-embedding.

        Args:
            documents: List of documents with 'content' and optional 'metadata'
            options: Additional options (model, etc.)

        Returns:
            Dict containing the upsert result

        Example:
            >>> client.ai.collection("docs").upsert([
            ...     {"content": "How to process UPI payments...", "metadata": {"lang": "en"}},
            ...     {"content": "UPI भुगतान कैसे करें...", "metadata": {"lang": "hi"}}
            ... ])
        """
        payload: Dict[str, Any] = {"documents": documents}
        if options:
            payload.update(options)
        return self._http.request("POST", f"/ai/collections/{self._collection}/documents", json=payload)

    def search(
        self,
        query: str,
        limit: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Search for similar documents using semantic search.

        Args:
            query: The search query
            limit: Maximum number of results (default: 10)
            filter: Optional metadata filters
            options: Additional options (model, etc.)

        Returns:
            Dict containing search results with similarity scores

        Example:
            >>> results = client.ai.collection("docs").search(
            ...     "UPI payment integration",
            ...     limit=5,
            ...     filter={"lang": "en"}
            ... )
            >>> for r in results["data"]:
            ...     print(f"{r['similarity']:.2f}: {r['content'][:100]}")
        """
        payload: Dict[str, Any] = {"query": query, "limit": limit}
        if filter is not None:
            payload["filter"] = filter
        if options:
            payload.update(options)
        return self._http.request("POST", f"/ai/collections/{self._collection}/search", json=payload)

    def delete(
        self,
        ids: Union[str, List[str]],
    ) -> Dict[str, Any]:
        """
        Delete documents from the collection.

        Args:
            ids: Document ID or list of IDs

        Returns:
            Dict containing the delete result
        """
        id_list = [ids] if isinstance(ids, str) else ids
        result = {"data": [], "error": None}
        for doc_id in id_list:
            result = self._http.request("DELETE", f"/ai/collections/{self._collection}/documents/{doc_id}")
        return result

    def get(
        self,
        id: str,
    ) -> Dict[str, Any]:
        """
        Get a document by ID.

        Args:
            id: Document ID

        Returns:
            Dict containing the document
        """
        return self._http.request("GET", f"/ai/collections/{self._collection}/documents/{id}")

    def list(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List documents in the collection.

        Args:
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Dict containing the list of documents
        """
        return self.search("", limit=limit, options={"offset": offset})


class AsyncCollectionClient:
    """
    Asynchronous client for interacting with an AI collection.
    
    Provides methods for:
    - Upserting documents with auto-embedding
    - Semantic search
    - Deleting documents
    """

    def __init__(self, http_client: AsyncHTTPClient, collection_name: str):
        """
        Initialize the async collection client.

        Args:
            http_client: The async HTTP client
            collection_name: The name of the collection
        """
        self._http = http_client
        self._collection = collection_name

    async def upsert(
        self,
        documents: List[Dict[str, Any]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upsert documents asynchronously.

        Args:
            documents: List of documents with 'content' and optional 'metadata'
            options: Additional options

        Returns:
            Dict containing the upsert result
        """
        payload: Dict[str, Any] = {"documents": documents}
        if options:
            payload.update(options)
        return await self._http.request("POST", f"/ai/collections/{self._collection}/documents", json=payload)

    async def search(
        self,
        query: str,
        limit: int = 10,
        filter: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Search for similar documents asynchronously.

        Args:
            query: The search query
            limit: Maximum number of results
            filter: Optional metadata filters
            options: Additional options

        Returns:
            Dict containing search results with similarity scores
        """
        payload: Dict[str, Any] = {"query": query, "limit": limit}
        if filter is not None:
            payload["filter"] = filter
        if options:
            payload.update(options)
        return await self._http.request("POST", f"/ai/collections/{self._collection}/search", json=payload)

    async def delete(
        self,
        ids: Union[str, List[str]],
    ) -> Dict[str, Any]:
        """
        Delete documents asynchronously.

        Args:
            ids: Document ID or list of IDs

        Returns:
            Dict containing the delete result
        """
        id_list = [ids] if isinstance(ids, str) else ids
        result = {"data": [], "error": None}
        for doc_id in id_list:
            result = await self._http.request("DELETE", f"/ai/collections/{self._collection}/documents/{doc_id}")
        return result

    async def get(
        self,
        id: str,
    ) -> Dict[str, Any]:
        """
        Get a document by ID asynchronously.

        Args:
            id: Document ID

        Returns:
            Dict containing the document
        """
        return await self._http.request("GET", f"/ai/collections/{self._collection}/documents/{id}")

    async def list(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List documents asynchronously.

        Args:
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Dict containing the list of documents
        """
        return await self.search("", limit=limit, options={"offset": offset})


class AIClient:
    """
    Synchronous AI client for IndusBase.
    
    Provides methods for:
    - Managing collections
    - Creating embeddings
    - Listing collections
    """

    def __init__(self, http_client: SyncHTTPClient):
        """
        Initialize the AI client.

        Args:
            http_client: The underlying HTTP client
        """
        self._http = http_client

    def collection(self, name: str) -> SyncCollectionClient:
        """
        Get a collection client for the specified collection.

        Args:
            name: The name of the collection

        Returns:
            SyncCollectionClient: A collection client

        Example:
            >>> coll = client.ai.collection("product-docs")
            >>> coll.upsert([{"content": "..."}])
        """
        return SyncCollectionClient(http_client=self._http, collection_name=name)

    def list_collections(self) -> List[Dict[str, Any]]:
        """
        List all AI collections.

        Returns:
            List of collection information dictionaries
        """
        return self._http.request("GET", "/ai/collections")

    def create_collection(
        self,
        name: str,
        dimension: int = 1536,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new AI collection.

        Args:
            name: The name of the collection
            dimension: Embedding dimension (default: 1536)
            options: Additional options

        Returns:
            Dict containing the created collection info
        """
        payload: Dict[str, Any] = {"name": name, "dimension": dimension}
        if options:
            payload.update(options)
        return self._http.request("POST", "/ai/collections", json=payload)

    def delete_collection(self, name: str) -> None:
        """
        Delete an AI collection.

        Args:
            name: The name of the collection to delete
        """
        return self._http.request("DELETE", f"/ai/collections/{name}")

    def embed(
        self,
        texts: Union[str, List[str]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate embeddings for text(s).

        Args:
            texts: Text or list of texts to embed
            options: Additional options (model, etc.)

        Returns:
            Dict containing embeddings
        """
        payload: Dict[str, Any] = {"texts": [texts] if isinstance(texts, str) else texts}
        if options:
            payload.update(options)
        return self._http.request("POST", "/ai/embed", json=payload)


class AsyncAIClient:
    """
    Asynchronous AI client for IndusBase.
    
    Provides methods for:
    - Managing collections
    - Creating embeddings
    - Listing collections
    """

    def __init__(self, http_client: AsyncHTTPClient):
        """
        Initialize the async AI client.

        Args:
            http_client: The underlying async HTTP client
        """
        self._http = http_client

    def collection(self, name: str) -> AsyncCollectionClient:
        """
        Get an async collection client for the specified collection.

        Args:
            name: The name of the collection

        Returns:
            AsyncCollectionClient: An async collection client

        Example:
            >>> coll = await client.ai.collection("product-docs")
            >>> await coll.upsert([{"content": "..."}])
        """
        return AsyncCollectionClient(http_client=self._http, collection_name=name)

    async def list_collections(self) -> List[Dict[str, Any]]:
        """
        List all AI collections asynchronously.

        Returns:
            List of collection information dictionaries
        """
        return await self._http.request("GET", "/ai/collections")

    async def create_collection(
        self,
        name: str,
        dimension: int = 1536,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new AI collection asynchronously.

        Args:
            name: The name of the collection
            dimension: Embedding dimension
            options: Additional options

        Returns:
            Dict containing the created collection info
        """
        payload: Dict[str, Any] = {"name": name, "dimension": dimension}
        if options:
            payload.update(options)
        return await self._http.request("POST", "/ai/collections", json=payload)

    async def delete_collection(self, name: str) -> None:
        """
        Delete an AI collection asynchronously.

        Args:
            name: The name of the collection to delete
        """
        return await self._http.request("DELETE", f"/ai/collections/{name}")

    async def embed(
        self,
        texts: Union[str, List[str]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate embeddings for text(s) asynchronously.

        Args:
            texts: Text or list of texts to embed
            options: Additional options

        Returns:
            Dict containing embeddings
        """
        payload: Dict[str, Any] = {"texts": [texts] if isinstance(texts, str) else texts}
        if options:
            payload.update(options)
        return await self._http.request("POST", "/ai/embed", json=payload)
