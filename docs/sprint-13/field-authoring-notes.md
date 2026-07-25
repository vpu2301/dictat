# Sprint 13 — Typed-field authoring notes & known limitations

For template authors and support/runbook use. Backend behaviors below are
by design (safety over convenience) — coordinated with the backend
Sprint-13 sign-off.

## Compound measurements (blood pressure et al.) do NOT auto-fill

A `numeric_with_unit` section binds exactly ONE clean value. A dictated
compound like «тиск сто сорок на дев'яносто» (140/90) contains two values —
the extractor (BE step 05) treats that as ambiguity and emits **no
metadata**. The FE then shows an empty numeric input with the dictated
prose preserved below: the record is never worse than plain dictation, and
nothing is guessed.

What the clinician sees: "why didn't it fill the pressure?" — honest
answer: two numbers can't be bound to one field safely.

What template authors should do: model BP as **two sections**
(`bp_systolic`, `bp_diastolic`, each `numeric_with_unit`) if auto-fill
matters, or accept manual entry into a single field. This is a
template-authoring decision, deliberately NOT special-cased in the
renderer.

The same rule covers any multi-value utterance (several dates → empty date
field; below-threshold confidence → empty field).

## `date_with_note`: the note IS the section prose

The pinned metadata for `date`/`date_with_note` carries only `{date}`.
The "note" is the section's dictated text (`section.text`), which stays
visible and editable below the date widget — `min_chars` at finalize
applies to that text. There is no separate note input (it would dual-write
the prose).

## Exclusive options (`none_known`-style) — named backend ask

`multi_choice` sections often want a "none known" option that excludes the
others. The backend `ChoiceOption` model (`extra="forbid"`) has **no
exclusivity flag** today, and the FE refuses to hardcode slugs. The FE
already honors `option.exclusive: true` if/when the backend adds it
(forward-compat, tested); until then such options toggle like any other.
**Ask:** add `exclusive: bool = False` to `ChoiceOption` (BE
template_models/schema.py).

## Numeric input locale

uk decimals are commas: the renderer accepts both «36,6» and "36.6" and
stores the JSON number `36.6`. Thousands grouping is rejected, not parsed —
«1 234,5» is an input error, never a silent `1.2345` or `12345`.

## Multi-choice partial confirmation

The metadata contract carries one `source` for the whole selection, so
"confirm this chip, keep the rest staged" is unrepresentable. Reviewing a
proposed set: per-chip **dismiss** the wrong ones (the rest stay
proposed), then «Підтвердити всі». Per-chip confirm means "the set is
exactly this value" (other proposals drop to plain chips; prose intact).
