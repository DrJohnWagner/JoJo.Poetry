"""Read and write endpoints for the poems API.

All resource access is by UUID ``id``. The API never uses, accepts, or
emits slugs. ``id`` is the only identifier shared with the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from database.schemas.poem import Author, Award, Poem

from server.repository import (
    DuplicateIdError,
    ImmutableFieldError,
    InvalidDatabaseError,
    PoemNotFoundError,
    PoemRepository,
    _body_to_plaintext,
    get_repository,
)
from server.clustering.engine import run_clustering
from server.clustering.types import (
    VALID_CATEGORIES,
    ClusterRequest,
    ClusterResponse,
)
from server.similarity.service import rebuild_similarity_service
from server.similarity.types import NeighbourListResult


# ------------------------------------------------------------------ constants

MEDAL_VOCAB = ("Gold", "Silver", "Bronze", "Honorable Mention", "None")


# ---------------------------------------------------------------- dependencies

def require_write_access(request: Request) -> None:
    """Dependency that rejects all mutations when READ_ONLY=true."""
    if request.app.state.settings.read_only:
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="This instance is read-only.",
        )


def check_for_external_changes(
    repo: PoemRepository = Depends(get_repository),
) -> None:
    """Dependency attached to all GET endpoints.

    Reloads the database file if its mtime has changed since the last
    load or write, then rebuilds the similarity index. One ``os.stat``
    syscall per request; the reload itself only happens when the file
    actually changed.
    """
    if repo.maybe_reload():
        rebuild_similarity_service(repo.list())


# --------------------------------------------------------------- response models

class HealthResponse(BaseModel):
    """Reports whether the process is up and the repository is usable."""
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "degraded"]
    poems_loaded: int
    source: str


class Pagination(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int = Field(description="Total matching items before pagination.")
    offset: int
    limit: int
    has_more: bool


class PoemList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[Poem]
    pagination: Pagination


class RecentList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[Poem]


# --------------------------------------------------------------- request models

class PoemCreate(BaseModel):
    """Create-payload for POST /api/poems.

    Required: ``title``, ``url``, ``body``, ``project``, ``rating``.

    Optional (defaults applied server-side):

    - ``date`` — defaults to the current UTC time (second precision).
    - ``awards`` / ``themes`` / ``emotional_register`` /
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
    awards: List[Award] = Field(default_factory=list)
    themes: List[str] = Field(default_factory=list)
    emotional_register: List[str] = Field(default_factory=list)
    form_and_craft: List[str] = Field(default_factory=list)
    key_images: List[str] = Field(default_factory=list)
    contest_fit: List[str] = Field(default_factory=list)
    pinned: bool = False
    socials: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)
    author: Optional[Author] = None


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
    awards: Optional[List[Award]] = None
    date: Optional[datetime] = None
    themes: Optional[List[str]] = None
    emotional_register: Optional[List[str]] = None
    form_and_craft: Optional[List[str]] = None
    key_images: Optional[List[str]] = None
    project: Optional[str] = None
    contest_fit: Optional[List[str]] = None
    rating: Optional[int] = Field(None, ge=0, le=100)
    pinned: Optional[bool] = None
    socials: Optional[List[str]] = None
    notes: Optional[List[str]] = None
    author: Optional[Author] = None


# -------------------------------------------------------------------- helpers

def _ordered(poems: List[Poem]) -> List[Poem]:
    """Authoritative ordering: pinned first, date descending, id ascending."""
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


def _text_hit(needle: str, haystack: str) -> bool:
    return needle.casefold() in haystack.casefold()


def _tag_any(needles: List[str], tags: List[str]) -> bool:
    if not needles:
        return False
    tags_cf = {t.casefold() for t in tags}
    return any(n.casefold() in tags_cf for n in needles)


def _poem_medals(p: Poem) -> List[str]:
    """Medals present on the poem, with 'None' sentinel if no awards."""
    if not p.awards:
        return ["None"]
    return [c.medal for c in p.awards]


# --------------------------------------------------------------------- router

router = APIRouter()


# ------------------------------------------------------------------ endpoints

@router.get("/health", response_model=HealthResponse, tags=["meta"])
def health(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
) -> HealthResponse:
    """Liveness + data-layer readiness."""
    return HealthResponse(
        status="ok", poems_loaded=len(repo.list()), source=str(repo.path)
    )


@router.get("/api/poems", response_model=PoemList, tags=["poems"])
def list_poems(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    q: Optional[str] = Query(None, description="Full-text search across title, body, project, tags, and notes. Case-insensitive substring match."),
    themes: List[str] = Query(default_factory=list, description="Require ALL supplied themes (AND). Repeatable."),
    emotional_register: List[str] = Query(default_factory=list, description="Require ALL supplied emotional_register tags (AND). Repeatable."),
    form_and_craft: List[str] = Query(default_factory=list, description="Require ALL supplied form_and_craft tags (AND). Repeatable."),
    contest_fit: List[str] = Query(default_factory=list, description="Require ALL supplied contest_fit tags (AND). Repeatable."),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    pinned: Optional[bool] = Query(None, description="Filter to only pinned (true) or only unpinned (false)."),
    date_from: Optional[datetime] = Query(None, description="Inclusive lower bound on poem date (ISO 8601)."),
    date_to: Optional[datetime] = Query(None, description="Inclusive upper bound on poem date (ISO 8601)."),
    offset: int = Query(0, ge=0),
    limit: int = Query(3, ge=1, le=200, description="Page size. Default 3 matches the incremental-load UX."),
) -> PoemList:
    """Paginated, filtered list of poem summaries in authoritative order.

    **Ordering.** Pinned poems first, then ``date`` descending, with
    ``id`` ascending as a deterministic tiebreaker.

    **Shape.** Returns full :class:`Poem` records.

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
        items=list(window),
        pagination=Pagination(
            total=total,
            offset=offset,
            limit=limit,
            has_more=(offset + len(window)) < total,
        ),
    )


@router.get("/api/poems/search", response_model=PoemList, tags=["poems"])
def advanced_search(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    q: Optional[str] = Query(None, description="Full-text pre-filter across title, body, project, tags, and notes. Case-insensitive substring match."),
    title: Optional[str] = Query(None, description="Case-insensitive substring of title."),
    body: Optional[str] = Query(None, description="Case-insensitive substring of body (plain-text projection)."),
    project: Optional[str] = Query(None, description="Case-insensitive substring of project statement."),
    themes: List[str] = Query(default_factory=list, description="Any of these themes (OR within field)."),
    emotional_register: List[str] = Query(default_factory=list),
    form_and_craft: List[str] = Query(default_factory=list),
    key_images: List[str] = Query(default_factory=list),
    contest_fit: List[str] = Query(default_factory=list),
    notes: Optional[str] = Query(None, description="Case-insensitive substring over note bodies."),
    year: Optional[int] = Query(None, ge=1, le=9999, description="Match poems whose date year equals this."),
    month: Optional[int] = Query(None, ge=1, le=12, description="Match poems whose date month equals this."),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    medals: List[str] = Query(
        default_factory=list,
        description="Medal tier to match. Any of: Gold, Silver, Bronze, Honorable Mention, None. 'None' matches poems with no awards.",
    ),
    offset: int = Query(0, ge=0),
    limit: int = Query(3, ge=1, le=200, description="Page size. Default 3 matches the incremental-load UX."),
) -> PoemList:
    """Advanced field-specific search with optional free-text narrowing.

    If ``q`` is supplied it is applied first using the same semantics as
    ``GET /api/poems``. The advanced portion uses **OR semantics across
    populated fields**: a poem matches if it satisfies at least one
    populated field. If no field is populated the result is empty.

    Matching rules:

    - **Text fields** (``title``, ``body``, ``project``, ``notes``):
      case-insensitive substring on a plain-text projection.
    - **Tag fields** (``themes``, ``emotional_register``,
      ``form_and_craft``, ``key_images``, ``contest_fit``): OR within
      the field; case-insensitive exact match on list entries.
    - **Numeric / date filters** (``year``, ``month``, ``min_rating``,
      ``max_rating``): each treated as one populated field.
      ``min_rating`` + ``max_rating`` together count as one field.
    - **Awards**: OR across supplied values; ``"None"`` matches poems
      with an empty ``awards`` array.
    """
    bad = [a for a in medals if a not in MEDAL_VOCAB]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown medals: {bad}. Allowed: {list(MEDAL_VOCAB)}",
        )

    text_queries = {"title": title, "project": project, "body": body, "notes": notes}
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
        or bool(medals)
    )
    if not any_populated:
        return PoemList(
            items=[],
            pagination=Pagination(total=0, offset=offset, limit=limit, has_more=False),
        )

    def match(p: Poem) -> bool:
        if title and _text_hit(title, p.title):
            return True
        if project and _text_hit(project, p.project):
            return True
        if body and _text_hit(body, _body_to_plaintext(p.body)):
            return True
        if notes and _text_hit(notes, "\n".join(p.notes)):
            return True
        for field, needles in tag_queries.items():
            if _tag_any(needles, getattr(p, field)):
                return True
        if year is not None and p.date.year == year:
            return True
        if month is not None and p.date.month == month:
            return True
        if rating_populated:
            lo = min_rating if min_rating is not None else 0
            hi = max_rating if max_rating is not None else 100
            if lo <= p.rating <= hi:
                return True
        if medals and any(a in _poem_medals(p) for a in medals):
            return True
        return False

    narrowed = [
        p for p in _ordered(repo.list())
        if _matches(p, q, [], [], [], [], None, None, None, None, None)
    ]
    filtered = [p for p in narrowed if match(p)]
    total = len(filtered)
    window = filtered[offset : offset + limit]
    return PoemList(
        items=list(window),
        pagination=Pagination(
            total=total,
            offset=offset,
            limit=limit,
            has_more=(offset + len(window)) < total,
        ),
    )


@router.get("/api/poems/recent", response_model=RecentList, tags=["poems"])
def recent_poems(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    k: int = Query(8, ge=1, le=100, description="Number of poems to return."),
) -> RecentList:
    """k most recent poems ordered by date descending, with no pin-first bias."""
    poems = sorted(repo.list(), key=lambda p: (-p.date.timestamp(), str(p.id)))
    return RecentList(items=poems[:k])


@router.post("/api/poems/cluster", response_model=ClusterResponse, tags=["poems"])
def cluster_poems(
    payload: ClusterRequest,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
) -> ClusterResponse:
    """Cluster the corpus by one or more metadata categories.

    Categories must be drawn from: ``themes``, ``emotional_register``,
    ``form_and_craft``, ``images`` (maps to ``key_images``), ``contest_fit``.

    If ``k`` is omitted the number of clusters is chosen automatically via
    silhouette-score sweep. Poems in clusters smaller than
    ``min_cluster_size`` are returned in ``excluded`` with reason
    ``"cluster too small"``.
    """
    bad = [c for c in payload.categories if c not in VALID_CATEGORIES]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown categories: {bad}. Allowed: {sorted(VALID_CATEGORIES)}",
        )
    return run_clustering(repo.list(), payload)


@router.get("/api/poems/{poem_id}", response_model=Poem, tags=["poems"])
def get_poem(
    poem_id: UUID,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
) -> Poem:
    """Full poem record. 404 for unknown id, 422 for malformed UUID."""
    try:
        return repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None


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
    """Create a new poem. Server assigns UUID, derives lines/words from body."""
    new_id: UUID = uuid4()
    while repo.has(new_id):
        new_id = uuid4()

    record = payload.model_dump(mode="json")
    record["id"] = str(new_id)
    if record.get("date") is None:
        record["date"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    record["lines"] = 0
    record["words"] = 0

    try:
        poem = Poem.model_validate(record)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Validation failed: {e}") from None

    try:
        res = repo.add(poem)
        rebuild_similarity_service(repo.list())
        return res
    except DuplicateIdError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None
    except InvalidDatabaseError as e:
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.patch("/api/poems/{poem_id}", response_model=Poem, tags=["poems"])
def patch_poem(
    poem_id: UUID,
    patch: PoemPatch,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(require_write_access),
) -> Poem:
    """Partial update. Returns the full updated record.

    No-op PATCH (empty body) returns the current record unchanged.
    Pin/unpin toggles use this endpoint with ``{"pinned": true|false}``.
    """
    updates = patch.model_dump(exclude_unset=True, mode="json")
    if not updates:
        try:
            return repo.get(poem_id)
        except PoemNotFoundError:
            raise HTTPException(status_code=404, detail="Poem not found") from None
    try:
        res = repo.update(poem_id, updates)
        rebuild_similarity_service(repo.list())
        return res
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
    """Hard delete. Returns 204 on success, 404 if the id does not exist."""
    try:
        repo.delete(poem_id)
        rebuild_similarity_service(repo.list())
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None


# --------------------------------------------------------- similarity endpoints

class SimilarityBundle(BaseModel):
    """All similarity dimensions in a single response."""
    overall: NeighbourListResult
    theme: NeighbourListResult
    form: NeighbourListResult
    emotion: NeighbourListResult
    imagery: NeighbourListResult


@router.get("/api/poems/{poem_id}/similar", response_model=SimilarityBundle, tags=["similarity"])
def get_similar_bundle(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k_overall: int = Query(5, ge=1, le=50),
    k_theme: int = Query(3, ge=1, le=50),
    k_form: int = Query(3, ge=1, le=50),
    k_emotion: int = Query(3, ge=1, le=50),
    k_imagery: int = Query(3, ge=1, le=50),
) -> SimilarityBundle:
    """All similarity dimensions in one call, with per-category k values."""
    from server.similarity.service import get_similarity_service
    svc = get_similarity_service()
    results = {
        "overall": svc.get_overall_similar(poem_id, k_overall),
        "theme":   svc.get_theme_similar(poem_id, k_theme),
        "form":    svc.get_form_similar(poem_id, k_form),
        "emotion": svc.get_emotion_similar(poem_id, k_emotion),
        "imagery": svc.get_imagery_similar(poem_id, k_imagery),
    }
    if any(v is None for v in results.values()):
        raise HTTPException(status_code=404, detail="Poem not found")
    return SimilarityBundle(**results)


@router.get("/api/poems/{poem_id}/similar/overall", response_model=NeighbourListResult, tags=["similarity"])
def get_similar_overall(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Overall similarity across all dimensions."""
    from server.similarity.service import get_similarity_service
    res = get_similarity_service().get_overall_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/theme", response_model=NeighbourListResult, tags=["similarity"])
def get_similar_theme(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by theme tags."""
    from server.similarity.service import get_similarity_service
    res = get_similarity_service().get_theme_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/form", response_model=NeighbourListResult, tags=["similarity"])
def get_similar_form(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by form and craft."""
    from server.similarity.service import get_similarity_service
    res = get_similarity_service().get_form_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/emotion", response_model=NeighbourListResult, tags=["similarity"])
def get_similar_emotion(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by emotional register."""
    from server.similarity.service import get_similarity_service
    res = get_similarity_service().get_emotion_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/imagery", response_model=NeighbourListResult, tags=["similarity"])
def get_similar_imagery(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by key imagery."""
    from server.similarity.service import get_similarity_service
    res = get_similarity_service().get_imagery_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res
