"""Bluesky posting via the AT Protocol XRPC API."""
from __future__ import annotations

import os
import httpx
from datetime import datetime, timezone

BSKY_API = "https://bsky.social/xrpc"
TIMEOUT = 60.0


def post_to_bsky(image_bytes: bytes, caption: str) -> str:
    """Three-step AT Protocol flow: createSession → uploadBlob → createRecord; returns the bsky.app URL."""
    handle = os.environ["BSKY_HANDLE"]
    password = os.environ["BSKY_APP_PASSWORD"]

    r = httpx.post(
        f"{BSKY_API}/com.atproto.server.createSession",
        json={"identifier": handle, "password": password},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    session = r.json()
    token = session["accessJwt"]
    did = session["did"]

    headers = {"Authorization": f"Bearer {token}"}

    r = httpx.post(
        f"{BSKY_API}/com.atproto.repo.uploadBlob",
        headers={**headers, "Content-Type": "image/png"},
        content=image_bytes,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    blob = r.json()["blob"]

    r = httpx.post(
        f"{BSKY_API}/com.atproto.repo.createRecord",
        headers=headers,
        json={
            "repo": did,
            "collection": "app.bsky.feed.post",
            "record": {
                "$type": "app.bsky.feed.post",
                "text": caption,
                "embed": {
                    "$type": "app.bsky.embed.images",
                    "images": [{"image": blob, "alt": ""}],
                },
                "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            },
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    uri = r.json()["uri"]
    # at://did:plc:.../app.bsky.feed.post/{rkey} → web URL
    rkey = uri.rsplit("/", 1)[-1]
    return f"https://bsky.app/profile/{handle}/post/{rkey}"
