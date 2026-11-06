import pytest
from sqlalchemy import select

from app.db.session import system_session
from app.models.file import Attachment
from app.services.storage import MemoryStorage, StoredObject, get_storage
from tests.conftest import API, add_staff, staff_headers


@pytest.fixture
def store() -> MemoryStorage:
    s = get_storage()
    assert isinstance(s, MemoryStorage)
    s.objects.clear()
    return s


async def _uploaded(client, store, h, purpose: str) -> str:
    """Ask for a link, 'upload' to the fake bucket, confirm. Returns the file id."""
    up = (
        await client.post(
            f"{API}/files/upload-url",
            headers=h,
            json={"purpose": purpose, "filename": "me.jpg", "content_type": "image/jpeg", "size_bytes": 500},
        )
    ).json()
    async with system_session() as db:
        key = await db.scalar(select(Attachment.storage_key).where(Attachment.id == up["id"]))
    store.objects[key] = StoredObject(size=500, content_type="image/jpeg")
    done = await client.post(f"{API}/files/{up['id']}/complete", headers=h)
    assert done.status_code == 200, done.text
    return up["id"]


@pytest.mark.asyncio
async def test_a_teacher_sets_and_clears_their_own_photo(client, school_a, mail, store):
    await add_staff(client, school_a["headers"], mail, email="t@rps.example")
    t = await staff_headers(client, mail, "t@rps.example")
    assert (await client.get(f"{API}/auth/me", headers=t)).json()["photo_url"] is None
    fid = await _uploaded(client, store, t, "staff_photo")
    r = await client.put(f"{API}/auth/me/photo", headers=t, json={"file_id": fid})
    assert r.status_code == 200 and r.json()["url"].startswith("https://")
    assert (await client.get(f"{API}/auth/me", headers=t)).json()["photo_url"].startswith("https://")
    assert (await client.put(f"{API}/auth/me/photo", headers=t, json={"file_id": None})).json()["url"] is None
    assert (await client.get(f"{API}/auth/me", headers=t)).json()["photo_url"] is None


@pytest.mark.asyncio
async def test_photo_rules(client, school_a, mail, store):
    await add_staff(client, school_a["headers"], mail, email="t@rps.example")
    await add_staff(client, school_a["headers"], mail, email="u@rps.example", name="Uma Rao")
    t = await staff_headers(client, mail, "t@rps.example")
    u = await staff_headers(client, mail, "u@rps.example")
    # wrong kind of file
    wrong = await _uploaded(client, store, t, "student_photo")
    assert (await client.put(f"{API}/auth/me/photo", headers=t, json={"file_id": wrong})).status_code == 422
    # somebody else's file
    theirs = await _uploaded(client, store, u, "staff_photo")
    assert (await client.put(f"{API}/auth/me/photo", headers=t, json={"file_id": theirs})).status_code == 404
    assert (await client.put(f"{API}/auth/me/photo", json={"file_id": None})).status_code == 401


@pytest.mark.asyncio
async def test_only_the_admin_sets_the_school_logo_and_everyone_sees_it(client, school_a, mail, store):
    admin = school_a["headers"]
    await add_staff(client, admin, mail, email="t@rps.example")
    t = await staff_headers(client, mail, "t@rps.example")
    assert (await client.get(f"{API}/auth/me", headers=t)).json()["school"]["logo_url"] is None
    mine = await _uploaded(client, store, t, "school_logo")
    assert (await client.put(f"{API}/school/logo", headers=t, json={"file_id": mine})).status_code == 403
    fid = await _uploaded(client, store, admin, "school_logo")
    r = await client.put(f"{API}/school/logo", headers=admin, json={"file_id": fid})
    assert r.status_code == 200 and r.json()["url"].startswith("https://")
    assert (await client.get(f"{API}/auth/me", headers=t)).json()["school"]["logo_url"].startswith("https://")
    assert (await client.put(f"{API}/school/logo", headers=admin, json={"file_id": None})).json()["url"] is None
