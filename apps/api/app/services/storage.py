"""File storage on Cloudflare R2 (S3 compatible). Files never pass through the API: the app uploads straight to R2
with a short-lived signed URL, and the API only hands out those URLs after checking who is asking."""

import asyncio
import uuid
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class StoredObject:
    size: int
    content_type: str | None


class Storage:
    async def upload_url(self, key: str, content_type: str, ttl: int) -> str:
        raise NotImplementedError

    async def download_url(self, key: str, filename: str, ttl: int) -> str:
        raise NotImplementedError

    async def head(self, key: str) -> StoredObject | None:
        raise NotImplementedError

    async def delete(self, key: str) -> None:
        raise NotImplementedError


class R2Storage(Storage):
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        if not (settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key):
            raise RuntimeError("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set")
        self._s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self._bucket = settings.r2_bucket

    async def upload_url(self, key: str, content_type: str, ttl: int) -> str:
        return self._s3.generate_presigned_url(
            "put_object", Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type}, ExpiresIn=ttl
        )

    async def download_url(self, key: str, filename: str, ttl: int) -> str:
        safe = filename.replace('"', "").replace("\\", "")
        return self._s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ResponseContentDisposition": f'attachment; filename="{safe}"',
            },
            ExpiresIn=ttl,
        )

    async def head(self, key: str) -> StoredObject | None:
        from botocore.exceptions import ClientError

        def _head() -> StoredObject | None:
            try:
                r = self._s3.head_object(Bucket=self._bucket, Key=key)
            except ClientError as e:
                if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                    return None
                raise
            return StoredObject(size=r["ContentLength"], content_type=r.get("ContentType"))

        return await asyncio.to_thread(_head)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._s3.delete_object, Bucket=self._bucket, Key=key)


class MemoryStorage(Storage):
    """Dev and tests. `objects` stands in for the bucket; tests put a file there to simulate the upload."""

    def __init__(self) -> None:
        self.objects: dict[str, StoredObject] = {}

    async def upload_url(self, key: str, content_type: str, ttl: int) -> str:
        return f"https://storage.test/upload/{key}?ttl={ttl}"

    async def download_url(self, key: str, filename: str, ttl: int) -> str:
        return f"https://storage.test/download/{key}?ttl={ttl}"

    async def head(self, key: str) -> StoredObject | None:
        return self.objects.get(key)

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = R2Storage() if settings.storage_backend == "r2" else MemoryStorage()
    return _storage


def set_storage(s: Storage | None) -> None:
    global _storage
    _storage = s


# What each kind of file may be. Keeps people from using the school bucket as a general file dump.
IMAGES = {"image/jpeg", "image/png", "image/webp"}
DOCS = IMAGES | {"application/pdf"}
VIDEOS = {"video/mp4", "video/quicktime"}
PURPOSES: dict[str, tuple[set[str], int]] = {
    "student_photo": (IMAGES, 3 * 1024 * 1024),
    "student_document": (DOCS, 10 * 1024 * 1024),
    "leave_attachment": (DOCS, 10 * 1024 * 1024),
    # Chats carry photos, short videos and PDFs.
    "message_attachment": (DOCS | VIDEOS, 50 * 1024 * 1024),
    "staff_document": (DOCS, 10 * 1024 * 1024),
    "school_logo": (IMAGES, 2 * 1024 * 1024),
    "staff_photo": (IMAGES, 3 * 1024 * 1024),
}


def safe_filename(name: str) -> str:
    keep = "".join(c if c.isalnum() or c in "._-" else "_" for c in name.strip())
    return (keep.strip("._") or "file")[-120:]


def make_key(school_id: uuid.UUID, purpose: str, file_id: uuid.UUID, filename: str) -> str:
    """Every key starts with the school, so one school's files are never mixed with another's."""
    return f"schools/{school_id}/{purpose}/{file_id}/{safe_filename(filename)}"
