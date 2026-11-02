import httpx
import pytest

from app.core.config import settings
from app.services.email import Mail, ResendEmailSender
from app.services.storage import MemoryStorage, StoredObject, get_storage, make_key
from tests.conftest import API, add_staff, staff_headers


@pytest.mark.asyncio
async def test_resend_posts_to_the_api(monkeypatch):
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["auth"], seen["body"] = req.headers["authorization"], req.read()
        return httpx.Response(200, json={"id": "abc"})

    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    await ResendEmailSender(httpx.MockTransport(handler)).send(Mail(to="a@b.in", subject="Hi", body="Body"))
    assert seen["auth"] == "Bearer re_test"
    assert b'"to":["a@b.in"]' in seen["body"].replace(b" ", b"")


@pytest.mark.asyncio
async def test_resend_failure_raises_without_leaking_the_mail(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    t = httpx.MockTransport(lambda r: httpx.Response(422, json={"message": "bad from"}))
    with pytest.raises(RuntimeError) as e:
        await ResendEmailSender(t).send(Mail(to="a@b.in", subject="Hi", body="Temporary password: SECRET"))
    assert "SECRET" not in str(e.value)


@pytest.mark.asyncio
async def test_resend_needs_a_key(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "")
    with pytest.raises(RuntimeError):
        await ResendEmailSender().send(Mail(to="a@b.in", subject="s", body="b"))


@pytest.fixture
def store() -> MemoryStorage:
    s = get_storage()
    assert isinstance(s, MemoryStorage)
    s.objects.clear()
    return s


def test_keys_start_with_the_school_and_are_clean():
    import uuid

    sid, fid = uuid.uuid4(), uuid.uuid4()
    k = make_key(sid, "student_photo", fid, "../../My Photo (1).jpg")
    assert k.startswith(f"schools/{sid}/student_photo/{fid}/")
    assert ".." not in k.split(str(fid))[1] and " " not in k


async def _ask(client, h, **over):
    body = {"purpose": "student_photo", "filename": "a.jpg", "content_type": "image/jpeg", "size_bytes": 1000} | over
    return await client.post(f"{API}/files/upload-url", headers=h, json=body)


@pytest.mark.asyncio
async def test_upload_flow(client, school_a, store):
    h = school_a["headers"]
    r = await _ask(client, h)
    assert r.status_code == 201, r.text
    up = r.json()
    assert up["method"] == "PUT" and up["headers"]["Content-Type"] == "image/jpeg"
    # not uploaded yet
    assert (await client.post(f"{API}/files/{up['id']}/complete", headers=h)).json()["error"][
        "code"
    ] == "upload_missing"
    assert (await client.get(f"{API}/files/{up['id']}/url", headers=h)).status_code == 404
    key = next(iter(store.objects), None)
    assert key is None
    # simulate the app uploading to R2
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.file import Attachment

    async with system_session() as db:
        key = await db.scalar(select(Attachment.storage_key))
    store.objects[key] = StoredObject(size=1000, content_type="image/jpeg")
    done = await client.post(f"{API}/files/{up['id']}/complete", headers=h)
    assert done.status_code == 200 and done.json()["status"] == "ready"
    link = await client.get(f"{API}/files/{up['id']}/url", headers=h)
    assert link.status_code == 200 and link.json()["url"].startswith("https://")


@pytest.mark.asyncio
async def test_rules(client, school_a, store):
    h = school_a["headers"]
    assert (await _ask(client, h, purpose="nope")).json()["error"]["code"] == "invalid_purpose"
    assert (await _ask(client, h, content_type="application/zip")).json()["error"]["code"] == "invalid_file_type"
    assert (await _ask(client, h, size_bytes=50 * 1024 * 1024)).json()["error"]["code"] == "file_too_large"
    assert (await client.post(f"{API}/files/upload-url", json={})).status_code == 401


@pytest.mark.asyncio
async def test_size_mismatch_is_rejected(client, school_a, store):
    h = school_a["headers"]
    up = (await _ask(client, h)).json()
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.file import Attachment

    async with system_session() as db:
        key = await db.scalar(select(Attachment.storage_key))
    store.objects[key] = StoredObject(size=5, content_type="image/jpeg")
    r = await client.post(f"{API}/files/{up['id']}/complete", headers=h)
    assert r.json()["error"]["code"] == "upload_mismatch" and key not in store.objects


@pytest.mark.asyncio
async def test_files_are_private(client, school_a, school_b, mail, store):
    up = (await _ask(client, school_a["headers"])).json()
    # another school cannot see it
    assert (await client.get(f"{API}/files/{up['id']}", headers=school_b["headers"])).status_code == 404
    # a colleague who did not upload it cannot open it, the admin can
    await add_staff(client, school_a["headers"], mail)
    colleague = await staff_headers(client, mail, "rajiv@rps.example")
    assert (await client.get(f"{API}/files/{up['id']}", headers=colleague)).status_code == 403
    assert (await client.get(f"{API}/files/{up['id']}", headers=school_a["headers"])).status_code == 200
