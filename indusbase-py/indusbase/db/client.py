"""
Database client for IndusBase.

Provides methods for database operations using the query builder.
"""

from typing import Any, Dict, List, Optional, Union

from indusbase._http import SyncHTTPClient, AsyncHTTPClient
from indusbase.db.builder import QueryBuilder, AsyncQueryBuilder


class QueryClient:
    """
    Synchronous database client for IndusBase.
    
    Provides methods for:
    - Referencing tables
    - Building and executing queries
    - CRUD operations
    """

    def __init__(self, http_client: SyncHTTPClient):
        """
        Initialize the query client.

        Args:
            http_client: The underlying HTTP client
        """
        self._http = http_client

    def table(self, table_name: str) -> QueryBuilder:
        """
        Reference a database table.

        Args:
            table_name: The name of the table

        Returns:
            QueryBuilder: A query builder for the table

        Example:
            >>> query = client.db.table("users").select("*").limit(10)
        """
        return QueryBuilder(http_client=self._http, table=table_name)

    def from_(self, table_name: str) -> QueryBuilder:
        """
        Reference a database table (alias for table()).

        Args:
            table_name: The name of the table

        Returns:
            QueryBuilder: A query builder for the table
        """
        return self.table(table_name)

    def insert(
        self,
        table: str,
        data: Union[Dict[str, Any], List[Dict[str, Any]]],
    ) -> QueryBuilder:
        """
        Insert data into a table.

        Args:
            table: The table name
            data: Row data or list of rows

        Returns:
            QueryBuilder: A query builder for the insert

        Example:
            >>> client.db.insert("users", {"email": "user@example.com", "name": "John"})
        """
        return QueryBuilder(http_client=self._http, table=table, method="insert").insert(data)

    def update(
        self,
        table: str,
        data: Dict[str, Any],
    ) -> QueryBuilder:
        """
        Update data in a table.

        Args:
            table: The table name
            data: Fields to update

        Returns:
            QueryBuilder: A query builder for the update

        Example:
            >>> client.db.update("users", {"name": "Jane"}).eq("id", "123").execute()
        """
        return QueryBuilder(http_client=self._http, table=table, method="update").update(data)

    def delete(self, table: str) -> QueryBuilder:
        """
        Delete data from a table.

        Args:
            table: The table name

        Returns:
            QueryBuilder: A query builder for the delete

        Example:
            >>> client.db.delete("users").eq("id", "123").execute()
        """
        return QueryBuilder(http_client=self._http, table=table, method="delete").delete()


class AsyncQueryClient:
    """
    Asynchronous database client for IndusBase.
    
    Provides methods for:
    - Referencing tables
    - Building and executing queries asynchronously
    - CRUD operations
    """

    def __init__(self, http_client: AsyncHTTPClient):
        """
        Initialize the async query client.

        Args:
            http_client: The underlying async HTTP client
        """
        self._http = http_client

    def table(self, table_name: str) -> AsyncQueryBuilder:
        """
        Reference a database table.

        Args:
            table_name: The name of the table

        Returns:
            AsyncQueryBuilder: An async query builder for the table
        """
        return AsyncQueryBuilder(http_client=self._http, table=table_name)

    def from_(self, table_name: str) -> AsyncQueryBuilder:
        """
        Reference a database table (alias for table()).

        Args:
            table_name: The name of the table

        Returns:
            AsyncQueryBuilder: An async query builder for the table
        """
        return self.table(table_name)

    async def insert(
        self,
        table: str,
        data: Union[Dict[str, Any], List[Dict[str, Any]]],
    ) -> AsyncQueryBuilder:
        """
        Insert data into a table.

        Args:
            table: The table name
            data: Row data or list of rows

        Returns:
            AsyncQueryBuilder: An async query builder for the insert
        """
        return AsyncQueryBuilder(http_client=self._http, table=table, method="insert").insert(data)

    async def update(
        self,
        table: str,
        data: Dict[str, Any],
    ) -> AsyncQueryBuilder:
        """
        Update data in a table.

        Args:
            table: The table name
            data: Fields to update

        Returns:
            AsyncQueryBuilder: An async query builder for the update
        """
        return AsyncQueryBuilder(http_client=self._http, table=table, method="update").update(data)

    async def delete(self, table: str) -> AsyncQueryBuilder:
        """
        Delete data from a table.

        Args:
            table: The table name

        Returns:
            AsyncQueryBuilder: An async query builder for the delete
        """
        return AsyncQueryBuilder(http_client=self._http, table=table, method="delete").delete()
