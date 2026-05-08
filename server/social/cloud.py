"""Cloudinary image upload/delete helpers; credentials are read from environment variables."""
from __future__ import annotations

import os
import cloudinary
import cloudinary.uploader


def _config() -> None:
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def upload(image_bytes: bytes) -> str:
    """Upload raw image bytes to Cloudinary under jojo_poetry/; returns the secure URL."""
    _config()
    result = cloudinary.uploader.upload(
        image_bytes,
        folder="jojo_poetry",
        resource_type="image",
    )
    return result["secure_url"]


def delete(public_id: str) -> None:
    _config()
    cloudinary.uploader.destroy(public_id)
