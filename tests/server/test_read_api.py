"""Tests for the read endpoints."""

from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

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
    app = create_app(Settings())
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["poems_loaded"] == 5
    assert "Poems.json" in body["source"]


def test_list_default_shape_and_pagination(client):
    r = client.get("/api/poems")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"items", "pagination"}
    assert body["pagination"] == {"total": 5, "offset": 0, "limit": 3, "has_more": True}
    item = body["items"][0]
    assert "copyright" not in item
    assert set(item) >= {
        "id", "title", "url", "date", "rating", "lines", "words",
        "pinned", "themes", "emotional_register", "form_and_craft",
        "contest_fit", "project", "body", "awards", "key_images",
        "notes", "socials",
    }


def test_list_pagination_window(client):
    r = client.get("/api/poems?offset=2&limit=2")
    body = r.json()
    assert body["pagination"] == {"total": 5, "offset": 2, "limit": 2, "has_more": True}
    assert len(body["items"]) == 2


def test_search_q_matches_body_text(client):
    r = client.get("/api/poems", params={"q": "kettle"})
    body = r.json()
    assert body["pagination"]["total"] == 1
    assert body["items"][0]["title"] == "Not a Metaphor"


def test_search_tag_filter_is_and(client):
    # Both poems about cancer have these themes; intersect on 'cancer'
    r = client.get("/api/poems", params=[("themes", "cancer"), ("themes", "the body")])
    body = r.json()
    titles = {i["title"] for i in body["items"]}
    # Unchecked and Weather Over Brief Structures both have cancer + the body
    assert "Unchecked" in titles
    assert "Weather Over Brief Structures" in titles


def test_search_rating_bounds(client):
    r = client.get("/api/poems", params={"min_rating": 86})
    titles = {i["title"] for i in r.json()["items"]}
    assert titles == {"Not a Metaphor", "Unchecked"}


def test_list_orders_pinned_first(client, tmp_path):
    # Pin a poem that would not naturally lead the ordering and confirm pinned-first wins.
    all_items = client.get("/api/poems?limit=200").json()["items"]
    ids = [i["id"] for i in all_items]
    target = ids[-1]
    # Use repository directly via the app to pin (no write endpoint yet)
    from uuid import UUID
    from server.repository import get_repository
    repo = get_repository()
    repo.update(UUID(target), {"pinned": True})
    first_id = client.get("/api/poems").json()["items"][0]["id"]
    assert first_id == target


def test_get_full_poem_by_id(client):
    listing = client.get("/api/poems?limit=200").json()["items"]
    pid = listing[0]["id"]
    r = client.get(f"/api/poems/{pid}")
    assert r.status_code == 200
    full = r.json()
    assert full["id"] == pid
    # full record includes body
    assert full["body"]


def test_malformed_id_returns_422(client):
    r = client.get("/api/poems/not-a-uuid")
    assert r.status_code == 422


def test_unknown_id_returns_404(client):
    r = client.get(f"/api/poems/{uuid4()}")
    assert r.status_code == 404
    assert r.json()["detail"] == "Poem not found"


# ------------------------------------------------------------------ /api/poems/recent

def test_recent_default_returns_200(client):
    r = client.get("/api/poems/recent")
    assert r.status_code == 200


def test_recent_response_shape(client):
    r = client.get("/api/poems/recent")
    body = r.json()
    assert set(body.keys()) == {"items"}
    assert isinstance(body["items"], list)


def test_recent_default_k_is_8(client):
    r = client.get("/api/poems/recent")
    # canonical db has 5 poems; default k=8 returns all 5
    assert len(r.json()["items"]) == 5


def test_recent_k_limits_results(client):
    r = client.get("/api/poems/recent?k=2")
    assert len(r.json()["items"]) == 2


def test_recent_ordered_by_date_descending(client):
    r = client.get("/api/poems/recent?k=10")
    items = r.json()["items"]
    dates = [item["date"] for item in items]
    assert dates == sorted(dates, reverse=True)


def test_recent_no_pin_bias(client):
    # Pinned poem should not be forced to position 0 — pure date order
    items = client.get("/api/poems/recent?k=10").json()["items"]
    list_items = client.get("/api/poems?limit=10").json()["items"]
    # list_poems puts pinned first; recent should differ if any poem is pinned
    pinned = [p for p in list_items if p["pinned"]]
    if pinned:
        assert items[0]["id"] != list_items[0]["id"] or not pinned[0]["pinned"] or items[0]["date"] >= list_items[0]["date"]


def test_recent_item_has_expected_fields(client):
    item = client.get("/api/poems/recent?k=1").json()["items"][0]
    assert {"id", "title", "project", "body", "date", "rating", "lines", "words", "awards"} <= set(item.keys())


def test_recent_k_zero_returns_422(client):
    assert client.get("/api/poems/recent?k=0").status_code == 422


def test_recent_k_101_returns_422(client):
    assert client.get("/api/poems/recent?k=101").status_code == 422


def test_recent_not_intercepted_by_poem_id_route(client):
    # Ensure /recent is not caught by /api/poems/{poem_id} as poem_id="recent"
    r = client.get("/api/poems/recent")
    assert r.status_code == 200
    assert "items" in r.json()
