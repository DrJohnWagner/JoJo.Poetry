"""Read endpoints for the poems API.

All resource access is by UUID ``id``. The API never uses, accepts, or
emits slugs. ``id`` is the only identifier shared with the frontend.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

import sys
from pathlib import Path as _Path
_SCHEMAS_DIR = _Path(__file__).resolve().parent.parent / "database" / "schemas"
if str(_SCHEMAS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCHEMAS_DIR))
from poem import Poem  # noqa: E402

from server.repository import (
    ImmutableFieldError,
    InvalidDatabaseError,
    PoemNotFoundError,
    PoemRepository,
    _body_to_plaintext,
    get_repository,
)
from server.config import get_settings

# Re-export Contest locally for the patch model.
from poem import Contest  # noqa: E402


# ---------------------------------------------------------------- read-only guard

def require_write_access() -> None:
    """Dependency that rejects all mutations when READ_ONLY=true."""
    if get_settings().read_only:
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="This instance is read-only.",
        )


# ---------------------------------------------------------------- response models

class HealthResponse(BaseModel):
    """Reports whether the process is up and the repository is usable.

    ``status`` is ``"ok"`` when the repository has loaded successfully;
    any deeper check (disk, external services) would be added here.
    """
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "degraded"]
    poems_loaded: int
    source: str


class PoemSummary(BaseModel):
    """List-view projection of a poem.

    Intentionally omits the large ``body`` and the note arrays, so list
    payloads stay compact and cache-friendly. Clients fetch the full
    record via ``GET /api/poems/{id}`` when needed.
    """
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    url: str
    date: datetime
    rating: int
    lines: int
    words: int
    pinned: bool
    themes: List[str]
    emotional_register: List[str]
    form_and_craft: List[str]
    contest_fit: List[str]
    has_contests: bool
    project: str


class Pagination(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int = Field(description="Total matching items before pagination.")
    offset: int
    limit: int
    has_more: bool


class PoemList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[PoemSummary]
    pagination: Pagination


# ---------------------------------------------------------------- helpers

def _summary(p: Poem) -> PoemSummary:
    return PoemSummary(
        id=p.id,
        title=p.title,
        url=str(p.url),
        date=p.date,
        rating=p.rating,
        lines=p.lines,
        words=p.words,
        pinned=p.pinned,
        themes=list(p.themes),
        emotional_register=list(p.emotional_register),
        form_and_craft=list(p.form_and_craft),
        contest_fit=list(p.contest_fit),
        has_contests=len(p.contests) > 0,
        project=p.project,
    )


def _ordered(poems: List[Poem]) -> List[Poem]:
    """Authoritative ordering.

    Primary key:   pinned poems first.
    Secondary key: ``date`` descending (most recent first).
    Tiebreaker:    ``id`` ascending (UUID string compare) — deterministic
                   and stable, so the same inputs always produce the
                   same order across processes and restarts.
    """
    return sorted(
        poems,
        key=lambda p: (0 if p.pinned else 1, -p.date.timestamp(), str(p.id)),
    )


def _matches(
    p: Poem,
    q: Optional[str],
    themes: List[str],
    emotional_register: List[str],
    form_and_craft: List[str],
    contest_fit: List[str],
    min_rating: Optional[int],
    max_rating: Optional[int],
    pinned: Optional[bool],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
) -> bool:
    if q:
        needle = q.casefold()
        haystack_parts = [
            p.title,
            _body_to_plaintext(p.body),
            p.project,
            " ".join(p.themes),
            " ".join(p.emotional_register),
            " ".join(p.form_and_craft),
            " ".join(p.key_images),
            " ".join(p.contest_fit),
            " ".join(p.notes),
        ]
        if needle not in " \n".join(haystack_parts).casefold():
            return False

    def _all_in(required: List[str], present: List[str]) -> bool:
        if not required:
            return True
        present_cf = {x.casefold() for x in present}
        return all(r.casefold() in present_cf for r in required)

    if not _all_in(themes, p.themes):
        return False
    if not _all_in(emotional_register, p.emotional_register):
        return False
    if not _all_in(form_and_craft, p.form_and_craft):
        return False
    if not _all_in(contest_fit, p.contest_fit):
        return False

    if min_rating is not None and p.rating < min_rating:
        return False
    if max_rating is not None and p.rating > max_rating:
        return False
    if pinned is not None and p.pinned is not pinned:
        return False
    if date_from is not None and p.date < date_from:
        return False
    if date_to is not None and p.date > date_to:
        return False
    return True


# ---------------------------------------------------------------- router

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["meta"])
def health(repo: PoemRepository = Depends(get_repository)) -> HealthResponse:
    """Liveness + data-layer readiness.

    Returns ``status=ok`` once the FastAPI lifespan has loaded the
    repository from disk. The count and source path let operators
    confirm the process is pointed at the intended dataset.
    """
    return HealthResponse(
        status="ok", poems_loaded=len(repo.list()), source=str(repo.path)
    )


@router.get("/api/poems", response_model=PoemList, tags=["poems"])
def list_poems(
    repo: PoemRepository = Depends(get_repository),
    q: Optional[str] = Query(None, description="Full-text search across title, body, project, tags, and notes. Case-insensitive substring match."),
    themes: List[str] = Query(default_factory=list, description="Require ALL supplied themes (AND). Repeatable."),
    emotional_register: List[str] = Query(default_factory=list, description="Require ALL supplied emotional_register tags (AND). Repeatable."),
    form_and_craft: List[str] = Query(default_factory=list, description="Require ALL supplied form_and_craft tags (AND). Repeatable."),
    contest_fit: List[str] = Query(default_factory=list, description="Require ALL supplied contest_fit tags (AND). Repeatable."),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    pinned: Optional[bool] = Query(None, description="If set, filter to only pinned (true) or only unpinned (false)."),
    date_from: Optional[datetime] = Query(None, description="Inclusive lower bound on poem date (ISO 8601)."),
    date_to: Optional[datetime] = Query(None, description="Inclusive upper bound on poem date (ISO 8601)."),
    offset: int = Query(0, ge=0),
    limit: int = Query(3, ge=1, le=200, description="Page size. Default 3 matches the incremental-load UX."),
) -> PoemList:
    """Paginated, filtered list of poem summaries in authoritative order.

    **Ordering.** Pinned poems first, then ``date`` descending, with
    ``id`` ascending as a deterministic tiebreaker.

    **Shape.** Returns :class:`PoemSummary` records — not full poems —
    so list payloads stay small. Fetch the full record via
    :func:`get_poem`.

    **Search semantics.** ``q`` is a case-insensitive substring match
    over title, a plain-text projection of the body (``<br/>`` stripped),
    ``project``, and all tag arrays and note bodies. The array filters
    (``themes`` etc.) are **AND across groups and AND within a group**:
    every supplied value must be present on the poem. Numeric/boolean
    filters apply conjunctively. All filters combine with ``q``.
    """
    poems = _ordered(repo.list())
    filtered = [
        p for p in poems
        if _matches(
            p, q, themes, emotional_register, form_and_craft, contest_fit,
            min_rating, max_rating, pinned, date_from, date_to,
        )
    ]
    total = len(filtered)
    window = filtered[offset : offset + limit]
    return PoemList(
        items=[_summary(p) for p in window],
        pagination=Pagination(
            total=total,
            offset=offset,
            limit=limit,
            has_more=(offset + len(window)) < total,
        ),
    )


class PoemCreate(BaseModel):
    """Create-payload for POST /api/poems.

    Required: ``title``, ``url``, ``body``, ``project``, ``rating``.

    Optional (defaults applied server-side):

    - ``date`` — defaults to the current UTC time (second precision).
    - ``contests`` / ``themes`` / ``emotional_register`` /
      ``form_and_craft`` / ``key_images`` / ``contest_fit`` — default
      to ``[]``.
    - ``pinned`` — defaults to ``False``.
    - ``notes`` — defaults to ``[]``.

    Forbidden on input (the server supplies them):

    - ``id`` — always generated as a fresh UUID v4.
    - ``lines`` / ``words`` — derived from ``body``.

    ``extra="forbid"`` ensures unknown fields — including any attempt
    to smuggle in ``id``/``lines``/``words`` — are rejected with 422.
    """

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    url: str
    body: str = Field(min_length=1)
    project: str
    rating: int = Field(ge=0, le=100)

    date: Optional[datetime] = None
    contests: List[Contest] = Field(default_factory=list)
    themes: List[str] = Field(default_factory=list)
    emotional_register: List[str] = Field(default_factory=list)
    form_and_craft: List[str] = Field(default_factory=list)
    key_images: List[str] = Field(default_factory=list)
    contest_fit: List[str] = Field(default_factory=list)
    pinned: bool = False
    notes: List[str] = Field(default_factory=list)


class PoemPatch(BaseModel):
    """Partial-update payload for PATCH /api/poems/{id}.

    Semantics:

    - Only fields present in the request body are applied.
    - Array fields are **replaced wholesale** (not merged). Sending
      ``{"themes": []}`` clears them; omitting ``themes`` leaves them.
    - Required fields cannot be nulled.
    - Derived fields (``lines``, ``words``) are ignored if supplied and
      recomputed by the server from ``body``.
    - ``id`` is immutable and rejected.
    """
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1)
    url: Optional[str] = None
    body: Optional[str] = Field(None, min_length=1)
    contests: Optional[List[Contest]] = None
    date: Optional[datetime] = None
    themes: Optional[List[str]] = None
    emotional_register: Optional[List[str]] = None
    form_and_craft: Optional[List[str]] = None
    key_images: Optional[List[str]] = None
    project: Optional[str] = None
    contest_fit: Optional[List[str]] = None
    rating: Optional[int] = Field(None, ge=0, le=100)
    pinned: Optional[bool] = None
    notes: Optional[List[str]] = None


AWARD_VOCAB = ("Gold", "Silver", "Bronze", "Honorable Mention", "None")


def _text_hit(needle: str, haystack: str) -> bool:
    return needle.casefold() in haystack.casefold()


def _tag_any(needles: List[str], tags: List[str]) -> bool:
    if not needles:
        return False
    tags_cf = {t.casefold() for t in tags}
    return any(n.casefold() in tags_cf for n in needles)


def _poem_awards(p: Poem) -> List[str]:
    """Awards present on the poem, with 'None' sentinel if no contests."""
    if not p.contests:
        return ["None"]
    return [c.award for c in p.contests]


@router.get("/api/poems/search", response_model=PoemList, tags=["poems"])
def advanced_search(
    repo: PoemRepository = Depends(get_repository),
    q: Optional[str] = Query(None, description="Full-text pre-filter across title, body, project, tags, and notes. Case-insensitive substring match."),
    title: Optional[str] = Query(None, description="Case-insensitive substring of title."),
    body: Optional[str] = Query(None, description="Case-insensitive substring of body (plain-text projection)."),
    project: Optional[str] = Query(None, description="Case-insensitive substring of project statement."),
    themes: List[str] = Query(default_factory=list, description="Any of these themes (OR within field)."),
    emotional_register: List[str] = Query(default_factory=list),
    form_and_craft: List[str] = Query(default_factory=list),
    key_images: List[str] = Query(default_factory=list),
    contest_fit: List[str] = Query(default_factory=list),
    notes: Optional[str] = Query(None, description="Case-insensitive substring over public notes bodies."),
    year: Optional[int] = Query(None, ge=1, le=9999, description="Match poems whose date year equals this."),
    month: Optional[int] = Query(None, ge=1, le=12, description="Match poems whose date month equals this."),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    awards: List[str] = Query(
        default_factory=list,
        description="Contest awards to match. Any of: Gold, Silver, Bronze, Honorable Mention, None. 'None' matches poems with no contests.",
    ),
    offset: int = Query(0, ge=0),
    limit: int = Query(3, ge=1, le=200, description="Page size. Default 3 matches the incremental-load UX."),
) -> PoemList:
    """Advanced field-specific search with optional free-text narrowing.

    If ``q`` is supplied, it is applied first using the same semantics
    as ``GET /api/poems``: case-insensitive substring across title,
    body plaintext, project, tag arrays, and note bodies. The advanced
    field-specific search is then evaluated over that narrowed set.

    The advanced portion uses **OR semantics across populated fields**.

    A field is considered *populated* when the caller supplied a
    non-empty value for it. A poem matches if it satisfies **at least
    one** populated field. Unpopulated fields are ignored (they do not
    exclude anything and do not require a match).

    If **no** field is populated, the result set is empty — use
    ``GET /api/poems`` to browse the full collection.

    Matching rules:

    - **Text fields** (``title``, ``body``, ``project``, ``notes``): case-insensitive substring on a
      normalised projection (HTML ``<br/>`` collapsed to newlines,
      entities unescaped). For note arrays, the projection is the
      concatenation of ``.body`` across entries.
    - **Tag fields** (``themes``, ``emotional_register``,
      ``form_and_craft``, ``key_images``, ``contest_fit``): OR within
      the field — any supplied value matching any poem value counts.
      Case-insensitive exact string match on list entries.
    - **Numeric / date filters** (``year``, ``month``, ``min_rating``,
      ``max_rating``): each treated as one populated field. ``min_rating``
      and ``max_rating`` together count as **one** field (a rating band).
    - **Awards** (``awards``): OR across supplied values. The sentinel
      ``"None"`` matches poems whose ``contests`` array is empty. Any
      other value is compared case-sensitively against ``contest.award``
      strings. Selecting multiple awards (e.g. ``Gold`` + ``None``)
      returns poems that match either.

    Ordering and pagination follow the same rules as
    ``GET /api/poems``: pinned first, then date descending (``id``
    ascending as tiebreaker); ``offset`` / ``limit`` apply after
    matching.
    """
    # Validate award vocabulary up-front.
    bad = [a for a in awards if a not in AWARD_VOCAB]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown awards: {bad}. Allowed: {list(AWARD_VOCAB)}",
        )

    text_queries = {
        "title": title,
        "project": project,
        "body": body,
        "notes": notes,
    }
    tag_queries = {
        "themes": themes,
        "emotional_register": emotional_register,
        "form_and_craft": form_and_craft,
        "key_images": key_images,
        "contest_fit": contest_fit,
    }
    rating_populated = min_rating is not None or max_rating is not None
    any_populated = (
        any(v for v in text_queries.values())
        or any(v for v in tag_queries.values())
        or year is not None
        or month is not None
        or rating_populated
        or bool(awards)
    )
    if not any_populated:
        return PoemList(
            items=[],
            pagination=Pagination(total=0, offset=offset, limit=limit, has_more=False),
        )

    def match(p: Poem) -> bool:
        # Text
        if title and _text_hit(title, p.title):
            return True
        if project and _text_hit(project, p.project):
            return True
        if body and _text_hit(body, _body_to_plaintext(p.body)):
            return True
        if notes and _text_hit(notes, "\n".join(p.notes)):
            return True
        # Tags
        for field, needles in tag_queries.items():
            if _tag_any(needles, getattr(p, field)):
                return True
        # Date parts
        if year is not None and p.date.year == year:
            return True
        if month is not None and p.date.month == month:
            return True
        # Rating band (single populated field)
        if rating_populated:
            lo = min_rating if min_rating is not None else 0
            hi = max_rating if max_rating is not None else 100
            if lo <= p.rating <= hi:
                return True
        # Awards
        if awards:
            poem_awards = _poem_awards(p)
            if any(a in poem_awards for a in awards):
                return True
        return False

    narrowed = [
        p for p in _ordered(repo.list())
        if _matches(
            p,
            q,
            [],
            [],
            [],
            [],
            None,
            None,
            None,
            None,
            None,
        )
    ]
    filtered = [p for p in narrowed if match(p)]
    total = len(filtered)
    window = filtered[offset : offset + limit]
    return PoemList(
        items=[_summary(p) for p in window],
        pagination=Pagination(
            total=total,
            offset=offset,
            limit=limit,
            has_more=(offset + len(window)) < total,
        ),
    )


@router.post(
    "/api/poems",
    response_model=Poem,
    status_code=status.HTTP_201_CREATED,
    tags=["poems"],
)
def create_poem(
    payload: PoemCreate,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(require_write_access),
) -> Poem:
    """Create a new poem.

    - The server assigns a fresh UUID v4 ``id``.
    - ``lines`` / ``words`` are derived from ``body`` by the repository.
    - Optional fields are defaulted before the full ``Poem`` is
      constructed, so the persisted record passes the **same**
      validation used everywhere else.
    - Returns ``201`` with the full persisted poem record. Clients
      can navigate straight to ``/poems/{id}`` using the response.
    """
    from uuid import UUID, uuid4
    from datetime import datetime as _dt, timezone as _tz

    # Assign a unique id. uuid4() collision is astronomically unlikely
    # but we still check, for safety.
    new_id: UUID = uuid4()
    while repo.has(new_id):
        new_id = uuid4()

    record = payload.model_dump(mode="json")
    record["id"] = str(new_id)
    if record.get("date") is None:
        record["date"] = _dt.now(_tz.utc).replace(microsecond=0).isoformat()
    # lines/words are derived; placeholders here, repository recomputes.
    record["lines"] = 0
    record["words"] = 0

    try:
        poem = Poem.model_validate(record)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Validation failed: {e}") from None

    try:
        return repo.add(poem)
    except Exception as e:  # persistence / uniqueness / etc.
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.get("/api/poems/{poem_id}", response_model=Poem, tags=["poems"])
def get_poem(poem_id: UUID, repo: PoemRepository = Depends(get_repository)) -> Poem:
    """Full poem record.

    - **Malformed id** (not a UUID) → FastAPI responds ``422``
      automatically via the path-parameter parser.
    - **Unknown id** (valid UUID, not in the collection) → ``404``.
    """
    try:
        return repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poem not found") from None


@router.patch("/api/poems/{poem_id}", response_model=Poem, tags=["poems"])
def patch_poem(
    poem_id: UUID,
    patch: PoemPatch,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(require_write_access),
) -> Poem:
    """Partial update of an existing poem.

    Returns the **full updated record** (same shape as
    ``GET /api/poems/{id}``), so the frontend can replace its local
    copy atomically after the server confirms the write. Pin/unpin
    toggles use this endpoint with ``{"pinned": true|false}``.
    """
    updates = patch.model_dump(exclude_unset=True, mode="json")
    if not updates:
        # No-op PATCH returns the current record unchanged.
        try:
            return repo.get(poem_id)
        except PoemNotFoundError:
            raise HTTPException(status_code=404, detail="Poem not found") from None
    try:
        return repo.update(poem_id, updates)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None
    except ImmutableFieldError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except InvalidDatabaseError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


@router.delete(
    "/api/poems/{poem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    response_class=Response,
    tags=["poems"],
)
def delete_poem(
    poem_id: UUID,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(require_write_access),
) -> None:
    """Hard delete. Returns ``204 No Content`` on success, ``404`` if
    the id does not exist. The frontend must treat this as
    confirmed-destructive and only issue it after user confirmation.
    """
    try:
        repo.delete(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None
