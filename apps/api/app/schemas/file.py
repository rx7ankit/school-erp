import uuid

from pydantic import BaseModel, ConfigDict, Field


class UploadIn(BaseModel):
    purpose: str
    filename: str = Field(min_length=1, max_length=200)
    content_type: str
    size_bytes: int = Field(gt=0)


class UploadOut(BaseModel):
    id: uuid.UUID
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    expires_in: int


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    purpose: str
    filename: str
    content_type: str
    size_bytes: int
    status: str


class DownloadOut(BaseModel):
    url: str
    expires_in: int
