"""Typst → PNG compilation and social caption formatting for the PDF pipeline."""
from __future__ import annotations

import tempfile
from datetime import date
from pathlib import Path

import typst

from server.fonts.router import FONTS_DIR
from server.social.pipeline import ADULT_HASHTAG, HASHTAGS

PPI = 150


def png_from_source(source: str) -> bytes:
    """Compile Typst source to PNG at PPI=150; returns the first page only."""
    with tempfile.TemporaryDirectory() as tmp:
        typ_file = Path(tmp) / "poem.typ"
        typ_file.write_text(source)
        out_pattern = str(Path(tmp) / "p-{p}.png")
        typst.compile(str(typ_file), output=out_pattern, font_paths=[str(FONTS_DIR)], format="png", ppi=PPI)
        pages = sorted(Path(tmp).glob("p-*.png"))
        if not pages:
            raise RuntimeError("typst produced no PNG output")
        return pages[0].read_bytes()


def pdf_caption(title: str, poem_url: str, is_adult: bool) -> str:
    """Build the social caption for a PDF post: title, URL, copyright, hashtags."""
    tags = f"{HASHTAGS} {ADULT_HASHTAG}" if is_adult else HASHTAGS
    today = date.today()
    return f"{title}\n\n{poem_url}\n\nCopyright © {today.strftime('%-d %B %Y')} by John Wagner\n\n{tags}"
