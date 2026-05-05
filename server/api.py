"""Read and write endpoints for the poems API.

All resource access is by UUID ``id``. The API never uses, accepts, or
emits slugs. ``id`` is the only identifier shared with the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import Field, ValidationError

from server.types import (
    Author,
    Award,
    HealthResponse,
    Poem,
    PoemCreate,
    PoemPatch,
    PoemSummaryData,
    PoemSummaryDataList,
)

from server.repository import (
    DuplicateIdError,
    ImmutableFieldError,
    InvalidDatabaseError,
    PoemNotFoundError,
    PoemRepository,
    _body_to_plaintext,
    get_repository,
)
from server.config import (
    AUTHOR,
    MOOD_FEATURES,
    POETIC_FORM_FEATURES,
    TECHNIQUE_FEATURES,
    THEME_FEATURES,
    TONE_VOICE_FEATURES,
)
from server.similarity.service import rebuild_similarity_service

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


# -------------------------------------------------------------------- helpers

def _ordered(poems: List[Poem]) -> List[Poem]:
    """Authoritative ordering: date descending, id ascending."""
    return sorted(
        poems,
        key=lambda p: (-p.date.timestamp(), str(p.id)),
    )


def _matches(
    p: Poem,
    q: Optional[str],
    themes: List[str],
    moods: List[str],
    poetic_forms: List[str],
    techniques: List[str],
    tones_voices: List[str],
    contest_fit: List[str],
    min_rating: Optional[int],
    max_rating: Optional[int],
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
            " ".join(p.moods),
            " ".join(p.poetic_forms),
            " ".join(p.techniques),
            " ".join(p.tones_voices),
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
    if not _all_in(moods, p.moods):
        return False
    if not _all_in(poetic_forms, p.poetic_forms):
        return False
    if not _all_in(techniques, p.techniques):
        return False
    if not _all_in(tones_voices, p.tones_voices):
        return False
    if not _all_in(contest_fit, p.contest_fit):
        return False
    if min_rating is not None and p.rating < min_rating:
        return False
    if max_rating is not None and p.rating > max_rating:
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


@router.get("/api/author", tags=["meta"])
def get_author() -> dict[str, str]:
    """Site author identity (pen name and full name)."""
    return AUTHOR.model_dump()


_FEATURE_GROUPS: dict[str, list[str]] = {
    "themes": THEME_FEATURES,
    "moods": MOOD_FEATURES,
    "poetic_forms": POETIC_FORM_FEATURES,
    "techniques": TECHNIQUE_FEATURES,
    "tones_voices": TONE_VOICE_FEATURES,
}


@router.get("/api/features/{group}", response_model=List[str], tags=["meta"])
def get_features(group: str) -> List[str]:
    """Controlled vocabulary for a tag group.

    ``group`` must be one of: ``themes``, ``moods``, ``poetic_forms``,
    ``techniques``, ``tones_voices``.
    """
    features = _FEATURE_GROUPS.get(group)
    if features is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown group '{group}'. Allowed: {sorted(_FEATURE_GROUPS)}",
        )
    return features


@router.get("/api/poems", response_model=PoemSummaryDataList, tags=["poems"])
def list_poems(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    q: Optional[str] = Query(
        None,
        description="Full-text search across title, body, project, tags, and notes. Case-insensitive substring match.",
    ),
    themes: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied themes (AND). Repeatable.",
    ),
    moods: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied moods tags (AND). Repeatable.",
    ),
    poetic_forms: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied poetic_forms tags (AND). Repeatable.",
    ),
    techniques: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied techniques tags (AND). Repeatable.",
    ),
    tones_voices: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied tones_voices tags (AND). Repeatable.",
    ),
    contest_fit: List[str] = Query(
        default_factory=list,
        description="Require ALL supplied contest_fit tags (AND). Repeatable.",
    ),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    date_from: Optional[datetime] = Query(
        None, description="Inclusive lower bound on poem date (ISO 8601)."
    ),
    date_to: Optional[datetime] = Query(
        None, description="Inclusive upper bound on poem date (ISO 8601)."
    ),
) -> PoemSummaryDataList:
    """Filtered list of poem summaries in authoritative order.

    **Ordering.** ``date`` descending, with ``id`` ascending as a
    deterministic tiebreaker.

    **Search semantics.** ``q`` is a case-insensitive substring match
    over title, a plain-text projection of the body (``<br/>`` stripped),
    ``project``, and all tag arrays and note bodies. The array filters
    (``themes`` etc.) are **AND across groups and AND within a group**:
    every supplied value must be present on the poem. Numeric/boolean
    filters apply conjunctively. All filters combine with ``q``.
    """
    poems = _ordered(repo.list())
    filtered = [
        p
        for p in poems
        if _matches(
            p,
            q,
            themes,
            moods,
            poetic_forms,
            techniques,
            tones_voices,
            contest_fit,
            min_rating,
            max_rating,
            date_from,
            date_to,
        )
    ]
    return PoemSummaryDataList(items=filtered)


@router.get("/api/poems/search", response_model=PoemSummaryDataList, tags=["poems"])
def advanced_search(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    q: Optional[str] = Query(
        None,
        description="Full-text pre-filter across title, body, project, tags, and notes. Case-insensitive substring match.",
    ),
    title: Optional[str] = Query(
        None, description="Case-insensitive substring of title."
    ),
    body: Optional[str] = Query(
        None, description="Case-insensitive substring of body (plain-text projection)."
    ),
    project: Optional[str] = Query(
        None, description="Case-insensitive substring of project statement."
    ),
    themes: List[str] = Query(
        default_factory=list, description="Require ALL supplied themes (AND). Pre-filter before OR matching."
    ),
    moods: List[str] = Query(default_factory=list),
    poetic_forms: List[str] = Query(default_factory=list),
    techniques: List[str] = Query(default_factory=list),
    tones_voices: List[str] = Query(default_factory=list),
    key_images: List[str] = Query(default_factory=list),
    contest_fit: List[str] = Query(default_factory=list),
    notes: Optional[str] = Query(
        None, description="Case-insensitive substring over note bodies."
    ),
    year: Optional[int] = Query(
        None, ge=1, le=9999, description="Match poems whose date year equals this."
    ),
    month: Optional[int] = Query(
        None, ge=1, le=12, description="Match poems whose date month equals this."
    ),
    min_rating: Optional[int] = Query(None, ge=0, le=100),
    max_rating: Optional[int] = Query(None, ge=0, le=100),
    medals: List[str] = Query(
        default_factory=list,
        description="Medal tier to match. Any of: Gold, Silver, Bronze, Honorable Mention, None. 'None' matches poems with no awards.",
    ),
) -> PoemSummaryDataList:
    """Advanced field-specific search with optional free-text narrowing.

    If ``q`` is supplied it is applied first as a full-text pre-filter.

    Matching rules:

    - **themes**: AND — every supplied theme must be present. Applied as
      a pre-filter before OR matching. If no other fields are populated,
      only theme-matching poems are returned.
    - **Text fields** (``title``, ``body``, ``project``, ``notes``):
      OR across fields; case-insensitive substring match.
    - **Other tag fields** (``moods``, ``poetic_forms``, ``techniques``,
      ``tones_voices``, ``key_images``, ``contest_fit``): OR across
      fields; case-insensitive exact match on list entries.
    - **Date** (``year``, ``month``): AND with each other — both must
      match when both are supplied. Counts as one OR condition against
      other fields.
    - **Rating** (``min_rating``, ``max_rating``): AND with each other;
      one OR condition against other fields.
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
        "moods": moods,
        "poetic_forms": poetic_forms,
        "techniques": techniques,
        "tones_voices": tones_voices,
        "key_images": key_images,
        "contest_fit": contest_fit,
    }
    date_populated = year is not None or month is not None
    rating_populated = min_rating is not None or max_rating is not None
    or_populated = (
        any(v for v in text_queries.values())
        or any(v for v in tag_queries.values())
        or date_populated
        or rating_populated
        or bool(medals)
    )
    if not themes and not or_populated:
        return PoemSummaryDataList(items=[])

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
        if date_populated:
            year_ok = year is None or p.date.year == year
            month_ok = month is None or p.date.month == month
            if year_ok and month_ok:
                return True
        if rating_populated:
            lo = min_rating if min_rating is not None else 0
            hi = max_rating if max_rating is not None else 100
            if lo <= p.rating <= hi:
                return True
        if medals and any(a in _poem_medals(p) for a in medals):
            return True
        return False

    # themes: AND pre-filter — every supplied theme must be present
    narrowed = [
        p
        for p in _ordered(repo.list())
        if _matches(p, q, themes, [], [], [], [], [], None, None, None, None)
    ]
    if not or_populated:
        return PoemSummaryDataList(items=narrowed)
    filtered = [p for p in narrowed if match(p)]
    return PoemSummaryDataList(items=filtered)


@router.get("/api/poems/recent", response_model=PoemSummaryDataList, tags=["poems"])
def recent_poems(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
    k: int = Query(8, ge=1, le=100, description="Number of poems to return."),
) -> PoemSummaryDataList:
    """k most recent poems ordered by date descending, with no pin-first bias."""
    poems = sorted(repo.list(), key=lambda p: (-p.date.timestamp(), str(p.id)))
    return PoemSummaryDataList(items=poems[:k])


@router.get("/api/poems/awards", response_model=PoemSummaryDataList, tags=["poems"])
def poems_with_awards(
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
) -> PoemSummaryDataList:
    """Return all poems that have one or more awards."""
    poems = _ordered(repo.list())
    awarded = [p for p in poems if p.awards and len(p.awards) > 0]
    return PoemSummaryDataList(items=awarded)


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
    No-op PATCH (empty body) returns the current record unchanged.
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
