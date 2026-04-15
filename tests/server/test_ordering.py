"""Tests for authoritative ordering and pagination."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL = REPO_ROOT / "database" / "Poems.json"


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


def _ids(resp):
    return [i["id"] for i in resp.json()["items"]]


# ------------------------------------------------------------ authoritative order

def test_default_order_is_date_desc(client):
    items = client.get("/api/poems?limit=200").json()["items"]
    dates = [datetime.fromisoformat(i["date"].replace("Z", "+00:00")) for i in items]
    assert dates == sorted(dates, reverse=True)
    # None are pinned by default, so the whole list is date-desc.
    assert all(i["pinned"] is False for i in items)


def test_pinned_appears_before_unpinned_and_date_order_is_preserved(client):
    # Pin the two *oldest* poems and confirm they float to the top in date-desc order.
    from server.repository import get_repository
    repo = get_repository()
    dated = sorted(repo.list(), key=lambda p: p.date)  # oldest first
    oldest, second_oldest = dated[0], dated[1]
    repo.update(oldest.id, {"pinned": True})
    repo.update(second_oldest.id, {"pinned": True})

    items = client.get("/api/poems?limit=200").json()["items"]
    # First two are pinned
    assert items[0]["pinned"] is True and items[1]["pinned"] is True
    # Pinned group is ordered date-desc: second_oldest (newer of the two) comes first.
    assert items[0]["id"] == str(second_oldest.id)
    assert items[1]["id"] == str(oldest.id)
    # Unpinned group follows, also date-desc.
    unpinned_dates = [
        datetime.fromisoformat(i["date"].replace("Z", "+00:00"))
        for i in items[2:]
    ]
    assert unpinned_dates == sorted(unpinned_dates, reverse=True)


def test_tiebreaker_is_id_ascending(client, db):
    # Force two poems to share the exact same date; tiebreaker should pick by id asc.
    data = json.loads(db.read_text())
    shared_date = "2026-05-01T12:00:00Z"
    data[0]["date"] = shared_date
    data[1]["date"] = shared_date
    db.write_text(json.dumps(data))
    # Reload
    from server.repository import get_repository
    get_repository().load()

    items = client.get("/api/poems?limit=200").json()["items"]
    # Find the two with the shared date and verify their relative order is id ascending.
    clashing = [i for i in items if i["date"].startswith("2026-05-01")]
    assert len(clashing) == 2
    assert clashing[0]["id"] < clashing[1]["id"]


def test_search_uses_same_ranking(client):
    # Advanced search + simple search should produce identical date-desc ordering
    # over the same result set.
    a = _ids(client.get("/api/poems?limit=200"))
    b = _ids(client.get("/api/poems/search?year=2026&limit=200"))
    assert a == b


# --------------------------------------------------------------- pagination

def test_initial_load_returns_three(client):
    body = client.get("/api/poems").json()
    assert len(body["items"]) == 3
    assert body["pagination"] == {"total": 5, "offset": 0, "limit": 3, "has_more": True}


def test_incremental_load_returns_next_three_without_gaps_or_dupes(client):
    page1 = client.get("/api/poems?offset=0&limit=3").json()
    page2 = client.get("/api/poems?offset=3&limit=3").json()
    ids1 = [i["id"] for i in page1["items"]]
    ids2 = [i["id"] for i in page2["items"]]
    assert len(ids1) == 3 and len(ids2) == 2
    # No duplicates
    assert set(ids1).isdisjoint(ids2)
    # Full-collection ordering
    full = _ids(client.get("/api/poems?limit=200"))
    assert ids1 + ids2 == full
    assert page2["pagination"]["has_more"] is False


def test_pagination_resets_implicitly_when_search_changes(client):
    # The API is stateless; "reset" means the client must issue a fresh offset=0.
    # We verify that changing filters produces a new total and the first page is
    # the start of the new ordering.
    base = client.get("/api/poems?offset=0&limit=3").json()
    filt = client.get("/api/poems?q=cancer&offset=0&limit=3").json()
    assert base["pagination"]["total"] == 5
    assert filt["pagination"]["total"] == 2
    # First page of the filtered set is the global-order prefix of the filtered set.
    full_filtered = _ids(client.get("/api/poems?q=cancer&limit=200"))
    assert [i["id"] for i in filt["items"]] == full_filtered[:3]


def test_past_the_end_offset_yields_empty_and_no_more(client):
    r = client.get("/api/poems?offset=100&limit=3").json()
    assert r["items"] == []
    assert r["pagination"]["has_more"] is False


# --------------------------------------------------------- ordering after mutations

def test_pin_moves_poem_to_top_after_patch(client):
    all_ids = _ids(client.get("/api/poems?limit=200"))
    target = all_ids[-1]  # last in authoritative order
    client.patch(f"/api/poems/{target}", json={"pinned": True})
    assert _ids(client.get("/api/poems?limit=200"))[0] == target


def test_edit_to_date_reorders(client):
    all_ids = _ids(client.get("/api/poems?limit=200"))
    target = all_ids[-1]
    client.patch(
        f"/api/poems/{target}",
        json={"date": "2099-01-01T00:00:00Z"},
    )
    assert _ids(client.get("/api/poems?limit=200"))[0] == target


def test_delete_shrinks_total_and_preserves_order(client):
    before = _ids(client.get("/api/poems?limit=200"))
    victim = before[2]
    client.delete(f"/api/poems/{victim}")
    after = _ids(client.get("/api/poems?limit=200"))
    assert victim not in after
    assert after == [i for i in before if i != victim]
