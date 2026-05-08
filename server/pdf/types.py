"""Pydantic types for the PDF generation endpoint."""
from pydantic import BaseModel


class PDFRequest(BaseModel):
    # margin/gutter in cm; leading/spacing are Typst paragraph length values
    paper: str = "a4"
    margin: float = 1.5
    font: str = "IBM_Plex_Sans/IBMPlexSans-Regular"
    font_size: float = 13.0
    colour: str = "#333333"
    columns: int = 2
    gutter: float = 1.2
    leading: float = 0.6
    spacing: float = 1.2


class PDFPostResponse(BaseModel):
    socials: list[str]
    errors: list[str]
