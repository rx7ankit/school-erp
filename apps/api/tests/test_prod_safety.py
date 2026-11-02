import pytest
from starlette.requests import Request

from app.api.deps import client_ip
from app.core.config import Settings, settings


def test_production_refuses_the_development_secret():
    with pytest.raises(ValueError):
        Settings(env="prod", jwt_secret="dev-only-change-me-dev-only-change-me")
    with pytest.raises(ValueError):
        Settings(env="prod", jwt_secret="short")
    assert Settings(env="prod", jwt_secret="x" * 48).env == "prod"
    assert Settings(env="dev").env == "dev"  # development is not restricted


def _request(headers: dict[str, str], host="10.0.0.9") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (host, 1234), "method": "GET", "path": "/"})


def test_visitor_address_is_only_trusted_with_the_shared_secret(monkeypatch):
    monkeypatch.setattr(settings, "bff_secret", "s3cret-value")
    spoof = {"x-client-ip": "1.2.3.4"}
    assert client_ip(_request(spoof)) == "10.0.0.9"  # no secret: ignored
    assert client_ip(_request({**spoof, "x-bff-secret": "wrong"})) == "10.0.0.9"
    assert client_ip(_request({**spoof, "x-bff-secret": "s3cret-value"})) == "1.2.3.4"
    assert client_ip(_request({"x-forwarded-for": "5.6.7.8, 10.0.0.1"})) == "5.6.7.8"
    monkeypatch.setattr(settings, "bff_secret", "")
    assert client_ip(_request({**spoof, "x-bff-secret": ""})) == "10.0.0.9"  # unset secret never matches


async def test_health_and_ready(client):
    assert (await client.get("/api/v1/health")).json() == {"status": "ok"}
    r = await client.get("/api/v1/health/ready")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
