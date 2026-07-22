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


# -- built-in icon URL references -------------------------------------------

def _minimal_manifest_with_icon(icon: str) -> dict:
    """A self-contained one-exercise bundle whose only asset ref is ``icon``."""
    return {
        "schema_version": 1,
        "id": "icon-probe",
        "version": 1,
        "title": "Δοκιμή εικονιδίου",
        "subject": "language",
        "age_min": 8,
        "age_max": 10,
        "stars": 0,
        "difficulty": 1,
        "exercises": [
            {"id": "e1", "type": "numeric_entry", "prompt": "1 + 1 = ;",
             "prompt_tts": "ένα συν ένα", "answer": 2, "icon": icon},
        ],
    }


def test_builtin_icon_url_accepted_without_assets(tmp_path: Path) -> None:
    # A shipped icon is referenced by URL and needs no assets/ dir at all.
    data = _minimal_manifest_with_icon("/api/icons/svg/snowflake")
    (tmp_path / "manifest.json").write_text(json.dumps(data), encoding="utf-8")
    bundle = load_bundle(tmp_path)
    assert bundle.exercises[0].icon == "/api/icons/svg/snowflake"


def test_builtin_icon_unknown_name_rejected(tmp_path: Path) -> None:
    data = _minimal_manifest_with_icon("/api/icons/svg/totally-not-a-real-icon")
    (tmp_path / "manifest.json").write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(BundleValidationError) as exc:
        load_bundle(tmp_path)
    assert "built-in icon not found" in exc.value.msg


def test_builtin_icon_malformed_ref_rejected() -> None:
    # A traversal segment after the prefix must be rejected at schema validation.
    from pydantic import ValidationError

    data = _minimal_manifest_with_icon("/api/icons/svg/../secret")
    with pytest.raises(ValidationError, match="malformed"):
        BundleManifest.model_validate(data)


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


# ===========================================================================
# M8 — decimal_entry and fraction_entry types
# ===========================================================================

def _v2_base() -> dict:
    """Minimal v2 manifest for building M8 test exercises inline."""
    return {
        "schema_version": 2,
        "id": "m8-test",
        "version": 1,
        "title": "Δεκαδικοί και κλάσματα",
        "subject": "math",
        "age_min": 8,
        "age_max": 11,
        "stars": 3,
        "difficulty": 3,
        "exercises": [],
    }


# -- schema validation -------------------------------------------------------

def test_decimal_entry_valid() -> None:
    data = _v2_base()
    data["exercises"] = [{"id": "d1", "type": "decimal_entry", "prompt": "7,57", "answer": "7,57"}]
    manifest = BundleManifest.model_validate(data)
    assert manifest.exercises[0].type == "decimal_entry"
    assert manifest.exercises[0].answer == "7,57"


def test_decimal_entry_dot_separator_valid() -> None:
    data = _v2_base()
    data["exercises"] = [{"id": "d1", "type": "decimal_entry", "prompt": "7.57", "answer": "7.57"}]
    BundleManifest.model_validate(data)


def test_decimal_entry_integer_answer_valid() -> None:
    data = _v2_base()
    data["exercises"] = [{"id": "d1", "type": "decimal_entry", "prompt": "5 + 5", "answer": "10"}]
    BundleManifest.model_validate(data)


def test_decimal_entry_bad_string_rejected() -> None:
    data = _v2_base()
    data["exercises"] = [{"id": "d1", "type": "decimal_entry", "prompt": "?", "answer": "abc"}]
    with pytest.raises(Exception, match="not a valid decimal"):
        BundleManifest.model_validate(data)


def test_decimal_entry_float_answer_rejected() -> None:
    """answer must be a string, not a float (no precision drift)."""
    data = _v2_base()
    data["exercises"] = [{"id": "d1", "type": "decimal_entry", "prompt": "?", "answer": 7.57}]
    with pytest.raises(Exception):
        BundleManifest.model_validate(data)


def test_fraction_entry_valid() -> None:
    data = _v2_base()
    data["exercises"] = [
        {"id": "f1", "type": "fraction_entry", "prompt": "Πόσο;", "answer": {"numerator": 3, "denominator": 4}}
    ]
    manifest = BundleManifest.model_validate(data)
    ex = manifest.exercises[0]
    assert ex.type == "fraction_entry"
    assert ex.answer.numerator == 3
    assert ex.answer.denominator == 4
    assert ex.accept_equivalent is True


def test_fraction_entry_denominator_zero_rejected() -> None:
    data = _v2_base()
    data["exercises"] = [
        {"id": "f1", "type": "fraction_entry", "prompt": "?", "answer": {"numerator": 1, "denominator": 0}}
    ]
    with pytest.raises(Exception):
        BundleManifest.model_validate(data)


def test_fraction_entry_bool_denominator_rejected() -> None:
    """bool is an int subclass; strict=True on FractionAnswer rejects it."""
    data = _v2_base()
    data["exercises"] = [
        {"id": "f1", "type": "fraction_entry", "prompt": "?", "answer": {"numerator": 1, "denominator": True}}
    ]
    with pytest.raises(Exception):
        BundleManifest.model_validate(data)


def test_schema_version_1_still_accepted() -> None:
    """v1 bundles load unchanged after the schema_version: 2 bump."""
    bundle = load_bundle(FIXTURES / "math-times-v1")
    assert bundle.schema_version == 1


def test_schema_version_3_rejected() -> None:
    data = _load_json("math-times-v1")
    data["schema_version"] = 3
    with pytest.raises(Exception, match="unsupported"):
        BundleManifest.model_validate(data)


# -- kid_view strips new answers --------------------------------------------

def test_kid_view_strips_decimal_answer() -> None:
    data = _v2_base()
    data["exercises"] = [
        {"id": "d1", "type": "decimal_entry", "prompt": "?", "answer": "7,57", "decimals": 2},
    ]
    manifest = BundleManifest.model_validate(data)
    view = kid_view(manifest)
    blob = json.dumps(view)
    assert "answer" not in blob
    ex = view["exercises"][0]
    assert ex["decimals"] == 2  # hint survives


def test_kid_view_strips_fraction_answer() -> None:
    data = _v2_base()
    data["exercises"] = [
        {"id": "f1", "type": "fraction_entry", "prompt": "?", "answer": {"numerator": 3, "denominator": 4}},
    ]
    manifest = BundleManifest.model_validate(data)
    view = kid_view(manifest)
    blob = json.dumps(view)
    assert "answer" not in blob
    assert "accept_equivalent" not in blob  # backend-only grading config


# -- grading ----------------------------------------------------------------

from app.schemas.exercises import DecimalEntryExercise, FractionAnswer, FractionEntryExercise


def _decimal_ex(answer: str) -> DecimalEntryExercise:
    return DecimalEntryExercise(id="d1", type="decimal_entry", prompt="?", answer=answer)


def _fraction_ex(num: int, den: int, equiv: bool = True) -> FractionEntryExercise:
    return FractionEntryExercise(
        id="f1", type="fraction_entry", prompt="?",
        answer=FractionAnswer(numerator=num, denominator=den),
        accept_equivalent=equiv,
    )


def test_grade_decimal_comma_and_dot_both_accepted() -> None:
    ex = _decimal_ex("7,57")
    assert grade(ex, "7,57") is True
    assert grade(ex, "7.57") is True  # dot normalised to comma at parse time


def test_grade_decimal_trailing_zeros_normalized() -> None:
    ex = _decimal_ex("7,5")
    assert grade(ex, "7,50") is True
    assert grade(ex, "7,500") is True


def test_grade_decimal_exact_mismatch_fails() -> None:
    ex = _decimal_ex("7,57")
    assert grade(ex, "7,58") is False


def test_grade_decimal_invalid_response_raises() -> None:
    ex = _decimal_ex("7,57")
    with pytest.raises(exercises.ResponseError, match="valid decimal"):
        grade(ex, "abc")


def test_grade_decimal_bool_response_raises() -> None:
    ex = _decimal_ex("7,57")
    with pytest.raises(exercises.ResponseError, match="boolean"):
        grade(ex, True)


def test_grade_fraction_exact_match() -> None:
    ex = _fraction_ex(3, 4, equiv=False)
    assert grade(ex, {"numerator": 3, "denominator": 4}) is True
    assert grade(ex, {"numerator": 6, "denominator": 8}) is False  # equiv off


def test_grade_fraction_equivalent_match() -> None:
    ex = _fraction_ex(3, 4)  # accept_equivalent defaults to True
    assert grade(ex, {"numerator": 6, "denominator": 8}) is True
    assert grade(ex, {"numerator": 9, "denominator": 12}) is True


def test_grade_fraction_wrong() -> None:
    ex = _fraction_ex(3, 4)
    assert grade(ex, {"numerator": 1, "denominator": 2}) is False


def test_grade_fraction_denominator_zero_raises() -> None:
    ex = _fraction_ex(3, 4)
    with pytest.raises(exercises.ResponseError, match="not be zero"):
        grade(ex, {"numerator": 3, "denominator": 0})


def test_grade_fraction_bad_response_raises() -> None:
    ex = _fraction_ex(3, 4)
    with pytest.raises(exercises.ResponseError):
        grade(ex, "3/4")  # string not a dict


def test_grade_fraction_bool_in_response_raises() -> None:
    ex = _fraction_ex(3, 4)
    with pytest.raises(exercises.ResponseError):
        grade(ex, {"numerator": True, "denominator": 4})


# ===========================================================================
# M2 — discovery, persistence, grading, kid API
# ===========================================================================

from datetime import date, datetime, timezone

from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import ExerciseAttempt, ExerciseCompletion, HistoryLedger, User
from app.main import app
from app.security.pins import hash_pin
from app.services import exercise_bundles, exercises
from app.services.exercises import age_for, grade, submit_answer, visible_bundles


@pytest.fixture
def exercises_dir(monkeypatch):
    """Point discovery at the test fixtures dir (incl. the broken bundle)."""
    monkeypatch.setattr(exercise_bundles, "EXERCISES_DIR", FIXTURES)
    exercise_bundles.clear_cache()
    yield FIXTURES
    exercise_bundles.clear_cache()


# -- discovery --------------------------------------------------------------

def test_discover_separates_valid_and_invalid(exercises_dir) -> None:
    result = exercise_bundles.discover()
    valid_ids = {b.manifest.id for b in result.valid}
    assert valid_ids == {"letters-A", "math-times"}
    assert len(result.invalid) == 1
    assert "mono-script" in result.invalid[0].error or "mixes" in result.invalid[0].error


def test_discover_is_mtime_cached(exercises_dir) -> None:
    first = exercise_bundles.discover()
    second = exercise_bundles.discover()
    assert first is second  # same object returned from cache


def test_get_bundle_picks_highest_version(exercises_dir) -> None:
    bundle = exercise_bundles.get_bundle("letters-A")
    assert bundle is not None and bundle.manifest.version == 1
    assert exercise_bundles.get_bundle("nope") is None


def test_discover_recurses_nested_layout(tmp_path, monkeypatch) -> None:
    """Bundles nested as <grade>/<course>/<bundle>/ are found; containers ignored."""
    import shutil

    # A top-level bundle plus one nested two dirs deep under containers.
    shutil.copytree(FIXTURES / "letters-A-v1", tmp_path / "letters-A-v1")
    nested = tmp_path / "Γ_ΤΑΞΗ" / "math" / "math-times-v1"
    shutil.copytree(FIXTURES / "math-times-v1", nested)
    # An invalid bundle nested under a container is still surfaced.
    shutil.copytree(FIXTURES / "broken-mixed-script-v1", tmp_path / "Γ_ΤΑΞΗ" / "glossa" / "broken-v1")

    monkeypatch.setattr(exercise_bundles, "EXERCISES_DIR", tmp_path)
    exercise_bundles.clear_cache()
    result = exercise_bundles.discover()

    assert {b.manifest.id for b in result.valid} == {"letters-A", "math-times"}
    assert len(result.invalid) == 1
    # rel_path reflects the nested layout; intermediate dirs are not bundles.
    nested_bundle = next(b for b in result.valid if b.manifest.id == "math-times")
    assert exercise_bundles.rel_path(nested_bundle.dir) == "Γ_ΤΑΞΗ/math/math-times-v1"
    assert exercise_bundles.rel_path(result.invalid[0].dir) == "Γ_ΤΑΞΗ/glossa/broken-v1"


# -- duplicate-id detection -------------------------------------------------

def test_find_duplicate_ids(tmp_path, monkeypatch) -> None:
    """Two valid bundle dirs sharing an id are surfaced as a duplicate issue."""
    import shutil

    shutil.copytree(FIXTURES / "letters-A-v1", tmp_path / "letters-A-v1")
    # A second copy in a different dir keeps the same manifest id.
    dup = tmp_path / "copies" / "letters-A-again"
    shutil.copytree(FIXTURES / "letters-A-v1", dup)
    # An unrelated valid bundle must not be flagged.
    shutil.copytree(FIXTURES / "math-times-v1", tmp_path / "math-times-v1")

    monkeypatch.setattr(exercise_bundles, "EXERCISES_DIR", tmp_path)
    exercise_bundles.clear_cache()
    duplicates = exercise_bundles.find_duplicate_ids(exercise_bundles.discover())

    assert len(duplicates) == 1
    assert duplicates[0].id == "letters-A"
    assert set(duplicates[0].paths) == {"letters-A-v1", "copies/letters-A-again"}


def test_find_duplicate_ids_none_when_unique(exercises_dir) -> None:
    assert exercise_bundles.find_duplicate_ids(exercise_bundles.discover()) == ()


# -- zip upload -------------------------------------------------------------

def _bundle_zip_bytes(arcprefix: str = "") -> bytes:
    """A zip carrying the letters-A fixture bundle under an optional path prefix."""
    import io
    import zipfile

    src = FIXTURES / "letters-A-v1"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for path in sorted(src.rglob("*")):
            if path.is_file():
                arcname = f"{arcprefix}{path.relative_to(src.parent)}"
                zf.write(path, arcname)
    return buf.getvalue()


def test_extract_bundles_zip_preserves_structure(tmp_path) -> None:
    extracted = exercise_bundles.extract_bundles_zip(_bundle_zip_bytes(), root=tmp_path)
    assert (tmp_path / "letters-A-v1" / "manifest.json").is_file()
    assert any(name.startswith("letters-A-v1/") for name in extracted)
    # The extracted bundle loads cleanly.
    assert exercise_bundles.load_bundle(tmp_path / "letters-A-v1").id == "letters-A"


def test_extract_bundles_zip_nested_prefix(tmp_path) -> None:
    exercise_bundles.extract_bundles_zip(_bundle_zip_bytes("Γ_ΤΑΞΗ/glossa/"), root=tmp_path)
    assert (tmp_path / "Γ_ΤΑΞΗ" / "glossa" / "letters-A-v1" / "manifest.json").is_file()


def test_extract_bundles_zip_rejects_bad_zip(tmp_path) -> None:
    with pytest.raises(exercise_bundles.BundleUploadError):
        exercise_bundles.extract_bundles_zip(b"not a zip", root=tmp_path)


def test_extract_bundles_zip_rejects_traversal(tmp_path) -> None:
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../escape.txt", "nope")
    with pytest.raises(exercise_bundles.BundleUploadError):
        exercise_bundles.extract_bundles_zip(buf.getvalue(), root=tmp_path)
    # Nothing was written outside the root.
    assert not (tmp_path.parent / "escape.txt").exists()


# -- age targeting ----------------------------------------------------------

def test_age_for_boundaries() -> None:
    assert age_for(date(2020, 6, 17), date(2026, 6, 17)) == 6  # birthday today
    assert age_for(date(2020, 6, 18), date(2026, 6, 17)) == 5  # day before birthday
    assert age_for(date(2020, 1, 1), date(2026, 12, 31)) == 6


def test_visible_bundles_age_filtering(exercises_dir) -> None:
    young = User(name="Young", role="user", birthdate=date(2021, 1, 1))  # ~5
    older = User(name="Older", role="user", birthdate=date(2018, 1, 1))  # ~8
    no_bd = User(name="NoBd", role="user", birthdate=None)
    assert {b.manifest.id for b in visible_bundles(young)} == {"letters-A"}
    assert {b.manifest.id for b in visible_bundles(older)} == {"math-times"}
    assert visible_bundles(no_bd) == []


# -- grading (pure) ---------------------------------------------------------

def test_grade_multiple_choice_and_numeric(exercises_dir) -> None:
    mc = exercise_bundles.get_bundle("letters-A").manifest.exercises[0]
    assert grade(mc, "a") is True
    assert grade(mc, "b") is False
    ne = exercise_bundles.get_bundle("math-times").manifest.exercises[0]
    assert grade(ne, 10) is True
    assert grade(ne, "10") is True
    assert grade(ne, " 10 ") is True
    assert grade(ne, 11) is False


def test_grade_counting_ordering_match_pairs() -> None:
    """Correct + wrong round-trip for the counting/ordering/match_pairs types."""
    base = _load_json("letters-A-v1")
    base["exercises"] = [
        {"id": "c1", "type": "counting", "prompt": "Πόσα;", "image": "apple.png", "answer": 3, "max_count": 5},
        {
            "id": "o1", "type": "ordering", "prompt": "Σειρά",
            "items": [{"id": "i1", "text": "ένα"}, {"id": "i2", "text": "δύο"}, {"id": "i3", "text": "τρία"}],
            "answer": ["i1", "i2", "i3"],
        },
        {
            "id": "m1", "type": "match_pairs", "prompt": "Ταίριαξε",
            "pairs": [
                {"left": {"id": "l1", "text": "ένα"}, "right": {"id": "r1", "text": "πρώτο"}},
                {"left": {"id": "l2", "text": "δύο"}, "right": {"id": "r2", "text": "δεύτερο"}},
            ],
        },
    ]
    counting, ordering, match = BundleManifest.model_validate(base).exercises

    assert grade(counting, 3) is True
    assert grade(counting, "3") is True
    assert grade(counting, 4) is False

    assert grade(ordering, ["i1", "i2", "i3"]) is True
    assert grade(ordering, ["i2", "i1", "i3"]) is False

    assert grade(match, {"l1": "r1", "l2": "r2"}) is True
    assert grade(match, {"l1": "r2", "l2": "r1"}) is False


def test_grade_rejects_malformed_response(exercises_dir) -> None:
    ne = exercise_bundles.get_bundle("math-times").manifest.exercises[0]
    with pytest.raises(exercises.ResponseError):
        grade(ne, "abc")
    with pytest.raises(exercises.ResponseError):
        grade(ne, True)


# -- submission + completion (DB) -------------------------------------------

def _complete_letters_a(db, user):
    bundle = exercise_bundles.get_bundle("letters-A")
    submit_answer(db, user, bundle, "ex-01", "a")
    return submit_answer(db, user, bundle, "ex-02", "cat")


def test_submission_records_attempts_and_naive_utc(exercises_dir) -> None:
    db = LocalSession()
    try:
        kid = User(name="ExKid1", role="user", pin_hash=hash_pin("1234"), birthdate=date(2021, 1, 1))
        db.add(kid)
        db.commit()
        bundle = exercise_bundles.get_bundle("letters-A")
        res = submit_answer(db, kid, bundle, "ex-01", "b")  # wrong
        assert res.correct is False and res.completed is False
        attempt = db.query(ExerciseAttempt).filter(ExerciseAttempt.user_id == kid.id).first()
        assert attempt.correct is False
        assert attempt.created_at.tzinfo is None  # naive UTC like the ledger
    finally:
        db.close()


def test_completion_awards_stars_once_idempotent(exercises_dir) -> None:
    db = LocalSession()
    try:
        kid = User(name="ExKid2", role="user", pin_hash=hash_pin("1234"),
                   birthdate=date(2021, 1, 1), current_stars=0)
        db.add(kid)
        db.commit()
        res = _complete_letters_a(db, kid)
        assert res.completed is True
        assert res.stars_awarded == 3
        assert kid.current_stars == 3
        assert db.query(ExerciseCompletion).filter(ExerciseCompletion.user_id == kid.id).count() == 1
        ledger_rows = db.query(HistoryLedger).filter(
            HistoryLedger.user_id == kid.id,
            HistoryLedger.action_type == "exercise_complete",
        ).all()
        assert len(ledger_rows) == 1
        assert ledger_rows[0].points_delta == 3
        assert ledger_rows[0].ref_table == "exercise_completions"

        # Re-answering after completion must not double-award.
        bundle = exercise_bundles.get_bundle("letters-A")
        again = submit_answer(db, kid, bundle, "ex-01", "a")
        assert again.completed is False and again.stars_awarded == 0
        assert kid.current_stars == 3
        assert db.query(ExerciseCompletion).filter(ExerciseCompletion.user_id == kid.id).count() == 1
    finally:
        db.close()


# -- API --------------------------------------------------------------------

async def _login_kid(birthdate):
    db = LocalSession()
    kid = User(name=f"ApiKid{datetime.now(timezone.utc).timestamp()}", role="user",
               pin_hash=hash_pin("1234"), birthdate=birthdate)
    db.add(kid)
    db.commit()
    uid = kid.id
    db.close()
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver", cookies=Cookies())
    resp = await client.post("/api/auth/login", json={"user_id": uid, "pin": "1234"})
    assert resp.status_code == 200
    return client, uid


async def _login_admin():
    db = LocalSession()
    admin = User(name=f"ApiAdmin{datetime.now(timezone.utc).timestamp()}", role="admin",
                 pin_hash=hash_pin("4321"))
    db.add(admin)
    db.commit()
    uid = admin.id
    db.close()
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver", cookies=Cookies())
    resp = await client.post("/api/auth/login", json={"user_id": uid, "pin": "4321"})
    assert resp.status_code == 200
    return client, uid


async def test_api_requires_auth() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        assert (await c.get("/api/exercises/bundles")).status_code == 401


async def test_admin_rescan_requires_admin(exercises_dir) -> None:
    # A kid is forbidden; an admin gets fresh counts.
    kid_client, _ = await _login_kid(date(2021, 1, 1))
    try:
        assert (await kid_client.post("/api/admin/exercises/rescan")).status_code == 403
    finally:
        await kid_client.aclose()

    admin_client, _ = await _login_admin()
    try:
        resp = await admin_client.post("/api/admin/exercises/rescan")
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] == 2 and body["invalid"] == 1
        assert body["duplicates"] == []
    finally:
        await admin_client.aclose()


async def test_admin_upload_bundles(tmp_path, monkeypatch) -> None:
    """An admin uploads a zip; it is extracted into EXERCISES_DIR and rescanned."""
    monkeypatch.setattr(exercise_bundles, "EXERCISES_DIR", tmp_path)
    exercise_bundles.clear_cache()

    kid_client, _ = await _login_kid(date(2021, 1, 1))
    try:
        forbidden = await kid_client.post(
            "/api/admin/exercises/upload",
            files={"file": ("bundles.zip", _bundle_zip_bytes(), "application/zip")},
        )
        assert forbidden.status_code == 403
    finally:
        await kid_client.aclose()

    admin_client, _ = await _login_admin()
    try:
        resp = await admin_client.post(
            "/api/admin/exercises/upload",
            files={"file": ("bundles.zip", _bundle_zip_bytes(), "application/zip")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["extracted"] > 0 and body["valid"] == 1 and body["duplicates"] == []
        assert (tmp_path / "letters-A-v1" / "manifest.json").is_file()

        # A corrupt archive is rejected without partial writes.
        bad = await admin_client.post(
            "/api/admin/exercises/upload",
            files={"file": ("bad.zip", b"not a zip", "application/zip")},
        )
        assert bad.status_code == 400
    finally:
        await admin_client.aclose()
        exercise_bundles.clear_cache()


async def test_api_list_and_manifest_no_answers(exercises_dir) -> None:
    client, _ = await _login_kid(date(2021, 1, 1))
    try:
        resp = await client.get("/api/exercises/bundles")
        assert resp.status_code == 200
        bundles = resp.json()
        assert {b["id"] for b in bundles} == {"letters-A"}
        assert bundles[0]["completed"] is False

        resp = await client.get("/api/exercises/bundles/letters-A")
        assert resp.status_code == 200
        assert "answer" not in json.dumps(resp.json())
    finally:
        await client.aclose()


async def test_api_asset_serving_and_traversal(exercises_dir) -> None:
    client, _ = await _login_kid(date(2021, 1, 1))
    try:
        ok = await client.get("/api/exercises/assets/letters-A/apple.png")
        assert ok.status_code == 200
        assert ok.headers["content-type"].startswith("image/")
        # Encoded ".." so the client does not collapse it before the server guard.
        bad = await client.get("/api/exercises/assets/letters-A/%2e%2e/manifest.json")
        assert bad.status_code == 404
        missing = await client.get("/api/exercises/assets/letters-A/nope.png")
        assert missing.status_code == 404
    finally:
        await client.aclose()


async def test_api_answer_flow_and_broadcast(exercises_dir) -> None:
    client, uid = await _login_kid(date(2021, 1, 1))
    try:
        r1 = await client.post("/api/exercises/bundles/letters-A/answers",
                               json={"exercise_id": "ex-01", "response": "b"})
        assert r1.json()["correct"] is False
        r2 = await client.post("/api/exercises/bundles/letters-A/answers",
                               json={"exercise_id": "ex-01", "response": "a"})
        assert r2.json()["correct"] is True and r2.json()["completed"] is False
        r3 = await client.post("/api/exercises/bundles/letters-A/answers",
                               json={"exercise_id": "ex-02", "response": "cat"})
        body = r3.json()
        assert body["completed"] is True and body["stars_awarded"] == 3 and body["current_stars"] == 3

        # completion now reflected in the list
        listing = (await client.get("/api/exercises/bundles")).json()
        assert listing[0]["completed"] is True
    finally:
        await client.aclose()


async def test_api_tts_unavailable_returns_503(exercises_dir, monkeypatch) -> None:
    from app.services import tts as tts_service

    def boom(_text):
        raise tts_service.TTSUnavailableError("no piper")

    monkeypatch.setattr(tts_service, "get_or_synthesize", boom)
    client, _ = await _login_kid(date(2021, 1, 1))
    try:
        resp = await client.get("/api/exercises/tts/letters-A/ex-01/prompt.mp3")
        assert resp.status_code == 503
        bad_kind = await client.get("/api/exercises/tts/letters-A/ex-01/whoops.mp3")
        assert bad_kind.status_code == 404
    finally:
        await client.aclose()


async def test_admin_preview_bypasses_age_gate_and_never_awards(exercises_dir) -> None:
    """An admin can play any bundle (no age gate); grading records nothing and awards no stars."""
    # A kid aged ~5 cannot even see math-times (ages 7-9) — the admin can.
    kid_client, _ = await _login_kid(date(2021, 1, 1))
    try:
        assert (await kid_client.get("/api/exercises/bundles/math-times")).status_code == 404
    finally:
        await kid_client.aclose()

    admin_client, admin_id = await _login_admin()
    try:
        manifest = await admin_client.get("/api/exercises/bundles/math-times")
        assert manifest.status_code == 200
        assert "answer" not in json.dumps(manifest.json())  # still the kid view

        # Wrong then right — both graded, neither recorded.
        wrong = await admin_client.post("/api/exercises/bundles/math-times/answers",
                                        json={"exercise_id": "ex-01", "response": 99})
        assert wrong.json()["correct"] is False
        for ex_id, ans in (("ex-01", 10), ("ex-02", 25)):
            body = (await admin_client.post("/api/exercises/bundles/math-times/answers",
                                            json={"exercise_id": ex_id, "response": ans})).json()
            assert body["correct"] is True
            assert body["completed"] is False and body["stars_awarded"] == 0
    finally:
        await admin_client.aclose()

    # No attempts/completions written, admin balance untouched.
    db = LocalSession()
    try:
        assert db.query(ExerciseAttempt).filter(ExerciseAttempt.user_id == admin_id).count() == 0
        assert db.query(ExerciseCompletion).filter(ExerciseCompletion.user_id == admin_id).count() == 0
        assert db.get(User, admin_id).current_stars == 0
    finally:
        db.close()
