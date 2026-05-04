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

import base64
from pathlib import Path
from typing import Any

import numpy as np
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

from server.instagram.parsing import parse_json
from server.instagram.prompts import GENERATE_PROMPT, GENERATE_IMAGE

# ── constants ──────────────────────────────────────────────────────────────────

TESTING = True

if TESTING:
    TEXT_MODEL = "gpt-5-mini"
else:
    TEXT_MODEL = "gpt-5"

IMAGE_MODEL = "gpt-image-1.5"
IMAGE_SIZE = "1024x1024"
INSTA_WIDTH = 1080
INSTA_HEIGHT = 1080
FONTS_DIR = Path(__file__).parent / "fonts"
TEXT_MARGIN = 60

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

    response = parse_json(
        OpenAI().responses.create(
            model=TEXT_MODEL,
            input=GENERATE_PROMPT.format(
                title=poem_title,
                body=poem_body,
                image_size=IMAGE_SIZE,
            ),
        ).output_text
    )
    excerpt: str = response["excerpt"]
    prompt: str = response["prompt"]

    if TESTING:
        test_png = Path(__file__).parent / "test.png"
        image = f"data:image/png;base64,{base64.b64encode(test_png.read_bytes()).decode()}"
    else:
        response = OpenAI().images.generate(
            model=IMAGE_MODEL,
            prompt=prompt + GENERATE_IMAGE.format(
                prompt=prompt,
                image_size=IMAGE_SIZE
            ),
            size=IMAGE_SIZE,
            n=1,
        )
        image = f"data:image/png;base64,{response.data[0].b64_json}"

    return {
        "excerpt": excerpt,
        "prompt": prompt,
        "image": image,
    }


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
    align = "center" if horiz == "center" else horiz

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