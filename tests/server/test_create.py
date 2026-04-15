"""Tests for POST /api/poems."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL = REPO_ROOT / "database" / "Poems.json"

UUID4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


@pytest.fixture
def db(tmp_path):
    dst = tmp_path / "Poems.json"
    shutil.copy(CANONICAL, dst)
    return dst


@pytest.fixture
def client(db, monkeypatch):
    monkeypatch.setenv("POEMS_DATABASE", str(db))
    with TestClient(create_app(Settings())) as c:
        yield c


def _minimal() -> dict:
    return {
        "title": "Testing, One Two",
        "url": "https://example.com/tot",
        "body": "first line<br/>\n    indented second line<br/>\n<br/>\nthird",
        "project": "A sample poem for the test suite.",
        "rating": 50,
    }


# ---------------------------------------------------------- happy path

def test_create_minimal_payload_succeeds(client, db):
    r = client.post("/api/poems", json=_minimal())
    assert r.status_code == 201
    poem = r.json()

    # Server-assigned id, UUID v4
    assert UUID4_RE.match(poem["id"])
    assert UUID(poem["id"]).version == 4

    # Defaults applied
    assert poem["pinned"] is False
    assert poem["authors_notes"] == []
    assert poem["notes"] == []
    assert poem["themes"] == []
    assert poem["contests"] == []
    assert poem["copyright"] == ""

    # Derived fields computed from body
    assert poem["lines"] == 3
    assert poem["words"] == 6

    # Date defaulted on the server
    assert poem["date"]  # non-empty ISO string

    # Persisted to disk
    on_disk = json.loads(db.read_text())
    assert any(p["id"] == poem["id"] for p in on_disk)


def test_created_poem_retrievable_via_get(client):
    pid = client.post("/api/poems", json=_minimal()).json()["id"]
    r = client.get(f"/api/poems/{pid}")
    assert r.status_code == 200
    assert r.json()["id"] == pid


def test_server_generated_ids_are_unique_across_calls(client):
    ids = {client.post("/api/poems", json=_minimal()).json()["id"] for _ in range(5)}
    assert len(ids) == 5


# ---------------------------------------------------------- rejection

def test_client_supplied_id_is_rejected(client):
    payload = {**_minimal(), "id": "11111111-1111-4111-8111-111111111111"}
    r = client.post("/api/poems", json=payload)
    assert r.status_code == 422  # extra=forbid


def test_client_supplied_lines_or_words_is_rejected(client):
    for extra in ({"lines": 99}, {"words": 99}):
        r = client.post("/api/poems", json={**_minimal(), **extra})
        assert r.status_code == 422


@pytest.mark.parametrize("missing", ["title", "url", "body", "project", "rating"])
def test_required_field_missing_rejected(client, missing):
    payload = _minimal()
    del payload[missing]
    r = client.post("/api/poems", json=payload)
    assert r.status_code == 422


def test_rating_out_of_range_rejected(client):
    r = client.post("/api/poems", json={**_minimal(), "rating": 999})
    assert r.status_code == 422


def test_empty_body_rejected(client):
    r = client.post("/api/poems", json={**_minimal(), "body": ""})
    assert r.status_code == 422


def test_unknown_field_rejected(client):
    r = client.post("/api/poems", json={**_minimal(), "slug": "nope"})
    assert r.status_code == 422


# ---------------------------------------------------------- caller-supplied optionals

def test_caller_supplied_date_is_kept(client):
    payload = {**_minimal(), "date": "2030-06-15T10:00:00Z"}
    r = client.post("/api/poems", json=payload)
    assert r.status_code == 201
    assert r.json()["date"].startswith("2030-06-15")


def test_caller_supplied_pinned_is_kept(client):
    r = client.post("/api/poems", json={**_minimal(), "pinned": True})
    assert r.status_code == 201
    assert r.json()["pinned"] is True


# ---------------------------------------------------------- ordering / visibility

def test_new_poem_appears_in_listings_and_search(client):
    # Future-dated so it should lead date-desc order.
    payload = {
        **_minimal(),
        "date": "2099-01-01T00:00:00Z",
        "title": "Tomorrow's Poem",
        "themes": ["futurity"],
    }
    pid = client.post("/api/poems", json=payload).json()["id"]

    # Appears in listing, leading authoritative order (date-desc, unpinned group)
    first = client.get("/api/poems?limit=1").json()["items"][0]
    assert first["id"] == pid

    # Appears in advanced search (year 2099)
    by_year = client.get("/api/poems/search?year=2099").json()["items"]
    assert any(p["id"] == pid for p in by_year)

    # Appears in simple search via q over title
    by_q = client.get("/api/poems?q=Tomorrow").json()["items"]
    assert any(p["id"] == pid for p in by_q)


def test_pinned_new_poem_leads_over_unpinned(client):
    payload = {**_minimal(), "pinned": True, "title": "Pinned Newcomer"}
    pid = client.post("/api/poems", json=payload).json()["id"]
    first = client.get("/api/poems?limit=1").json()["items"][0]
    assert first["id"] == pid


# ---------------------------------------------------------- atomicity

def test_failed_persistence_does_not_leave_orphan_state(client, db, monkeypatch):
    from server.repository import get_repository

    repo = get_repository()
    before_mem = len(repo.list())
    before_disk = len(json.loads(db.read_text()))

    def boom(*a, **kw):
        raise OSError("disk full")

    monkeypatch.setattr(repo, "_persist", boom)
    client2 = type(client)(client.app, raise_server_exceptions=False)
    r = client2.post("/api/poems", json=_minimal())
    assert r.status_code >= 500

    assert len(repo.list()) == before_mem
    assert len(json.loads(db.read_text())) == before_disk


# ---------------------------------------------------------- text fidelity

def test_body_round_trips_with_indentation_preserved(client):
    body = "Line A<br/>\n    indented line B<br/>\n<br/>\n        deeper line C"
    r = client.post("/api/poems", json={**_minimal(), "body": body})
    assert r.status_code == 201
    assert r.json()["body"] == body
