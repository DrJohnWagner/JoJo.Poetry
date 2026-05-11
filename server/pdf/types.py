"""Pydantic types for the PDF generation endpoint."""
from typing import Literal

from pydantic import BaseModel


class PDFAnalyticsImage(BaseModel):
    title: str
    summary: str = ""
    tier: Literal["primary", "secondary"] = "secondary"
    mime_type: str = "image/png"
    data_base64: str


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
    analytics_images: list[PDFAnalyticsImage] = []


class PDFPostResponse(BaseModel):
    socials: list[str]
    errors: list[str]
