"""
generate_instagram_post.py

Pipeline: poem text → Instagram image + caption.

Steps:
  1. Select excerpt, title and image prompt  (gpt-5, text)
  2. Generate image                          (gpt-image-1.5, images API)
  3. QA: evaluate image vs overlay           (gpt-5-mini, vision via Responses API)
  Caption: formatted string, no model call
"""

from __future__ import annotations

import io
import base64
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

from server.social.costs import (
    add_estimates,
    cost_estimate,
    usage_from_image,
    usage_from_response,
)
from server.social.parsing import parse_json
from server.social.prompts import GENERATE_PROMPT, GENERATE_IMAGE
from server.social.types import CostEstimate

# ── constants ──────────────────────────────────────────────────────────────────

TESTING = None
TESTING = Path(__file__).parent / "TESTING.png"

HASHTAGS = "#Poetry #PoetryCommunity #SpilledInk #PoetryIsNotDead #PoetsOfInstagram"
ADULT_HASHTAG = "#EroticPoetry"

TEXT_MODEL = "gpt-5"
IMAGE_MODEL = "gpt-image-1.5"
IMAGE_SIZE = "1024x1024"
FONTS_DIR = Path(__file__).parent / "fonts"
TEXT_MARGIN = 30

_PLACEMENT: dict[str, tuple[str, str]] = {
    "top-left":     ("left",   "top"),
    "top":          ("center", "top"),
    "top-right":    ("right",  "top"),
    "left":         ("left",   "middle"),
    "centre":       ("center", "middle"),
    "right":        ("right",  "middle"),
    "bottom-left":  ("left",   "bottom"),
    "bottom":       ("center", "bottom"),
    "bottom-right": ("right",  "bottom"),
}


def generate(
    poem_title: str,
    poem_body: str,
) -> dict[str, Any]:

    if TESTING and TESTING.exists():
        with open(TESTING, "rb") as f:
            return {
                "excerpt": "excerpt",
                "prompt": "description",
                "image": base64.b64encode(f.read()).decode("ascii"),
                "alt_text": "alt_text",
                "is_adult": False,
                "cost": CostEstimate(),
            }

    text_response = OpenAI().responses.create(
        model=TEXT_MODEL,
        input=GENERATE_PROMPT.format(
            title=poem_title,
            body=poem_body,
            image_size=IMAGE_SIZE,
        ),
    )
    parsed = parse_json(text_response.output_text)
    excerpt: str = parsed["excerpt"]
    excerpt = f"{excerpt}\n\n— {poem_title}"
    description: str = parsed["description"]
    alt_text: str = parsed["alt_text"]
    is_adult: bool = parsed["is_adult"]

    image_response = OpenAI().images.generate(
        model=IMAGE_MODEL,
        prompt=GENERATE_IMAGE.format(description=description, image_size=IMAGE_SIZE),
        size=IMAGE_SIZE,
        n=1,
    )
    image = f"data:image/png;base64,{image_response.data[0].b64_json}"

    return {
        "excerpt": excerpt,
        "prompt": description,
        "image": image,
        "alt_text": alt_text,
        "is_adult": is_adult,
        "cost": add_estimates(
            cost_estimate(TEXT_MODEL, usage_from_response(text_response)),
            cost_estimate(IMAGE_MODEL, usage_from_image(image_response)),
        ),
    }


def regenerate(
    prompt: str,
    existing_image_b64: str,
) -> dict[str, Any]:

    if TESTING and TESTING.exists():
        with open(TESTING, "rb") as f:
            return {
                "prompt": "prompt",
                "image": base64.b64encode(f.read()).decode("ascii"),
                "cost": CostEstimate(),
            }

    raw_b64 = existing_image_b64.removeprefix("data:image/png;base64,")
    image_bytes = base64.b64decode(raw_b64)
    image_response = OpenAI().images.edit(
        model=IMAGE_MODEL,
        image=("image.png", io.BytesIO(image_bytes), "image/png"),
        prompt=prompt
        + GENERATE_IMAGE.format(
            description=prompt,
            image_size=IMAGE_SIZE,
        ),
        size=IMAGE_SIZE,
        n=1,
    )
    image = f"data:image/png;base64,{image_response.data[0].b64_json}"
    image_cost = cost_estimate(IMAGE_MODEL, usage_from_image(image_response))

    return {
        "prompt": prompt,
        "image": image,
        "cost": image_cost,
    }


def instagram_caption(excerpt: str, poem_url: str, is_adult: bool) -> str:
    today = date.today()
    tags = f"{HASHTAGS} {ADULT_HASHTAG}" if is_adult else HASHTAGS
    return f"-\n\n{excerpt}\n\n{poem_url}\n\nCopyright \u00a9 {today.strftime('%-d %B %Y')} by John Wagner\n\n{tags}"


def threads_caption(excerpt: str, poem_url: str, is_adult: bool) -> str:
    tags = f"#Poetry {ADULT_HASHTAG}" if is_adult else HASHTAGS
    caption = f"{excerpt}\n\n{poem_url}\n\n{tags}"
    if len(caption) > 500:
        caption = f"{excerpt}\n\n{tags}"
    if len(caption) > 500:
        caption = f"{excerpt}"
    if len(caption) > 500:
        caption = f"{poem_url}\n\n{tags}"
    return caption


def bsky_caption(excerpt: str, poem_url: str, is_adult: bool) -> str:
    tags = f"#Poetry {ADULT_HASHTAG}" if is_adult else HASHTAGS
    caption = f"{excerpt}\n\n{poem_url}\n\n{tags}"
    if len(caption) > 300:
        caption = f"{excerpt}\n\n{tags}"
    if len(caption) > 300:
        caption = f"{excerpt}"
    if len(caption) > 300:
        caption = f"{poem_url}\n\n{tags}"
    return caption


def overlay_text(
    image: Image.Image,
    text: str,
    font_stem: str,
    size: int,
    colour: str,
    location: str,
    margin: int = TEXT_MARGIN,
) -> Image.Image:
    image = image.copy()
    draw = ImageDraw.Draw(image)
    w, h = image.size

    font = ImageFont.truetype(str(FONTS_DIR / f"{font_stem}.ttf"), size)
    horiz, vert = _PLACEMENT.get(location, ("center", "middle"))
    align = "left"

    bbox = draw.multiline_textbbox((0, 0), text, font=font, align=align)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    if horiz == "left":
        x = margin
    elif horiz == "center":
        x = (w - text_w) // 2
    else:
        x = w - margin - text_w

    if vert == "top":
        y = margin
    elif vert == "middle":
        y = (h - text_h) // 2
    else:
        y = h - margin - text_h

    if colour == "auto":
        region = image.crop((max(0, x), max(0, y), min(w, x + text_w), min(h, y + text_h)))
        arr = np.array(region.convert("RGB"), dtype=np.float32)
        lum = (0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]).mean()
        colour = "#000000" if lum > 128 else "#ffffff"

    draw.multiline_text((x, y), text, font=font, fill=colour, align=align)
    return image
