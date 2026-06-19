"""Exercise-bundle schema — the single source of truth for the bundle format.

These Pydantic models *are* the validator. A bundle that validates clean here
loads clean in the app, and the M6 generation tool runs the exact same models
before emitting a bundle (so generated content can never drift from what the
container accepts).

Design notes:
- ``extra="forbid"`` everywhere: an unknown field is a bug, not silently dropped.
- Per-type exercise models form a discriminated union on ``type`` so each type's
  ``answer``/options shape is strictly typed (no loose ``Any`` answer field).
- Validation fails *explicitly*: structural problems surface as Pydantic
  ``ValidationError``; the loader (``app.services.exercise_bundles``) converts
  those — plus asset/path-traversal problems — into ``BundleValidationError``
  carrying the offending bundle path and field.
- ``kid_view`` strips everything the client must never see: the ``answer`` and
  the ``*_tts`` spoken-text overrides (TTS text is built server-side).

Run ``python -m app.schemas.exercises <bundle-dir>`` to validate a bundle from
the command line (used by the M6 generator); exits non-zero with the error.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 1

# Closed navigation enum — group labels go through translations.py (invariant #5).
Subject = Literal["language", "math", "geography", "history", "logic", "nature"]

# Greek (incl. extended) and Latin letter detectors, used for the mono-script
# rule. Reuses the Greek-block idea from app/services/tts.py::_GREEK_RE.
_GREEK_RE = re.compile(r"[Ͱ-Ͽἀ-῿]")
_LATIN_RE = re.compile(r"[A-Za-z]")


def _assert_mono_script(value: str, field: str) -> None:
    """Reject a TTS-bound string that mixes Greek and Latin letters.

    Piper has no per-word language switching (one fixed G2P per voice), so a
    blended string mispronounces the minority script. Digits, operators and
    punctuation are script-neutral and always allowed. See PLAN.md §2.
    """
    if _GREEK_RE.search(value) and _LATIN_RE.search(value):
        raise ValueError(f"{field} mixes Greek and Latin letters (must be mono-script)")


def _assert_no_traversal(ref: str, field: str) -> None:
    """Reject an asset reference that could escape the bundle's assets/ dir."""
    if ref.startswith("/") or ref.startswith("\\") or ".." in ref.replace("\\", "/").split("/"):
        raise ValueError(f"{field} asset reference is not allowed: {ref!r}")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExerciseOption(_Strict):
    """One selectable/orderable item: an image, a text label, or both."""

    id: str = Field(min_length=1, max_length=40)
    image: str | None = Field(default=None, max_length=200)
    text: str | None = Field(default=None, max_length=200)

    def model_post_init(self, _ctx: Any) -> None:
        if self.image is None and self.text is None:
            raise ValueError(f"option {self.id!r} needs at least one of image/text")
        if self.image is not None:
            _assert_no_traversal(self.image, f"option {self.id!r} image")
        if self.text is not None:
            _assert_mono_script(self.text, f"option {self.id!r} text")


class ExercisePair(_Strict):
    """A left↔right pairing for ``match_pairs``; both sides are options."""

    left: ExerciseOption
    right: ExerciseOption


class _ExerciseBase(_Strict):
    id: str = Field(min_length=1, max_length=40)
    prompt: str = Field(min_length=1, max_length=400)
    prompt_tts: str | None = Field(default=None, max_length=400)
    hint: str | None = Field(default=None, max_length=400)
    hint_tts: str | None = Field(default=None, max_length=400)
    # Optional exercise-level image (scene/instructional). CountingExercise
    # overrides this with a required `image: str`.
    image: str | None = Field(default=None, max_length=200)

    def model_post_init(self, _ctx: Any) -> None:
        for field in ("prompt", "prompt_tts", "hint", "hint_tts"):
            value = getattr(self, field)
            if value is not None:
                _assert_mono_script(value, f"exercise {self.id!r} {field}")
        if self.image is not None:
            _assert_no_traversal(self.image, f"exercise {self.id!r} image")


class MultipleChoiceExercise(_ExerciseBase):
    type: Literal["multiple_choice"]
    options: list[ExerciseOption] = Field(min_length=2, max_length=4)
    answer: str  # the id of the correct option

    def model_post_init(self, _ctx: Any) -> None:
        super().model_post_init(_ctx)
        ids = [o.id for o in self.options]
        if len(set(ids)) != len(ids):
            raise ValueError(f"exercise {self.id!r} has duplicate option ids")
        if self.answer not in ids:
            raise ValueError(f"exercise {self.id!r} answer {self.answer!r} is not an option id")


class NumericEntryExercise(_ExerciseBase):
    type: Literal["numeric_entry"]
    # Integers only, exact match — no decimals/fractions/tolerance in v1 (PLAN §7).
    # bool is an int subclass in Python; forbid it explicitly via strict int.
    answer: int = Field(strict=True)


class CountingExercise(_ExerciseBase):
    type: Literal["counting"]
    # The scene to count (an image asset); the kid taps the right number.
    image: str = Field(max_length=200)
    answer: int = Field(strict=True, ge=0)
    # Upper bound of the number pad shown to the kid (inclusive).
    max_count: int = Field(default=10, ge=1, le=99)

    def model_post_init(self, _ctx: Any) -> None:
        super().model_post_init(_ctx)
        _assert_no_traversal(self.image, f"exercise {self.id!r} image")
        if self.answer > self.max_count:
            raise ValueError(f"exercise {self.id!r} answer exceeds max_count")


class OrderingExercise(_ExerciseBase):
    type: Literal["ordering"]
    items: list[ExerciseOption] = Field(min_length=3, max_length=5)
    answer: list[str]  # item ids in the correct order

    def model_post_init(self, _ctx: Any) -> None:
        super().model_post_init(_ctx)
        ids = [i.id for i in self.items]
        if len(set(ids)) != len(ids):
            raise ValueError(f"exercise {self.id!r} has duplicate item ids")
        if sorted(self.answer) != sorted(ids):
            raise ValueError(f"exercise {self.id!r} answer must order exactly the item ids")


class MatchPairsExercise(_ExerciseBase):
    type: Literal["match_pairs"]
    pairs: list[ExercisePair] = Field(min_length=2, max_length=6)
    # answer is implicit: each pair's left matches its own right.

    def model_post_init(self, _ctx: Any) -> None:
        super().model_post_init(_ctx)
        left_ids = [p.left.id for p in self.pairs]
        right_ids = [p.right.id for p in self.pairs]
        if len(set(left_ids)) != len(left_ids) or len(set(right_ids)) != len(right_ids):
            raise ValueError(f"exercise {self.id!r} has duplicate pair side ids")


Exercise = Annotated[
    Union[
        MultipleChoiceExercise,
        NumericEntryExercise,
        CountingExercise,
        OrderingExercise,
        MatchPairsExercise,
    ],
    Field(discriminator="type"),
]


class BundleManifest(_Strict):
    """A validated exercise bundle manifest (``manifest.json``)."""

    schema_version: int = Field(ge=1)
    id: str = Field(min_length=1, max_length=80)  # stable across versions
    version: int = Field(ge=1)  # (id, version) is the bundle identity
    title: str = Field(min_length=1, max_length=200)
    subject: Subject
    age_min: int = Field(ge=0, le=120)
    age_max: int = Field(ge=0, le=120)
    stars: int = Field(ge=0)
    difficulty: int = Field(ge=1, le=5)
    exercises: list[Exercise] = Field(min_length=1)

    def model_post_init(self, _ctx: Any) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(
                f"unsupported schema_version {self.schema_version} (expected {SCHEMA_VERSION})"
            )
        if self.age_min > self.age_max:
            raise ValueError(f"age_min ({self.age_min}) must be <= age_max ({self.age_max})")
        ex_ids = [e.id for e in self.exercises]
        if len(set(ex_ids)) != len(ex_ids):
            raise ValueError("duplicate exercise ids in bundle")


def _option_view(option: ExerciseOption) -> dict[str, Any]:
    return option.model_dump(exclude_none=True)


def _exercise_view(exercise: Any) -> dict[str, Any]:
    """One exercise, stripped of ``answer`` and the ``*_tts`` overrides."""
    view: dict[str, Any] = {
        "id": exercise.id,
        "type": exercise.type,
        "prompt": exercise.prompt,
    }
    if exercise.hint is not None:
        view["hint"] = exercise.hint
    # Exercise-level image (optional on most types; required on counting).
    if exercise.image is not None:
        view["image"] = exercise.image
    if isinstance(exercise, MultipleChoiceExercise):
        view["options"] = [_option_view(o) for o in exercise.options]
    elif isinstance(exercise, CountingExercise):
        view["max_count"] = exercise.max_count
    elif isinstance(exercise, OrderingExercise):
        view["items"] = [_option_view(o) for o in exercise.items]
    elif isinstance(exercise, MatchPairsExercise):
        view["pairs"] = [
            {"left": _option_view(p.left), "right": _option_view(p.right)} for p in exercise.pairs
        ]
    # numeric_entry needs no extra structural fields.
    return view


def kid_view(manifest: BundleManifest) -> dict[str, Any]:
    """Serialize a manifest for the client — never including answers or TTS text."""
    return {
        "schema_version": manifest.schema_version,
        "id": manifest.id,
        "version": manifest.version,
        "title": manifest.title,
        "subject": manifest.subject,
        "age_min": manifest.age_min,
        "age_max": manifest.age_max,
        "stars": manifest.stars,
        "exercises": [_exercise_view(e) for e in manifest.exercises],
    }


def asset_refs(manifest: BundleManifest) -> list[str]:
    """Every image asset referenced by the bundle (for existence checks)."""
    refs: list[str] = []
    for ex in manifest.exercises:
        # Exercise-level scene image (optional on most types; required on counting).
        if ex.image is not None:
            refs.append(ex.image)
        if isinstance(ex, MultipleChoiceExercise):
            refs += [o.image for o in ex.options if o.image]
        elif isinstance(ex, CountingExercise):
            pass  # already collected ex.image above
        elif isinstance(ex, OrderingExercise):
            refs += [o.image for o in ex.items if o.image]
        elif isinstance(ex, MatchPairsExercise):
            for p in ex.pairs:
                refs += [o.image for o in (p.left, p.right) if o.image]
    return refs


if __name__ == "__main__":  # pragma: no cover - CLI used by the M6 generator
    import sys
    from pathlib import Path

    from app.services.exercise_bundles import BundleValidationError, load_bundle

    if len(sys.argv) != 2:
        print("usage: python -m app.schemas.exercises <bundle-dir>", file=sys.stderr)
        sys.exit(2)
    try:
        bundle = load_bundle(Path(sys.argv[1]))
    except BundleValidationError as exc:
        print(f"INVALID: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"OK: {bundle.id} v{bundle.version} ({len(bundle.exercises)} exercises)")
