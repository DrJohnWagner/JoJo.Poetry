from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import UUID

import jinja2
import typst
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from server.config import AUTHOR
from server.repository import PoemNotFoundError, PoemRepository, get_repository

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

TEMPLATE = jinja2.Template((Path(__file__).parent / "poem.typ").read_text())


@router.get("/{poem_id}")
def get_pdf(
    poem_id: UUID,
    repo: PoemRepository = Depends(get_repository),
) -> Response:
    try:
        poem = repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poem not found")

    document = TEMPLATE.render(
        paper="a4",
        margin="1.5cm",
        font="IBM Plex Sans",
        font_size="13pt",
        colour="#333333",
        columns=2,
        gutter="1.2cm",
        title=poem.title,
        author=AUTHOR.pen_name,
        body=poem.body,
    )

    with tempfile.TemporaryDirectory() as tmp:
        typ_file = Path(tmp) / "poem.typ"
        typ_file.write_text(document)
        try:
            pdf_bytes = typst.compile(str(typ_file))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{poem.title}.pdf"'},
    )
