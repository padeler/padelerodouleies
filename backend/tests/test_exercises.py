"""Tests for the exercise-bundle validator and loader (M1)."""

import json
from pathlib import Path

import pytest

from app.schemas.exercises import BundleManifest, kid_view
from app.services.exercise_bundles import BundleValidationError, load_bundle

FIXTURES = Path(__file__).parent / "fixtures" / "exercises"


def _load_json(name: str) -> dict:
    return json.loads((FIXTURES / name / "manifest.json").read_text(encoding="utf-8"))


# -- valid bundles ----------------------------------------------------------

def test_loads_multiple_choice_bundle() -> None:
    bundle = load_bundle(FIXTURES / "letters-A-v1")
    assert bundle.id == "letters-A"
    assert bundle.subject == "language"
    assert bundle.exercises[0].type == "multiple_choice"


def test_loads_numeric_entry_bundle() -> None:
    bundle = load_bundle(FIXTURES / "math-times-v1")
    assert bundle.id == "math-times"
    ex = bundle.exercises[0]
    assert ex.type == "numeric_entry"
    assert ex.answer == 10


# -- kid_view strips secrets ------------------------------------------------

def test_kid_view_strips_answer_and_tts() -> None:
    bundle = load_bundle(FIXTURES / "math-times-v1")
    view = kid_view(bundle)
    blob = json.dumps(view, ensure_ascii=False)
    assert "answer" not in blob
    assert "prompt_tts" not in blob
    assert "hint_tts" not in blob
    # display prompt/hint survive
    assert view["exercises"][0]["prompt"] == "2 * 3 + 4 = ?"


def test_kid_view_keeps_option_images_and_text() -> None:
    bundle = load_bundle(FIXTURES / "letters-A-v1")
    view = kid_view(bundle)
    opt = view["exercises"][0]["options"][0]
    assert opt["image"] == "apple.png"
    assert opt["text"] == "μήλο"
    assert "answer" not in view["exercises"][0]


# -- rejection cases --------------------------------------------------------

def test_mixed_script_fixture_rejected() -> None:
    with pytest.raises(BundleValidationError) as exc:
        load_bundle(FIXTURES / "broken-mixed-script-v1")
    assert "mono-script" in exc.value.msg or "mixes" in exc.value.msg


def _validate(data: dict) -> None:
    BundleManifest.model_validate(data)


def test_bad_subject_rejected() -> None:
    data = _load_json("letters-A-v1")
    data["subject"] = "astrophysics"
    with pytest.raises(Exception):
        _validate(data)


def test_answer_not_in_options_rejected() -> None:
    data = _load_json("letters-A-v1")
    data["exercises"][0]["answer"] = "zzz"
    with pytest.raises(Exception):
        _validate(data)


def test_numeric_answer_must_be_int() -> None:
    data = _load_json("math-times-v1")
    data["exercises"][0]["answer"] = 10.5
    with pytest.raises(Exception):
        _validate(data)
    data["exercises"][0]["answer"] = "10"
    with pytest.raises(Exception):
        _validate(data)


def test_age_min_gt_max_rejected() -> None:
    data = _load_json("letters-A-v1")
    data["age_min"], data["age_max"] = 8, 4
    with pytest.raises(Exception):
        _validate(data)


def test_too_few_options_rejected() -> None:
    data = _load_json("letters-A-v1")
    data["exercises"][0]["options"] = [{"id": "a", "text": "μόνο"}]
    with pytest.raises(Exception):
        _validate(data)


def test_extra_field_forbidden() -> None:
    data = _load_json("math-times-v1")
    data["surprise"] = True
    with pytest.raises(Exception):
        _validate(data)


def test_missing_manifest_raises(tmp_path: Path) -> None:
    with pytest.raises(BundleValidationError) as exc:
        load_bundle(tmp_path)
    assert exc.value.field == "manifest.json"


def test_path_traversal_asset_rejected(tmp_path: Path) -> None:
    data = _load_json("letters-A-v1")
    data["exercises"][0]["options"][0]["image"] = "../../secret.png"
    (tmp_path / "manifest.json").write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(BundleValidationError):
        load_bundle(tmp_path)


def test_missing_asset_file_rejected(tmp_path: Path) -> None:
    data = _load_json("letters-A-v1")
    # valid reference shape, but the file does not exist in this temp bundle
    (tmp_path / "manifest.json").write_text(json.dumps(data), encoding="utf-8")
    (tmp_path / "assets").mkdir()
    with pytest.raises(BundleValidationError) as exc:
        load_bundle(tmp_path)
    assert "not found" in exc.value.msg


def test_invalid_json_rejected(tmp_path: Path) -> None:
    (tmp_path / "manifest.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(BundleValidationError) as exc:
        load_bundle(tmp_path)
    assert "invalid JSON" in exc.value.msg


def test_all_exercise_type_shapes_validate() -> None:
    """The other three types (M4) have finalized shapes that validate."""
    base = _load_json("letters-A-v1")
    base["exercises"] = [
        {
            "id": "c1",
            "type": "counting",
            "prompt": "Πόσα μήλα;",
            "image": "apple.png",
            "answer": 3,
            "max_count": 5,
        },
        {
            "id": "o1",
            "type": "ordering",
            "prompt": "Βάλε στη σειρά",
            "items": [
                {"id": "i1", "text": "ένα"},
                {"id": "i2", "text": "δύο"},
                {"id": "i3", "text": "τρία"},
            ],
            "answer": ["i1", "i2", "i3"],
        },
        {
            "id": "m1",
            "type": "match_pairs",
            "prompt": "Ταίριαξε",
            "pairs": [
                {"left": {"id": "l1", "text": "ένα"}, "right": {"id": "r1", "text": "ένα"}},
                {"left": {"id": "l2", "text": "δύο"}, "right": {"id": "r2", "text": "δύο"}},
            ],
        },
    ]
    manifest = BundleManifest.model_validate(base)
    assert {e.type for e in manifest.exercises} == {"counting", "ordering", "match_pairs"}


def test_ordering_answer_must_cover_items() -> None:
    base = _load_json("letters-A-v1")
    base["exercises"] = [
        {
            "id": "o1",
            "type": "ordering",
            "prompt": "Βάλε στη σειρά",
            "items": [
                {"id": "i1", "text": "ένα"},
                {"id": "i2", "text": "δύο"},
                {"id": "i3", "text": "τρία"},
            ],
            "answer": ["i1", "i2"],
        }
    ]
    with pytest.raises(Exception):
        BundleManifest.model_validate(base)
