"""
Query builder for IndusBase database operations.

Provides a fluent interface for building database queries with
filtering, sorting, pagination, and more.
"""

from typing import Any, Dict, List, Optional, Union


class QueryBuilder:
    """
    A fluent query builder for IndusBase database operations.
    
    Supports:
    - Select: Choose specific columns
    - Insert: Add new rows
    - Update: Modify existing rows
    - Delete: Remove rows
    - Filters: eq, neq, gt, gte, lt, lte, like, ilike, in_
    - Ordering: order
    - Pagination: limit, offset
    """

    def __init__(
        self,
        http_client: Any,
        table: str,
        method: str = "select",
    ):
        """
        Initialize the query builder.

        Args:
            http_client: The HTTP client for making requests
            table: The table name
            method: The operation type (select, insert, update, delete)
        """
        self._http = http_client
        self._table = table
        self._method = method
        self._select_columns: List[str] = ["*"]
        self._filters: List[Dict[str, Any]] = []
        self._sorts: List[Dict[str, Any]] = []
        self._limit_value: Optional[int] = None
        self._offset_value: Optional[int] = None
        self._data: Optional[Dict[str, Any]] = None

    def select(self, *columns: str) -> "QueryBuilder":
        """
        Select specific columns.

        Args:
            *columns: Column names to select

        Returns:
            QueryBuilder: Self for method chaining

        Example:
            >>> query = client.db.table("users").select("id", "email", "name")
        """
        self._select_columns = list(columns)
        return self

    def insert(self, data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> "QueryBuilder":
        """
        Insert data into the table.

        Args:
            data: Row data or list of rows to insert

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._method = "insert"
        self._data = data
        return self

    def update(self, data: Dict[str, Any]) -> "QueryBuilder":
        """
        Update data in the table.

        Args:
            data: Fields to update

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._method = "update"
        self._data = data
        return self

    def delete(self) -> "QueryBuilder":
        """
        Delete rows from the table.

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._method = "delete"
        return self

    # Filter methods
    def eq(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: equals.

        Args:
            column: Column name
            value: Value to match

        Returns:
            QueryBuilder: Self for method chaining

        Example:
            >>> query = client.db.table("users").select("*").eq("status", "active")
        """
        self._filters.append({"column": column, "operator": "eq", "value": value})
        return self

    def neq(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: not equals.

        Args:
            column: Column name
            value: Value to exclude

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "neq", "value": value})
        return self

    def gt(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: greater than.

        Args:
            column: Column name
            value: Threshold value

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "gt", "value": value})
        return self

    def gte(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: greater than or equal.

        Args:
            column: Column name
            value: Threshold value

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "gte", "value": value})
        return self

    def lt(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: less than.

        Args:
            column: Column name
            value: Threshold value

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "lt", "value": value})
        return self

    def lte(self, column: str, value: Any) -> "QueryBuilder":
        """
        Filter: less than or equal.

        Args:
            column: Column name
            value: Threshold value

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "lte", "value": value})
        return self

    def like(self, column: str, pattern: str) -> "QueryBuilder":
        """
        Filter: LIKE (case-sensitive pattern matching).

        Args:
            column: Column name
            pattern: SQL LIKE pattern

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "like", "value": pattern})
        return self

    def ilike(self, column: str, pattern: str) -> "QueryBuilder":
        """
        Filter: ILIKE (case-insensitive pattern matching).

        Args:
            column: Column name
            pattern: SQL ILIKE pattern

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "ilike", "value": pattern})
        return self

    def in_(self, column: str, values: List[Any]) -> "QueryBuilder":
        """
        Filter: IN (match any value in list).

        Args:
            column: Column name
            values: List of values to match

        Returns:
            QueryBuilder: Self for method chaining

        Example:
            >>> query = client.db.table("users").select("*").in_("role", ["admin", "moderator"])
        """
        self._filters.append({"column": column, "operator": "in", "value": values})
        return self

    def is_null(self, column: str) -> "QueryBuilder":
        """
        Filter: IS NULL.

        Args:
            column: Column name

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "is", "value": None})
        return self

    def not_null(self, column: str) -> "QueryBuilder":
        """
        Filter: IS NOT NULL.

        Args:
            column: Column name

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._filters.append({"column": column, "operator": "not", "value": None})
        return self

    # Ordering
    def order(self, column: str, desc: bool = False) -> "QueryBuilder":
        """
        Order by a column.

        Args:
            column: Column name to order by
            desc: Sort in descending order (default: False)

        Returns:
            QueryBuilder: Self for method chaining

        Example:
            >>> query = client.db.table("users").select("*").order("created_at", desc=True)
        """
        self._sorts.append({"column": column, "order": "desc" if desc else "asc"})
        return self

    # Pagination
    def limit(self, n: int) -> "QueryBuilder":
        """
        Limit the number of results.

        Args:
            n: Maximum number of results

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._limit_value = n
        return self

    def offset(self, n: int) -> "QueryBuilder":
        """
        Offset the results.

        Args:
            n: Number of rows to skip

        Returns:
            QueryBuilder: Self for method chaining
        """
        self._offset_value = n
        return self

    # Execute the query
    def execute(self) -> Dict[str, Any]:
        """
        Execute the query and return results.

        Returns:
            Dict containing data and count

        Example:
            >>> response = client.db.table("users").select("*").eq("status", "active").execute()
            >>> print(response["data"])
        """
        path = f"/rest/v1/{self._table}"
        query = self._build_query()
        if self._method == "select":
            return self._http.request("GET", path, params=query)
        if self._method == "insert":
            return self._http.request("POST", path, json=self._data)
        if self._method == "update":
            return self._http.request("PATCH", path, json=self._data, params=query)
        if self._method == "delete":
            return self._http.request("DELETE", path, params=query)
        return {"data": None, "error": {"code": "INVALID_METHOD", "message": f"Unsupported method {self._method}"}}

    def single(self) -> Dict[str, Any]:
        """
        Execute the query and return a single result.

        Returns:
            Dict containing a single row
        """
        if self._limit_value is None:
            self._limit_value = 1
        result = self.execute()
        data = result.get("data")
        if isinstance(data, list):
            result["data"] = data[0] if data else None
        return result

    # Build the query URL
    def _build_query(self) -> Dict[str, Any]:
        """
        Build the query parameters.

        Returns:
            Dict containing query parameters
        """
        query: Dict[str, Any] = {}

        if self._select_columns:
            query["select"] = ",".join(self._select_columns)

        if self._filters:
            for idx, flt in enumerate(self._filters):
                query[f"filter[{idx}][column]"] = flt["column"]
                query[f"filter[{idx}][operator]"] = flt["operator"]
                query[f"filter[{idx}][value]"] = flt["value"]

        if self._sorts:
            query["order"] = ",".join(
                f"{sort['column']}.{sort['order']}" for sort in self._sorts
            )

        if self._limit_value is not None:
            query["limit"] = self._limit_value

        if self._offset_value is not None:
            query["offset"] = self._offset_value

        return query


class AsyncQueryBuilder(QueryBuilder):
    """
    Async version of QueryBuilder.
    
    Provides the same functionality but with async execute methods.
    """

    async def execute(self) -> Dict[str, Any]:
        """
        Execute the query asynchronously and return results.

        Returns:
            Dict containing data and count
        """
        path = f"/rest/v1/{self._table}"
        query = self._build_query()
        if self._method == "select":
            return await self._http.request("GET", path, params=query)
        if self._method == "insert":
            return await self._http.request("POST", path, json=self._data)
        if self._method == "update":
            return await self._http.request("PATCH", path, json=self._data, params=query)
        if self._method == "delete":
            return await self._http.request("DELETE", path, params=query)
        return {"data": None, "error": {"code": "INVALID_METHOD", "message": f"Unsupported method {self._method}"}}

    async def single(self) -> Dict[str, Any]:
        """
        Execute the query asynchronously and return a single result.

        Returns:
            Dict containing a single row
        """
        if self._limit_value is None:
            self._limit_value = 1
        result = await self.execute()
        data = result.get("data")
        if isinstance(data, list):
            result["data"] = data[0] if data else None
        return result
