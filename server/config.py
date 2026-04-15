"""Backend configuration.

Resolution order for the poems database path:

1. Explicit constructor argument to `Settings(poems_database=...)`.
2. Environment variable ``POEMS_DATABASE`` (also picked up from a ``.env``
   file in the current working directory, if present).
3. Default: ``<repo_root>/database/Poems.json`` where ``repo_root`` is
   the parent of the ``server/`` package.

Path interpretation:

- Absolute paths are used verbatim.
- Relative paths are resolved **against the current working directory**
  (not the package or the .env file). This matches standard shell/CLI
  expectations: running the server from the repo root makes
  ``database/Poems.json`` resolve as expected.
- The resolved path is exposed as ``Settings.poems_database_path`` as a
  fully-resolved ``pathlib.Path``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POEMS_DATABASE = REPO_ROOT / "database" / "Poems.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    poems_database: Optional[str] = Field(
        default=None,
        description="Path to the poems JSON file. Absolute or relative to CWD.",
    )

    @property
    def poems_database_path(self) -> Path:
        raw = self.poems_database
        if raw is None or raw == "":
            return DEFAULT_POEMS_DATABASE
        p = Path(raw).expanduser()
        return p.resolve() if p.is_absolute() else (Path.cwd() / p).resolve()


def get_settings(**overrides: object) -> Settings:
    """Build a Settings instance, allowing explicit overrides for tests."""
    return Settings(**overrides)  # type: ignore[arg-type]
