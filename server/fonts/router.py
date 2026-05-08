from __future__ import annotations

import re
from functools import cache
from pathlib import Path

from fontTools.ttLib import TTFont
from fastapi import APIRouter, status

router = APIRouter(prefix="/api/fonts", tags=["fonts"])

FONTS_DIR = Path(__file__).parent.parent / "fonts"

SPLIT_RE = re.compile(
    r"(?<=[a-z])(?=[A-Z])"
    r"|(?<=[A-Z])(?=[A-Z][a-z])"
    r"|(?<=[a-zA-Z])(?=[0-9])"
)


def font_label(stem: str) -> str:
    family_raw, _, style_raw = stem.partition("-")
    family = " ".join(
        word
        for segment in family_raw.replace("_", " ").split()
        for word in SPLIT_RE.split(segment)
    )
    style = " ".join(SPLIT_RE.split(style_raw)) if style_raw else ""
    return f"{family} {style}".strip()


def read_family(path: Path) -> str:
    names = {
        r.nameID: r.toUnicode()
        for r in TTFont(str(path), lazy=True)["name"].names
        if r.platformID == 3
    }
    return names.get(16) or names.get(1) or path.parent.name.replace("_", " ")


@cache
def list_fonts() -> list[dict]:
    entries = []
    for ttf in sorted(FONTS_DIR.rglob("*.ttf")):
        rel = ttf.relative_to(FONTS_DIR).with_suffix("").as_posix()
        entries.append({
            "filename": rel,
            "label": font_label(ttf.stem),
            "family": read_family(ttf),
        })
    return entries


@router.get("", status_code=status.HTTP_200_OK)
def get_fonts() -> list[dict]:
    return list_fonts()
