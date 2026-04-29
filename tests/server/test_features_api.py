from __future__ import annotations

"""Tests for GET /api/features/{group}."""

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import (
    MOOD_FEATURES,
    POETIC_FORM_FEATURES,
    TECHNIQUE_FEATURES,
    THEME_FEATURES,
    TONE_VOICE_FEATURES,
    Settings,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL = REPO_ROOT / "database" / "Poems.json"

VALID_GROUPS = {
    "themes": THEME_FEATURES,
    "moods": MOOD_FEATURES,
    "poetic_forms": POETIC_FORM_FEATURES,
    "techniques": TECHNIQUE_FEATURES,
    "tones_voices": TONE_VOICE_FEATURES,
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    dst = tmp_path / "Poems.json"
    shutil.copy(CANONICAL, dst)
    monkeypatch.setenv("POEMS_DATABASE", str(dst))
    app = create_app(Settings())
    with TestClient(app) as c:
        yield c


# ------------------------------------------------------------------ shape


@pytest.mark.parametrize("group", VALID_GROUPS)
def test_returns_200(client, group):
    r = client.get(f"/api/features/{group}")
    assert r.status_code == 200


@pytest.mark.parametrize("group", VALID_GROUPS)
def test_returns_list_of_strings(client, group):
    body = client.get(f"/api/features/{group}").json()
    assert isinstance(body, list)
    assert all(isinstance(v, str) for v in body)


@pytest.mark.parametrize("group", VALID_GROUPS)
def test_non_empty(client, group):
    body = client.get(f"/api/features/{group}").json()
    assert len(body) > 0


# ------------------------------------------------------------------ content


@pytest.mark.parametrize("group,expected", VALID_GROUPS.items())
def test_matches_config_constant(client, group, expected):
    body = client.get(f"/api/features/{group}").json()
    assert body == expected


def test_themes_no_duplicates(client):
    body = client.get("/api/features/themes").json()
    assert len(body) == len(set(body))


@pytest.mark.parametrize("group", VALID_GROUPS)
def test_no_empty_strings(client, group):
    body = client.get(f"/api/features/{group}").json()
    assert all(v.strip() != "" for v in body)


def test_themes_is_sorted(client):
    body = client.get("/api/features/themes").json()
    assert body == sorted(body)


# ------------------------------------------------------------------ error cases


def test_unknown_group_returns_404(client):
    r = client.get("/api/features/unknown_group")
    assert r.status_code == 404


def test_unknown_group_detail_names_allowed(client):
    r = client.get("/api/features/bogus")
    detail = r.json()["detail"]
    for group in VALID_GROUPS:
        assert group in detail


def test_missing_group_segment_not_matched(client):
    # /api/features with no segment should not match the {group} route
    r = client.get("/api/features/")
    assert r.status_code in {404, 307}


@pytest.mark.parametrize("bad", ["Themes", "MOODS", "Poetic_Forms"])
def test_group_name_is_case_sensitive(client, bad):
    r = client.get(f"/api/features/{bad}")
    assert r.status_code == 404
