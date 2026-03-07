import json
from typing import Optional


class BillingClient:
    def __init__(self, http):
        self._http = http

    def plans(self) -> dict:
        return self._http.request("GET", "/billing/plans")

    def usage(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/usage"
        if project_id:
            path += f"?project_id={project_id}"
        return self._http.request("GET", path)

    def usage_summary(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/usage/summary"
        if project_id:
            path += f"?project_id={project_id}"
        return self._http.request("GET", path)

    def invoices(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/invoices"
        if project_id:
            path += f"?project_id={project_id}"
        return self._http.request("GET", path)

    def invoice_preview(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/invoices/preview"
        if project_id:
            path += f"?project_id={project_id}"
        return self._http.request("GET", path)

    def create_subscription(self, payload: dict) -> dict:
        return self._http.request(
            "POST",
            "/billing/subscriptions",
            content=json.dumps(payload).encode(),
        )


class AsyncBillingClient:
    def __init__(self, http):
        self._http = http

    async def plans(self) -> dict:
        return await self._http.request("GET", "/billing/plans")

    async def usage(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/usage"
        if project_id:
            path += f"?project_id={project_id}"
        return await self._http.request("GET", path)

    async def usage_summary(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/usage/summary"
        if project_id:
            path += f"?project_id={project_id}"
        return await self._http.request("GET", path)

    async def invoices(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/invoices"
        if project_id:
            path += f"?project_id={project_id}"
        return await self._http.request("GET", path)

    async def invoice_preview(self, project_id: Optional[str] = None) -> dict:
        path = "/billing/invoices/preview"
        if project_id:
            path += f"?project_id={project_id}"
        return await self._http.request("GET", path)

    async def create_subscription(self, payload: dict) -> dict:
        return await self._http.request(
            "POST",
            "/billing/subscriptions",
            content=json.dumps(payload).encode(),
        )
