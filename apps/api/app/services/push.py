"""Push to phones. Same shape as services/email.py: an abstract sender, a console one for development, a memory
one for tests and real ones.

PUSH_BACKEND=apns sends iPhones straight to Apple (the app registers a plain APNs device token, no Firebase in the
app) and sends Android through FCM HTTP v1 once FCM_* is set. PUSH_BACKEND=fcm sends both through FCM, which needs
the iOS app to use the Firebase SDK; the iOS app here does not."""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx
import jwt

from app.core.config import settings

log = logging.getLogger("krevo.push")


@dataclass
class PushMessage:
    token: str
    platform: str  # ios | android
    title: str
    body: str
    data: dict[str, str] = field(default_factory=dict)


class InvalidDeviceToken(Exception):
    """The push service says this token is dead (app uninstalled, token rotated). The caller deletes it."""


class PushSender:
    async def send(self, msg: PushMessage) -> None:
        """Raises InvalidDeviceToken for a dead token, any other exception for a failure worth logging."""
        raise NotImplementedError


class ConsolePushSender(PushSender):
    async def send(self, msg: PushMessage) -> None:
        log.info("PUSH %s token=%s... title=%s body=%s", msg.platform, msg.token[:8], msg.title, msg.body)


class MemoryPushSender(PushSender):
    """For tests: keeps what was sent. `fail` makes every send raise, `dead_tokens` raise InvalidDeviceToken."""

    def __init__(self) -> None:
        self.sent: list[PushMessage] = []
        self.fail = False
        self.dead_tokens: set[str] = set()

    async def send(self, msg: PushMessage) -> None:
        if self.fail:
            raise RuntimeError("push service unreachable")
        if msg.token in self.dead_tokens:
            raise InvalidDeviceToken(msg.token)
        self.sent.append(msg)

    def to_token(self, token: str) -> list[PushMessage]:
        return [m for m in self.sent if m.token == token]


class FcmPushSender(PushSender):
    """Firebase Cloud Messaging HTTP v1 with a service account (OAuth2 JWT bearer flow), through httpx.
    Settings: FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT (the key JSON text, or a path to the file)."""

    SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
    SEND_URL = "https://fcm.googleapis.com/v1/projects/{project}/messages:send"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None, service_account: dict | None = None) -> None:
        self._transport = transport
        self._account = service_account
        self._token: str | None = None
        self._token_expires = 0.0
        self._lock = asyncio.Lock()

    def _service_account(self) -> dict:
        if self._account is None:
            raw = settings.fcm_service_account.strip()
            if not raw:
                raise RuntimeError("FCM_SERVICE_ACCOUNT is not set")
            self._account = json.loads(raw if raw.startswith("{") else Path(raw).read_text())
        return self._account

    async def _access_token(self, client: httpx.AsyncClient, *, force: bool = False) -> str:
        async with self._lock:
            if self._token and not force and time.time() < self._token_expires - 60:
                return self._token
            acct = self._service_account()
            now = int(time.time())
            token_uri = acct.get("token_uri", "https://oauth2.googleapis.com/token")
            assertion = jwt.encode(
                {"iss": acct["client_email"], "scope": self.SCOPE, "aud": token_uri, "iat": now, "exp": now + 3600},
                acct["private_key"],
                algorithm="RS256",
            )
            r = await client.post(
                token_uri, data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}
            )
            if r.status_code >= 300:
                raise RuntimeError(f"Google refused the FCM service account ({r.status_code})")
            body = r.json()
            self._token = body["access_token"]
            self._token_expires = time.time() + int(body.get("expires_in", 3600))
            return self._token

    @staticmethod
    def payload(msg: PushMessage) -> dict:
        m: dict = {
            "token": msg.token,
            "notification": {"title": msg.title, "body": msg.body},
            "data": {k: str(v) for k, v in msg.data.items()},  # FCM data values must be strings
        }
        if msg.platform == "ios":
            m["apns"] = {"headers": {"apns-priority": "10"}, "payload": {"aps": {"sound": "default"}}}
        else:
            note = {"sound": "default"}
            channel = msg.data.get("channel")
            if channel in ("attendance", "fees", "general"):  # the channels the Android app creates
                note["channel_id"] = channel
            m["android"] = {"priority": "HIGH", "notification": note}
        return {"message": m}

    async def send(self, msg: PushMessage) -> None:
        if not settings.fcm_project_id:
            raise RuntimeError("FCM_PROJECT_ID is not set")
        url = self.SEND_URL.format(project=settings.fcm_project_id)
        async with httpx.AsyncClient(transport=self._transport, timeout=15) as c:
            r = None
            for attempt in (0, 1):
                token = await self._access_token(c, force=attempt == 1)
                r = await c.post(url, headers={"Authorization": f"Bearer {token}"}, json=self.payload(msg))
                if r.status_code != 401:  # an expired bearer: fetch a new one once
                    break
        assert r is not None
        if r.status_code < 300:
            return
        status = ""
        try:
            status = r.json().get("error", {}).get("status", "")
            for d in r.json().get("error", {}).get("details", []):
                status = d.get("errorCode", status)
        except ValueError:
            pass
        if r.status_code == 404 or status == "UNREGISTERED":
            raise InvalidDeviceToken(msg.token)
        # Never log the device token or the message text.
        raise RuntimeError(f"FCM rejected the push ({r.status_code} {status})")


class ApnsPushSender(PushSender):
    """Apple Push Notification service over HTTP/2 with a .p8 key (ES256 JWT), through httpx.
    Settings: APNS_KEY (the .p8 text with newlines written as backslash-n, or a path to the file),
    APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.
    TestFlight and App Store builds use Apple's production host; builds run from Xcode use the sandbox. A token is
    tried on production first and, if Apple says it is not valid there, on the sandbox, so both kinds work."""

    HOSTS = ("https://api.push.apple.com", "https://api.sandbox.push.apple.com")
    DEAD = {"Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"}

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None, key: str | None = None) -> None:
        self._transport = transport
        self._key = key
        self._jwt: str | None = None
        self._jwt_at = 0.0

    def _bearer(self) -> str:
        # Apple wants a fresh token every 20 to 60 minutes: reuse one for 40.
        if self._jwt and time.time() - self._jwt_at < 2400:
            return self._jwt
        if self._key is None:
            raw = settings.apns_key.strip()
            if not raw:
                raise RuntimeError("APNS_KEY is not set")
            self._key = raw.replace("\\n", "\n") if raw.startswith("-----") else Path(raw).read_text()
        if not (settings.apns_key_id and settings.apns_team_id and settings.apns_bundle_id):
            raise RuntimeError("APNS_KEY_ID, APNS_TEAM_ID and APNS_BUNDLE_ID must be set")
        now = int(time.time())
        self._jwt = jwt.encode(
            {"iss": settings.apns_team_id, "iat": now},
            self._key,
            algorithm="ES256",
            headers={"kid": settings.apns_key_id},
        )
        self._jwt_at = now
        return self._jwt

    @staticmethod
    def payload(msg: PushMessage) -> dict:
        body: dict = {k: str(v) for k, v in msg.data.items()}
        body["aps"] = {"alert": {"title": msg.title, "body": msg.body}, "sound": "default"}
        return body

    async def send(self, msg: PushMessage) -> None:
        headers = {
            "authorization": f"bearer {self._bearer()}",
            "apns-topic": settings.apns_bundle_id,
            "apns-push-type": "alert",
            "apns-priority": "10",
        }
        reason = ""
        async with httpx.AsyncClient(transport=self._transport, http2=True, timeout=15) as c:
            for host in self.HOSTS:
                r = await c.post(f"{host}/3/device/{msg.token}", headers=headers, json=self.payload(msg))
                if r.status_code == 200:
                    return
                try:
                    reason = r.json().get("reason", "")
                except ValueError:
                    reason = ""
                if reason == "ExpiredProviderToken":
                    self._jwt = None
                if r.status_code == 410 or reason in ("BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"):
                    continue  # maybe it belongs to the other environment
                break
        if reason in self.DEAD:
            raise InvalidDeviceToken(msg.token)
        # Never log the device token or the message text.
        raise RuntimeError(f"APNs rejected the push ({reason or 'error'})")


class SplitPushSender(PushSender):
    """iPhones go to Apple directly, Android goes to FCM (or just the log until FCM is set up)."""

    def __init__(self, ios: PushSender, android: PushSender) -> None:
        self.ios, self.android = ios, android

    async def send(self, msg: PushMessage) -> None:
        await (self.ios if msg.platform == "ios" else self.android).send(msg)


_sender: PushSender | None = None


def get_push_sender() -> PushSender:
    global _sender
    if _sender is None:
        if settings.push_backend == "apns":
            _sender = SplitPushSender(
                ApnsPushSender(), FcmPushSender() if settings.fcm_project_id else ConsolePushSender()
            )
        else:
            _sender = {"memory": MemoryPushSender, "fcm": FcmPushSender}.get(settings.push_backend, ConsolePushSender)()
    return _sender


def set_push_sender(s: PushSender | None) -> None:
    global _sender
    _sender = s
