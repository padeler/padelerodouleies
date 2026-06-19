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
    """Correct + wrong round-trip for the three M4 types (PLAN.md M4)."""
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
    finally:
        await admin_client.aclose()


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
