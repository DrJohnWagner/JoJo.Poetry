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


def test_search_shape_matches_list(client):
    r = client.get("/api/poems/search", params={"title": "Metaphor"})
    assert set(r.json()) == {"items"}
    assert len(r.json()["items"]) >= 1


# -------------------------------------------------------------- OR semantics

def test_themes_and_title_or(client):
    # themes is an AND pre-filter: only poems with biological_process survive narrowing.
    # title="Metaphor" is then OR-matched within that narrowed set.
    # "Not a Metaphor" has "Metaphor" in its title but lacks biological_process → excluded.
    # The bio-process poems have no "Metaphor" in their titles → none pass the OR step.
    r = client.get(
        "/api/poems/search",
        params=[("title", "Metaphor"), ("themes", "biological_process")],
    )
    assert _titles(r) == set()


def test_themes_and_within_field(client):
    # All supplied themes must be present (AND). Only poems with BOTH biological_process
    # AND cancer qualify: Weather Over Brief Structures and Unchecked.
    # Load-Bearing Interior has biological_process but not cancer → excluded.
    r = client.get(
        "/api/poems/search",
        params=[("themes", "biological_process"), ("themes", "cancer")],
    )
    assert _titles(r) == {
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


# ---------------------------------------------------------------- medals

def test_medal_gold(client):
    r = client.get("/api/poems/search", params={"medals": "Gold"})
    # Not a Metaphor + Load-Bearing Interior have Gold
    assert _titles(r) == {"Not a Metaphor", "Load-Bearing Interior"}


def test_medal_none_matches_empty_awards(client):
    r = client.get("/api/poems/search", params={"medals": "None"})
    # Weather / Just Enough Freedom / Unchecked have empty awards
    assert _titles(r) == {
        "Weather Over Brief Structures",
        "Just Enough Freedom",
        "Unchecked",
    }


def test_medal_multiple_is_or(client):
    r = client.get(
        "/api/poems/search",
        params=[("medals", "Gold"), ("medals", "None"), ("limit", 200)],
    )
    assert len(r.json()["items"]) == 5


def test_medal_unknown_rejected(client):
    r = client.get("/api/poems/search", params={"medals": "Platinum"})
    assert r.status_code == 422


# ------------------------------------------------------------- rating band

def test_rating_band_is_single_field(client):
    # min and max together form one populated field; poems with rating in band match
    r = client.get(
        "/api/poems/search", params={"min_rating": 85, "max_rating": 88}
    )
    # Not a Metaphor 87, Unchecked 88, Weather Over Brief Structures 88, Load-Bearing Interior 87
    assert _titles(r) == {
        "Not a Metaphor",
        "Unchecked",
        "Weather Over Brief Structures",
        "Load-Bearing Interior",
    }


def test_q_can_narrow_advanced_search(client):
    r = client.get(
        "/api/poems/search",
        params={"q": "kettle", "year": 2026},
    )
    assert _titles(r) == {"Not a Metaphor"}


def test_q_only_does_not_turn_search_endpoint_into_listing(client):
    r = client.get("/api/poems/search", params={"q": "kettle"})
    assert r.status_code == 200
    assert r.json()["items"] == []
