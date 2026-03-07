import json
from typing import Optional, Union


class NotifyClient:
    def __init__(self, http):
        self._http = http

    def send_push(
        self,
        title: str,
        body: str,
        user_id: Optional[str] = None,
        tokens: Optional[list[str]] = None,
        data: Optional[dict] = None,
    ) -> dict:
        payload: dict = {"title": title, "body": body}
        if user_id:
            payload["user_id"] = user_id
        if tokens:
            payload["tokens"] = tokens
        if data:
            payload["data"] = data
        return self._http.request("POST", "/notify/push", content=json.dumps(payload).encode())

    def send_sms(
        self,
        to: str,
        body: str,
        dlt_template_id: str,
        template_id: Optional[str] = None,
        variables: Optional[dict] = None,
    ) -> dict:
        payload = {
            "to": to,
            "body": body,
            "dlt_template_id": dlt_template_id,
        }
        if template_id:
            payload["template_id"] = template_id
        if variables:
            payload["variables"] = variables
        return self._http.request("POST", "/notify/sms", content=json.dumps(payload).encode())

    def send_email(
        self,
        to: Union[str, list[str]],
        subject: str,
        body: str,
        is_html: bool = False,
        template_id: Optional[str] = None,
        variables: Optional[dict] = None,
    ) -> dict:
        recipients = [to] if isinstance(to, str) else to
        payload = {
            "to": recipients,
            "subject": subject,
            "body": body,
            "is_html": is_html,
        }
        if template_id:
            payload["template_id"] = template_id
        if variables:
            payload["variables"] = variables
        return self._http.request("POST", "/notify/email", content=json.dumps(payload).encode())


class AsyncNotifyClient:
    def __init__(self, http):
        self._http = http

    async def send_push(
        self,
        title: str,
        body: str,
        user_id: Optional[str] = None,
        tokens: Optional[list[str]] = None,
        data: Optional[dict] = None,
    ) -> dict:
        payload: dict = {"title": title, "body": body}
        if user_id:
            payload["user_id"] = user_id
        if tokens:
            payload["tokens"] = tokens
        if data:
            payload["data"] = data
        return await self._http.request("POST", "/notify/push", content=json.dumps(payload).encode())

    async def send_sms(
        self,
        to: str,
        body: str,
        dlt_template_id: str,
        template_id: Optional[str] = None,
        variables: Optional[dict] = None,
    ) -> dict:
        payload = {"to": to, "body": body, "dlt_template_id": dlt_template_id}
        if template_id:
            payload["template_id"] = template_id
        if variables:
            payload["variables"] = variables
        return await self._http.request("POST", "/notify/sms", content=json.dumps(payload).encode())
