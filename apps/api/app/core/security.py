import asyncio
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.clock import utcnow
from app.core.config import settings
from app.core.errors import Unauthorized

_hasher = PasswordHasher(time_cost=settings.argon_time_cost, memory_cost=settings.argon_memory_kib, parallelism=2)
# Without these, an unknown email would answer faster than a wrong password. See verify_password.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password: str, password_hash: str | None) -> bool:
    """Always does the same work, even for unknown users, so timing does not reveal who exists."""
    target = password_hash or _DUMMY_HASH
    try:
        ok = await asyncio.to_thread(_hasher.verify, target, password)
    except (VerificationError, InvalidHashError):
        return False
    return ok and password_hash is not None


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


# Unambiguous characters only (no 0/O, 1/l/I) so a temporary password is easy to read out loud.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def temp_password() -> str:
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Refresh and reset tokens are random, so a fast hash is enough. Only the hash is stored."""
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class AccessClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID
    kind: str
    school_id: uuid.UUID | None


def create_access_token(*, user_id: uuid.UUID, session_id: uuid.UUID, kind: str, school_id: uuid.UUID | None) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "kind": kind,
        "sch": str(school_id) if school_id else None,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_ttl_minutes)).timestamp()),
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> AccessClaims:
    try:
        p = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub", "sid"]})
    except jwt.ExpiredSignatureError as e:
        raise Unauthorized("Your session has expired. Please sign in again.", code="token_expired") from e
    except jwt.PyJWTError as e:
        raise Unauthorized("Please sign in again.", code="invalid_token") from e
    if p.get("typ") != "access":
        raise Unauthorized("Please sign in again.", code="invalid_token")
    return AccessClaims(
        uuid.UUID(p["sub"]), uuid.UUID(p["sid"]), p["kind"], uuid.UUID(p["sch"]) if p.get("sch") else None
    )
