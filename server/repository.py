"""In-memory poem repository backed by a JSON file.

Lifecycle
---------
- Poems are loaded **once at application startup** via
  :meth:`PoemRepository.load`. After that, the in-memory list is the
  working copy of truth for the running process.
- Every mutation (``add`` / ``update`` / ``delete``) writes the full
  collection back to disk before returning, so the on-disk file is
  always consistent with the last successful mutation.
- The file is never re-read while the process runs. External edits to
  ``Poems.json`` are **not** picked up until restart — this is a
  deliberate choice to keep the concurrency model simple and to avoid
  clobbering in-flight edits.

Persistence safety
------------------
- Writes are atomic: the new contents are written to a sibling temp
  file and then ``os.replace``-d into place. A crash mid-write leaves
  the previous file intact.
- A single ``threading.RLock`` serialises reads and writes, so
  FastAPI's threadpool (used for sync endpoints) and any background
  tasks see a consistent view.

Concurrency assumptions
-----------------------
- **Single writer process.** The repository is safe for many threads
  inside one process but does not guard against two processes editing
  the same file (no file locking). Deploy with a single worker, or
  add an external lock before scaling out.
- **No partial updates across requests.** Each mutation is
  self-contained and either fully persists or raises.

Derived vs persisted fields
---------------------------
Persisted source fields are whatever the JSON Schema / Pydantic model
declare. ``lines`` and ``words`` are treated as **derived** — they
live in the file for convenience, but the repository recomputes them
from ``body`` on every write so they cannot drift from the text.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional
from uuid import UUID

import sys

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "database" / "schemas"
if str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))

from poem import Poem  # noqa: E402  (path-extended import)


class RepositoryError(RuntimeError):
    """Base class for repository errors."""


class InvalidDatabaseError(RepositoryError):
    """The JSON file is missing, malformed, or fails validation."""


class DuplicateIdError(RepositoryError):
    """Two or more poems share the same ``id``."""


class PoemNotFoundError(RepositoryError):
    """No poem with the requested ``id`` exists."""


class ImmutableFieldError(RepositoryError):
    """Attempt to mutate an immutable field (currently only ``id``)."""


_BR_RE = re.compile(r"<br\s*/?>\n?", re.IGNORECASE)


def _body_to_plaintext(body: str) -> str:
    """Plain-text projection of an HTML-fragment body.

    Used for search indexing, derived ``lines`` / ``words``, and the
    frontend render/edit surface. The regex consumes a single trailing
    ``\\n`` after each ``<br/>`` (if present) so storage artefacts like
    ``<br/>\\n`` collapse to one newline, while genuine paragraph
    breaks — ``<br/>\\n<br/>\\n`` — collapse to two (a blank line).
    Authored leading whitespace (indentation) is preserved verbatim.
    """
    return unescape(_BR_RE.sub("\n", body))


def derive_counts(body: str) -> tuple[int, int]:
    text = _body_to_plaintext(body)
    lines = [ln for ln in text.split("\n") if ln.strip()]
    words = sum(len(ln.split()) for ln in lines)
    return len(lines), words


class PoemRepository:
    """Thread-safe, file-backed collection of poems."""

    def __init__(self, path: Path):
        self._path: Path = Path(path)
        self._lock = threading.RLock()
        self._poems: Dict[UUID, Poem] = {}
        self._order: List[UUID] = []  # preserves source-file order
        self._loaded = False

    # ---------------------------------------------------------------- load

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> None:
        """Read, validate, and index the JSON file. Idempotent."""
        with self._lock:
            if not self._path.exists():
                raise InvalidDatabaseError(f"Poems file not found: {self._path}")
            try:
                raw = json.loads(self._path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                raise InvalidDatabaseError(
                    f"Poems file is not valid JSON ({self._path}): {e}"
                ) from e
            if not isinstance(raw, list):
                raise InvalidDatabaseError(
                    f"Poems file must contain a JSON array, got {type(raw).__name__}"
                )

            poems: Dict[UUID, Poem] = {}
            order: List[UUID] = []
            for i, record in enumerate(raw):
                try:
                    poem = Poem.model_validate(record)
                except Exception as e:  # pydantic.ValidationError
                    title = (
                        record.get("title", "<no title>")
                        if isinstance(record, dict)
                        else "<non-object>"
                    )
                    raise InvalidDatabaseError(
                        f"Poem #{i} ({title!r}) failed validation: {e}"
                    ) from e
                if poem.id in poems:
                    raise DuplicateIdError(
                        f"Duplicate id {poem.id} in {self._path} "
                        f"(poems #{order.index(poem.id)} and #{i})"
                    )
                poems[poem.id] = poem
                order.append(poem.id)

            self._poems = poems
            self._order = order
            self._loaded = True

    # ---------------------------------------------------------------- read

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            raise RepositoryError("Repository has not been loaded; call load() first.")

    def list(self) -> List[Poem]:
        with self._lock:
            self._ensure_loaded()
            return [self._poems[i] for i in self._order]

    def get(self, poem_id: UUID) -> Poem:
        with self._lock:
            self._ensure_loaded()
            try:
                return self._poems[poem_id]
            except KeyError:
                raise PoemNotFoundError(str(poem_id)) from None

    # --------------------------------------------------------------- write

    def has(self, poem_id: UUID) -> bool:
        with self._lock:
            return poem_id in self._poems

    def add(self, poem: Poem) -> Poem:
        with self._lock:
            self._ensure_loaded()
            if poem.id in self._poems:
                raise DuplicateIdError(str(poem.id))
            normalised = self._with_derived(poem)
            next_poems = dict(self._poems)
            next_order = list(self._order)
            next_poems[normalised.id] = normalised
            next_order.append(normalised.id)
            self._commit(next_poems, next_order)
            return normalised

    def update(self, poem_id: UUID, updates: dict) -> Poem:
        """Replace a poem with a modified copy. ``id`` cannot change."""
        with self._lock:
            self._ensure_loaded()
            existing = self.get(poem_id)
            if "id" in updates and UUID(str(updates["id"])) != poem_id:
                raise ImmutableFieldError("id is immutable")
            merged = existing.model_dump(mode="json") | updates
            merged["id"] = str(poem_id)
            try:
                updated = Poem.model_validate(merged)
            except Exception as e:
                raise InvalidDatabaseError(f"Update failed validation: {e}") from e
            updated = self._with_derived(updated)
            next_poems = dict(self._poems)
            next_poems[poem_id] = updated
            self._commit(next_poems, list(self._order))
            return updated

    def delete(self, poem_id: UUID) -> None:
        with self._lock:
            self._ensure_loaded()
            if poem_id not in self._poems:
                raise PoemNotFoundError(str(poem_id))
            next_poems = dict(self._poems)
            next_order = list(self._order)
            del next_poems[poem_id]
            next_order.remove(poem_id)
            self._commit(next_poems, next_order)

    # ------------------------------------------------------------- helpers

    @staticmethod
    def _with_derived(poem: Poem) -> Poem:
        lines, words = derive_counts(poem.body)
        if poem.lines == lines and poem.words == words:
            return poem
        return poem.model_copy(update={"lines": lines, "words": words})

    def _commit(self, next_poems: Dict[UUID, Poem], next_order: List[UUID]) -> None:
        """Persist the proposed next state, then swap it into memory.

        The order matters: disk is written first. Only on a fully
        successful atomic write do we replace ``self._poems`` /
        ``self._order``. If the write raises, in-memory state is
        untouched, preserving the invariant that memory matches disk.
        """
        self._persist(next_poems, next_order)
        self._poems = next_poems
        self._order = next_order

    def _persist(self, poems: Dict[UUID, Poem], order: List[UUID]) -> None:
        """Atomically write the given collection to disk."""
        payload = [
            poems[i].model_dump(mode="json", exclude_none=False) for i in order
        ]
        serialised = json.dumps(payload, indent=4, ensure_ascii=False)

        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(
            prefix=self._path.name + ".", suffix=".tmp", dir=str(self._path.parent)
        )
        tmp_path = Path(tmp_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(serialised)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self._path)
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise


# ------------------------------------------------------------- app wiring


_repository: Optional[PoemRepository] = None


def get_repository() -> PoemRepository:
    """FastAPI dependency: returns the process-wide repository."""
    if _repository is None:
        raise RepositoryError("Repository is not initialised.")
    return _repository


def init_repository(path: Path) -> PoemRepository:
    """Create, load, and register the global repository. Called at startup."""
    global _repository
    repo = PoemRepository(path)
    repo.load()
    _repository = repo
    return repo


def reset_repository() -> None:
    """Test helper: drop the global repository."""
    global _repository
    _repository = None
