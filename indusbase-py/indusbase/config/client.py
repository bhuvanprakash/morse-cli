import json
from typing import Optional, TypeVar, Any

T = TypeVar("T")


class ConfigClient:
    def __init__(self, http):
        self._http = http

    def evaluate(
        self,
        environment: str,
        user_id: Optional[str] = None,
        user_properties: Optional[dict] = None,
        keys: Optional[list[str]] = None,
    ) -> dict:
        payload: dict[str, Any] = {"environment": environment}
        if user_id:
            payload["user_id"] = user_id
        if user_properties:
            payload["user_properties"] = user_properties
        if keys:
            payload["keys"] = keys
        return self._http.request(
            "POST", "/config/evaluate",
            content=json.dumps(payload).encode(),
        )

    def get_flag(self, key: str, environment: str, default: T, user_id: Optional[str] = None) -> T:
        result = self.evaluate(environment, user_id=user_id, keys=[key])
        val = (result.get("data") or {}).get("flags", {}).get(key)
        return val if val is not None else default


class AsyncConfigClient:
    def __init__(self, http):
        self._http = http

    async def evaluate(
        self,
        environment: str,
        user_id: Optional[str] = None,
        user_properties: Optional[dict] = None,
        keys: Optional[list[str]] = None,
    ) -> dict:
        payload: dict[str, Any] = {"environment": environment}
        if user_id:
            payload["user_id"] = user_id
        if user_properties:
            payload["user_properties"] = user_properties
        if keys:
            payload["keys"] = keys
        return await self._http.request("POST", "/config/evaluate", content=json.dumps(payload).encode())
