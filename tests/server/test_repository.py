"""Tests for configuration + repository wiring.

Run from the repo root:

    uv run pytest tests
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from server.config import DEFAULT_POEMS_DATABASE, Settings, get_settings
from server.repository import (
    DuplicateIdError,
    ImmutableFieldError,
    InvalidDatabaseError,
    PoemNotFoundError,
    PoemRepository,
    derive_counts,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL = REPO_ROOT / "database" / "Poems.json"


@pytest.fixture
def poems_file(tmp_path: Path) -> Path:
    dst = tmp_path / "Poems.json"
    shutil.copy(CANONICAL, dst)
    return dst


# ------------------------------------------------------------------ config


def test_default_points_at_repo_database(monkeypatch):
    monkeypatch.delenv("POEMS_DATABASE", raising=False)
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.poems_database_path == DEFAULT_POEMS_DATABASE.resolve()


def test_env_var_overrides_default(monkeypatch, tmp_path):
    target = tmp_path / "x.json"
    monkeypatch.setenv("POEMS_DATABASE", str(target))
    s = get_settings()
    assert s.poems_database_path == target.resolve()


def test_relative_path_resolves_against_cwd(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("POEMS_DATABASE", "sub/poems.json")
    s = get_settings()
    assert s.poems_database_path == (tmp_path / "sub" / "poems.json").resolve()


# -------------------------------------------------------------- repository


def test_loads_and_validates_canonical_file(poems_file):
    repo = PoemRepository(poems_file)
    repo.load()
    poems = repo.list()
    assert len(poems) == 5
    assert len({p.id for p in poems}) == 5
    for p in poems:
        assert p.id.version == 4
        # optional-field defaults applied
        assert p.pinned is False
        assert p.notes == []


def test_duplicate_id_rejected(tmp_path, poems_file):
    data = json.loads(poems_file.read_text())
    dup = dict(data[0])
    data.append(dup)
    poems_file.write_text(json.dumps(data))
    repo = PoemRepository(poems_file)
    with pytest.raises(DuplicateIdError):
        repo.load()


def test_invalid_uuid_rejected(tmp_path, poems_file):
    data = json.loads(poems_file.read_text())
    data[0]["id"] = "not-a-uuid"
    poems_file.write_text(json.dumps(data))
    repo = PoemRepository(poems_file)
    with pytest.raises(InvalidDatabaseError):
        repo.load()


def test_missing_file_fails_clearly(tmp_path):
    repo = PoemRepository(tmp_path / "nope.json")
    with pytest.raises(InvalidDatabaseError):
        repo.load()


def test_malformed_json_fails_clearly(tmp_path):
    p = tmp_path / "bad.json"
    p.write_text("{ not json ]")
    with pytest.raises(InvalidDatabaseError):
        PoemRepository(p).load()


def test_id_is_immutable_on_update(poems_file):
    repo = PoemRepository(poems_file)
    repo.load()
    target = repo.list()[0]
    with pytest.raises(ImmutableFieldError):
        repo.update(target.id, {"id": str(uuid4())})


def test_update_recomputes_derived_counts(poems_file):
    repo = PoemRepository(poems_file)
    repo.load()
    target = repo.list()[0]
    new_body = "one word<br/>\ntwo words here<br/>"
    updated = repo.update(target.id, {"body": new_body})
    assert (updated.lines, updated.words) == derive_counts(new_body)


def test_add_and_delete_persist_atomically(poems_file):
    repo = PoemRepository(poems_file)
    repo.load()
    before = len(repo.list())

    sample = repo.list()[0].model_copy(update={"id": uuid4()})
    repo.add(sample)

    # On-disk file reflects the addition
    on_disk = json.loads(poems_file.read_text())
    assert len(on_disk) == before + 1

    repo.delete(sample.id)
    on_disk = json.loads(poems_file.read_text())
    assert len(on_disk) == before
    with pytest.raises(PoemNotFoundError):
        repo.get(sample.id)


def test_repository_is_configurable_to_alternative_file(tmp_path):
    alt = tmp_path / "alt.json"
    alt.write_text("[]")
    repo = PoemRepository(alt)
    repo.load()
    assert repo.list() == []
