"""Tests for advanced search semantics."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL = REPO_ROOT / "database" / "Poems.json"


@pytest.fixture
def client(tmp_path, monkeypatch):
    dst = tmp_path / "Poems.json"
    shutil.copy(CANONICAL, dst)
    monkeypatch.setenv("POEMS_DATABASE", str(dst))
    with TestClient(create_app(Settings())) as c:
        yield c


def _titles(resp):
    return {i["title"] for i in resp.json()["items"]}


# ------------------------------------------------------------- empty + shape

def test_empty_query_returns_empty(client):
    r = client.get("/api/poems/search")
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    assert body["pagination"]["total"] == 0


def test_search_shape_matches_list(client):
    r = client.get("/api/poems/search", params={"title": "Metaphor"})
    assert set(r.json()) == {"items", "pagination"}
    assert r.json()["pagination"]["total"] >= 1


# -------------------------------------------------------------- OR semantics

def test_or_across_populated_fields(client):
    # title match: "Metaphor" -> Not a Metaphor
    # themes match: "COVID lockdown" -> Just Enough Freedom
    # Poem must match EITHER.
    r = client.get(
        "/api/poems/search",
        params=[("title", "Metaphor"), ("themes", "COVID lockdown")],
    )
    assert _titles(r) == {"Not a Metaphor", "Just Enough Freedom"}


def test_tag_within_field_is_or(client):
    r = client.get(
        "/api/poems/search",
        params=[("themes", "COVID lockdown"), ("themes", "cancer")],
    )
    # Just Enough Freedom (COVID) + Unchecked + Weather Over Brief Structures (cancer)
    assert _titles(r) == {
        "Just Enough Freedom",
        "Unchecked",
        "Weather Over Brief Structures",
    }


# ------------------------------------------------------------------ text fields

def test_body_substring_case_insensitive(client):
    r = client.get("/api/poems/search", params={"body": "KETTLE"})
    assert _titles(r) == {"Not a Metaphor"}


def test_body_ignores_br_markup(client):
    # '<br/>' is in every body; searching for it should not return everything
    # because we search the plaintext projection. Use a phrase that only
    # appears without markup.
    r = client.get("/api/poems/search", params={"body": "kettle clicks off"})
    assert _titles(r) == {"Not a Metaphor"}


# --------------------------------------------------------------- year / month

def test_year_filter(client):
    # All five dated 2026
    r = client.get("/api/poems/search", params={"year": 2026, "limit": 200})
    assert len(r.json()["items"]) == 5


def test_month_filter(client):
    # January: Not a Metaphor, Just Enough Freedom (Jan 30 + Jan 09 in UTC)
    r = client.get("/api/poems/search", params={"month": 1})
    assert _titles(r) == {"Not a Metaphor", "Just Enough Freedom"}


# ---------------------------------------------------------------- awards

def test_award_gold(client):
    r = client.get("/api/poems/search", params={"awards": "Gold"})
    # Not a Metaphor + Load-Bearing Interior have Gold
    assert _titles(r) == {"Not a Metaphor", "Load-Bearing Interior"}


def test_award_none_matches_empty_contests(client):
    r = client.get("/api/poems/search", params={"awards": "None"})
    # Weather / Just Enough Freedom / Unchecked have empty contests
    assert _titles(r) == {
        "Weather Over Brief Structures",
        "Just Enough Freedom",
        "Unchecked",
    }


def test_award_multiple_is_or(client):
    r = client.get(
        "/api/poems/search",
        params=[("awards", "Gold"), ("awards", "None"), ("limit", 200)],
    )
    assert len(r.json()["items"]) == 5


def test_award_unknown_rejected(client):
    r = client.get("/api/poems/search", params={"awards": "Platinum"})
    assert r.status_code == 422


# ------------------------------------------------------------- ordering + pagination

def test_pinned_first_in_search(client):
    from uuid import UUID
    from server.repository import get_repository
    # Pin the last-in-source-order poem and confirm it comes first
    source_ids = [i["id"] for i in client.get("/api/poems").json()["items"]]
    get_repository().update(UUID(source_ids[-1]), {"pinned": True})
    r = client.get("/api/poems/search", params={"year": 2026})
    assert r.json()["items"][0]["id"] == source_ids[-1]


def test_pagination_applies_to_search(client):
    r = client.get("/api/poems/search", params={"year": 2026, "limit": 2, "offset": 1})
    p = r.json()["pagination"]
    assert p == {"total": 5, "offset": 1, "limit": 2, "has_more": True}
    assert len(r.json()["items"]) == 2


# ------------------------------------------------------------- rating band

def test_rating_band_is_single_field(client):
    # min and max together form one populated field; poems with rating in band match
    r = client.get(
        "/api/poems/search", params={"min_rating": 85, "max_rating": 88}
    )
    # Not a Metaphor 88, Load-Bearing Interior 85, Unchecked 86
    assert _titles(r) == {"Not a Metaphor", "Load-Bearing Interior", "Unchecked"}


def test_q_can_narrow_advanced_search(client):
    r = client.get(
        "/api/poems/search",
        params={"q": "kettle", "year": 2026, "limit": 200},
    )
    assert _titles(r) == {"Not a Metaphor"}


def test_q_only_does_not_turn_search_endpoint_into_listing(client):
    r = client.get("/api/poems/search", params={"q": "kettle"})
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    assert body["pagination"]["total"] == 0
