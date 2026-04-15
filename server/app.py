"""FastAPI application factory.

The app loads the poems database **once at startup** via the lifespan
hook. Endpoints (added in later steps) will use ``get_repository`` as a
dependency to access the in-memory collection.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.config import Settings, get_settings
from server.repository import (
    PoemRepository,
    get_repository,
    init_repository,
    reset_repository,
)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    db_path: Path = settings.poems_database_path

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        repo: PoemRepository = init_repository(db_path)
        app.state.settings = settings
        app.state.repository = repo
        try:
            yield
        finally:
            reset_repository()

    app = FastAPI(title="JoJo.Poetry", lifespan=lifespan)

    origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins if o.strip()],
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    from server.api import router as read_router
    app.include_router(read_router)

    return app


app = create_app()
