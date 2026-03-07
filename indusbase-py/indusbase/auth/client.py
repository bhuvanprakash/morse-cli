import json
from typing import Optional, Any


class AuthClient:
    def __init__(self, http=None, http_client=None):
        self._http = http if http is not None else http_client

    def sign_up(self, email: str, password: str, **kwargs) -> dict:
        body = {"email": email, "password": password, **kwargs}
        result = self._http.request("POST", "/auth/signup", content=json.dumps(body).encode())
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    def sign_in_with_password(self, email: str, password: str) -> dict:
        result = self._http.request(
            "POST",
            "/auth/signin",
            content=json.dumps({"email": email, "password": password}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    def sign_in_with_oauth(self, provider: str, redirect_to: Optional[str] = None) -> dict:
        body: dict[str, Any] = {"provider": provider}
        if redirect_to:
            body["redirect_to"] = redirect_to
        return self._http.request("POST", "/auth/oauth", content=json.dumps(body).encode())

    def verify_otp(self, email: str, otp: str, type: str = "signup") -> dict:
        result = self._http.request(
            "POST",
            "/auth/otp/verify",
            content=json.dumps({"email": email, "token": otp, "type": type}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    def send_phone_otp(self, phone: str) -> dict:
        return self._http.request(
            "POST",
            "/auth/phone/send-otp",
            content=json.dumps({"phone": phone}).encode(),
        )

    def verify_phone_otp(self, phone: str, otp: str) -> dict:
        result = self._http.request(
            "POST",
            "/auth/phone/verify-otp",
            content=json.dumps({"phone": phone, "otp": otp}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    def get_user(self) -> dict:
        return self._http.request("GET", "/auth/user")

    def update_user(self, **kwargs) -> dict:
        return self._http.request("PATCH", "/auth/user", content=json.dumps(kwargs).encode())

    def sign_out(self) -> dict:
        result = self._http.request("POST", "/auth/signout")
        self._http.clear_tokens()
        return result

    def refresh_session(self) -> dict:
        if not self._http._refresh_token:
            return {"data": None, "error": {"code": "NO_REFRESH_TOKEN", "message": "No refresh token"}}
        result = self._http.request(
            "POST",
            "/auth/refresh",
            content=json.dumps({"refresh_token": self._http._refresh_token}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    def create_enterprise_connection(self, payload: dict) -> dict:
        return self._http.request(
            "POST",
            "/auth/enterprise/connections",
            content=json.dumps(payload).encode(),
        )

    def list_sso_connections(self) -> dict:
        return self._http.request("GET", "/auth/enterprise/connections")

    def start_sso(self, slug: str) -> str:
        return f"{self._http.url}/auth/sso/{slug}/start"

    def reset_password(self, email: str) -> dict:
        return self._http.request(
            "POST",
            "/auth/reset-password",
            content=json.dumps({"email": email}).encode(),
        )


class AsyncAuthClient:
    def __init__(self, http=None, http_client=None):
        self._http = http if http is not None else http_client

    async def sign_up(self, email: str, password: str, **kwargs) -> dict:
        body = {"email": email, "password": password, **kwargs}
        result = await self._http.request("POST", "/auth/signup", content=json.dumps(body).encode())
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    async def sign_in_with_password(self, email: str, password: str) -> dict:
        result = await self._http.request(
            "POST",
            "/auth/signin",
            content=json.dumps({"email": email, "password": password}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    async def sign_in_with_oauth(self, provider: str, redirect_to: Optional[str] = None) -> dict:
        body: dict[str, Any] = {"provider": provider}
        if redirect_to:
            body["redirect_to"] = redirect_to
        return await self._http.request("POST", "/auth/oauth", content=json.dumps(body).encode())

    async def verify_otp(self, email: str, otp: str, type: str = "signup") -> dict:
        result = await self._http.request(
            "POST",
            "/auth/otp/verify",
            content=json.dumps({"email": email, "token": otp, "type": type}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    async def send_phone_otp(self, phone: str) -> dict:
        return await self._http.request(
            "POST",
            "/auth/phone/send-otp",
            content=json.dumps({"phone": phone}).encode(),
        )

    async def verify_phone_otp(self, phone: str, otp: str) -> dict:
        result = await self._http.request(
            "POST",
            "/auth/phone/verify-otp",
            content=json.dumps({"phone": phone, "otp": otp}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    async def get_user(self) -> dict:
        return await self._http.request("GET", "/auth/user")

    async def update_user(self, **kwargs) -> dict:
        return await self._http.request("PATCH", "/auth/user", content=json.dumps(kwargs).encode())

    async def sign_out(self) -> dict:
        result = await self._http.request("POST", "/auth/signout")
        self._http.clear_tokens()
        return result

    async def refresh_session(self) -> dict:
        if not self._http._refresh_token:
            return {"data": None, "error": {"code": "NO_REFRESH_TOKEN", "message": "No refresh token"}}
        result = await self._http.request(
            "POST",
            "/auth/refresh",
            content=json.dumps({"refresh_token": self._http._refresh_token}).encode(),
        )
        if result.get("data", {}).get("access_token"):
            d = result["data"]
            self._http.set_tokens(d["access_token"], d.get("refresh_token", ""))
        return result

    async def create_enterprise_connection(self, payload: dict) -> dict:
        return await self._http.request(
            "POST",
            "/auth/enterprise/connections",
            content=json.dumps(payload).encode(),
        )

    async def list_sso_connections(self) -> dict:
        return await self._http.request("GET", "/auth/enterprise/connections")

    async def start_sso(self, slug: str) -> str:
        return f"{self._http.url}/auth/sso/{slug}/start"

    async def reset_password(self, email: str) -> dict:
        return await self._http.request(
            "POST",
            "/auth/reset-password",
            content=json.dumps({"email": email}).encode(),
        )
