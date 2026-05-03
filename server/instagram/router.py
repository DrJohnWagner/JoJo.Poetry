from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, ConfigDict

from server.api import require_write_access

router = APIRouter(tags=["instagram"])


class InstagramData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID


@router.post(
    "/api/instagram/generate",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def generate(data: InstagramData) -> InstagramData:
    return data


@router.post(
    "/api/instagram/regenerate",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def regenerate(data: InstagramData) -> InstagramData:
    return data


@router.post(
    "/api/instagram/render",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def render(data: InstagramData) -> InstagramData:
    return data


@router.post(
    "/api/instagram/post",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def post(data: InstagramData) -> InstagramData:
    return data
