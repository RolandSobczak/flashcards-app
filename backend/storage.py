import base64
import binascii
import io
import re
from dataclasses import dataclass

from minio import Minio
from minio.deleteobjects import DeleteObject

from .config import settings

_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure,
)

_EXT_BY_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}

_DATA_URI_RE = re.compile(r"^data:(?P<content_type>[\w.+/-]+);base64,(?P<payload>.+)$", re.DOTALL)


def ensure_bucket() -> None:
    if not _client.bucket_exists(settings.minio_bucket):
        _client.make_bucket(settings.minio_bucket)


@dataclass
class DecodedImage:
    data: bytes
    content_type: str


def decode_image(value: str | None) -> DecodedImage | None:
    """Decode an embedded image (data URI or bare base64) from a card's
    frontImage/backImage field. Returns None for external references
    (http(s) URLs, local paths) — those aren't ours to store."""
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://") or value.startswith("/") or value.startswith("./"):
        return None

    m = _DATA_URI_RE.match(value)
    if m:
        payload = m.group("payload")
        content_type = m.group("content_type")
    else:
        payload = value
        content_type = "image/png"

    try:
        data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    return DecodedImage(data=data, content_type=content_type)


def object_key(set_id: int, card_position: int, side: str, content_type: str) -> str:
    ext = _EXT_BY_CONTENT_TYPE.get(content_type, "bin")
    return f"sets/{set_id}/{card_position}-{side}.{ext}"


def upload_image(key: str, image: DecodedImage) -> None:
    _client.put_object(
        settings.minio_bucket,
        key,
        io.BytesIO(image.data),
        length=len(image.data),
        content_type=image.content_type,
    )


def get_object(key: str):
    """Returns a urllib3 response; caller is responsible for closing/releasing it."""
    return _client.get_object(settings.minio_bucket, key)


def delete_set_images(set_id: int) -> None:
    prefix = f"sets/{set_id}/"
    objects = _client.list_objects(settings.minio_bucket, prefix=prefix, recursive=True)
    to_delete = [DeleteObject(obj.object_name) for obj in objects]
    if to_delete:
        list(_client.remove_objects(settings.minio_bucket, to_delete))
