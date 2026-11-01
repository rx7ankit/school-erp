"""Login brake. Five wrong passwords in 15 minutes lock that email and address for the rest of the window."""

from app.core.config import settings
from app.core.errors import TooManyRequests
from app.db.redis import redis


def _key(email: str, ip: str | None) -> str:
    return f"login:fail:{email.lower()}:{ip or '-'}"


async def check_login_allowed(email: str, ip: str | None) -> None:
    n = await redis.get(_key(email, ip))
    if n and int(n) >= settings.login_max_attempts:
        ttl = await redis.ttl(_key(email, ip))
        raise TooManyRequests(
            "Too many wrong attempts. Please wait a few minutes and try again, or use Forgot password.",
            code="login_locked",
            headers={"Retry-After": str(max(ttl, 1))},
        )


async def record_login_failure(email: str, ip: str | None) -> None:
    k = _key(email, ip)
    n = await redis.incr(k)
    if n == 1:
        await redis.expire(k, settings.login_window_seconds)


async def clear_login_failures(email: str, ip: str | None) -> None:
    await redis.delete(_key(email, ip))


async def check_and_count(bucket: str, limit: int, window: int) -> None:
    """Generic counter, used for password reset requests."""
    n = await redis.incr(bucket)
    if n == 1:
        await redis.expire(bucket, window)
    if n > limit:
        raise TooManyRequests("Too many requests. Please try again later.", code="rate_limited")
