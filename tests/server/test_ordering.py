"""Tests for authoritative ordering."""

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
    items = client.get("/api/poems").json()["items"]
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

    items = client.get("/api/poems").json()["items"]
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

    items = client.get("/api/poems").json()["items"]
    # Find the two with the shared date and verify their relative order is id ascending.
    clashing = [i for i in items if i["date"].startswith("2026-05-01")]
    assert len(clashing) == 2
    assert clashing[0]["id"] < clashing[1]["id"]


def test_search_uses_same_ranking(client):
    # Advanced search + simple search should produce identical date-desc ordering
    # over the same result set.
    a = _ids(client.get("/api/poems"))
    b = _ids(client.get("/api/poems/search?year=2026"))
    assert a == b


def test_filter_returns_subset_in_order(client):
    full = _ids(client.get("/api/poems"))
    filtered = _ids(client.get("/api/poems?q=cancer"))
    assert len(filtered) == 2
    # filtered must be a subsequence of full
    full_pos = {id_: i for i, id_ in enumerate(full)}
    assert full_pos[filtered[0]] < full_pos[filtered[1]]


# --------------------------------------------------------- ordering after mutations

def test_pin_moves_poem_to_top_after_patch(client):
    all_ids = _ids(client.get("/api/poems"))
    target = all_ids[-1]  # last in authoritative order
    client.patch(f"/api/poems/{target}", json={"pinned": True})
    assert _ids(client.get("/api/poems"))[0] == target


def test_edit_to_date_reorders(client):
    all_ids = _ids(client.get("/api/poems"))
    target = all_ids[-1]
    client.patch(
        f"/api/poems/{target}",
        json={"date": "2099-01-01T00:00:00Z"},
    )
    assert _ids(client.get("/api/poems"))[0] == target


def test_delete_shrinks_total_and_preserves_order(client):
    before = _ids(client.get("/api/poems"))
    victim = before[2]
    client.delete(f"/api/poems/{victim}")
    after = _ids(client.get("/api/poems"))
    assert victim not in after
    assert after == [i for i in before if i != victim]
