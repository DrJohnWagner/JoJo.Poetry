"""Instagram and Threads posting via the Meta Graph API."""
from __future__ import annotations

import os
import httpx

GRAPH_API = "https://graph.instagram.com/v21.0"
THREADS_API = "https://graph.threads.net/v1.0"
TIMEOUT = 60.0


def post_to_instagram(image_url: str, caption: str, alt_text: str = "") -> str:
    """Three-step Graph API flow: create media container, publish, fetch shortcode; returns the post URL."""
    user_id = os.environ["INSTAGRAM_USER_ID"]
    token = os.environ["INSTAGRAM_ACCESS_TOKEN"]

    params: dict[str, str] = {"image_url": image_url, "caption": caption, "access_token": token}
    if alt_text:
        params["alt_text"] = alt_text

    r = httpx.post(f"{GRAPH_API}/{user_id}/media", params=params, timeout=TIMEOUT)
    r.raise_for_status()
    creation_id = r.json()["id"]

    r = httpx.post(
        f"{GRAPH_API}/{user_id}/media_publish",
        params={"creation_id": creation_id, "access_token": token},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    media_id = r.json()["id"]

    r = httpx.get(
        f"{GRAPH_API}/{media_id}",
        params={"fields": "shortcode", "access_token": token},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    shortcode = r.json()["shortcode"]
    return f"https://www.instagram.com/p/{shortcode}/"


def post_to_threads(image_url: str, caption: str) -> str:
    """Three-step Threads API flow: create container, publish, fetch permalink; returns the post URL."""
    user_id = os.environ["THREADS_USER_ID"]
    token = os.environ["THREADS_ACCESS_TOKEN"]

    r = httpx.post(
        f"{THREADS_API}/{user_id}/threads",
        params={"media_type": "IMAGE", "image_url": image_url, "text": caption, "access_token": token},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    creation_id = r.json()["id"]

    r = httpx.post(
        f"{THREADS_API}/{user_id}/threads_publish",
        params={"creation_id": creation_id, "access_token": token},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    post_id = r.json()["id"]

    r = httpx.get(
        f"{THREADS_API}/{post_id}",
        params={"fields": "permalink", "access_token": token},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()["permalink"]
