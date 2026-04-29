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

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POEMS_DATABASE = REPO_ROOT / "database" / "Poems.json"


class Author(BaseModel):
    pen_name: str
    full_name: str


AUTHOR = Author(
    pen_name="JoJo",
    full_name="John Wagner",
)

# Groups and features...

THEMES: dict[str, list[str]] = {
    "love_intimacy": [
        "love",
        "intimacy",
        "desire",
        "seduction",
        "partnership",
        "parenthood",
        "family",
    ],
    "loss_emotional_core": [
        "grief",
        "loss",
        "absence",
        "memory",
        "longing",
        "loneliness",
    ],
    "relationships_breakdown": [
        "infidelity",
        "separation",
        "divorce",
        "power_dynamics",
        "submission",
        "control",
    ],
    "body_biology": ["illness", "cancer", "death", "mortality", "biological_process"],
    "social_political": [
        "war",
        "violence",
        "genocide",
        "politics",
        "injustice",
        "institutional_failure",
        "complicity",
    ],
    "identity_interior": ["trauma", "shame", "identity", "self_deception"],
    "world_context": ["nature", "food", "domestic_life", "community", "technology"],
    "epistemic_abstract": ["language", "silence", "meaning", "time"],
}

THEME_FEATURES: list[str] = sorted(
    {feature for features in THEMES.values() for feature in features}
)

MOOD_FEATURES: list[str] = sorted(
    [
        "clinical",
        "detached",
        "devastating",
        "tender",
        "sensuous",
        "wry",
        "playful",
        "incantatory",
        "ominous",
        "communal",
        "restrained",
        # Split "restrained" into:
        # "meditative",
        # "controlled",
        # and maybe  "withheld
        "defiant",
    ]
)

POETIC_FORM_FEATURES: list[str] = sorted(
    [
        "lyric",
        "narrative_lyric",
        "dramatic_scene",
        "epistolary_poem",
        "dialogic_poem",
        "list_poem",
        "litany",
        "sequence",
        "collage",
        "prose_poem",
        "constraint_based",
        "sonnet_adjacent",
        "ghazal_adjacent",
        "pantoum_adjacent",
        "ars_poetica",
        "elegy",
    ]
)

TECHNIQUE_FEATURES: list[str] = sorted(
    [
        "anaphora",
        "repetition",
        "refrain",
        "parallelism",
        "catalogue",
        "direct_address",
        "apostrophe",
        "rhetorical_questions",
        "imperative_sequence",
        "syntactic_fragmentation",
        "parataxis",
        "heavy_enjambment",
        "end_stopped_lines",
        "short_declarative_lines",
        "long_syntactic_lines",
        "caesural_breaks",
        "indentation_as_structure",
        "patterned_stanzaics",
        "prose_syntax",
        "extended_metaphor",
        "conceit",
        "internal_rhyme",
        "slant_rhyme",
    ]
)

TONE_VOICE_FEATURES: list[str] = sorted(
    [
        "restrained",
        "austere",
        "clinical",
        "detached",
        "intimate",
        "meditative",
        "declarative",
        "incantatory",
        "ceremonial",
        "elliptical",
        "associative",
        "analytic",
        "documentary",
        "surreal",
        "plainspoken",
        "compressed",
        "expansive",
        "fractured",
    ]
)

#
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
    read_only: bool = Field(
        default=True,
        description="When true, all mutation endpoints (POST/PATCH/DELETE) return 405.",
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
