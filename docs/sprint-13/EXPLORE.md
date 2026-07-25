# FE Sprint 13 — EXPLORE audit (step 01)

Audited 2026-07-22 on branch `S13`. Backend contract read from source in
`~/Desktop/dictate/medical-dictation-backend` (branch `S13`).

## 1. Stack — the `[ASSUMED]` tags, corrected

| Assumed | As-built |
|---|---|
| React 18 + **TypeScript** + Vite | React 18 + Vite, **plain JS/JSX** — no tsconfig, no TS dep |
| **Vitest/RTL** | **`node --test`** + `node:assert/strict` (`npm run test:unit`); no RTL/jsdom |
| TipTap report editor | ✓ TipTap 3.x (`@tiptap/react` 3.23) |
| Playwright | ✓ (`npm run e2e`; live suites gated by `RUN_BACKEND_INTEGRATION=1`) |
| F-02 API client | ✓ `src/api/client.js` (`apiAt(base, path, init)` — `init` spreads into `fetch`, so `AbortSignal` passes through) |
| FE S10 autocomplete hook `useAutocomplete` | exists as **`useSuggestions`** in `src/components/AutocompletePanel.jsx:67` (debounce/timeout/seq-guard/backoff) — step 05 reuses the pattern |

Consequence: every `*.ts(x)` path in the step specs maps to `*.js(x)`;
"types" become runtime validators/normalizers (`toWire/fromWire` ≙
parse/normalize helpers); "tsc + lint" ≙ `npm run test:unit` + `npm run build`.

## 2. The seams, by path

**Report editor & section-body rendering.** There is **no per-section React
body component to move** — the entire report body is ONE TipTap document
(`src/components/TipTapEditor.jsx`), and sections are ProseMirror nodes
(`src/extensions/SectionExtension.js`) whose label renders via CSS
`::before` (`src/sprints-06-10.css`). The body model is
`{ [section_id]: text }`, mapped by `bodyToDoc`/`docToBody` (extracted this
step to `src/reports/sectionDoc.js`). Pre-S13, the section node's `kind`
attr was hardcoded `'free_text'`; it now carries the real `field_type`.

**Where `field_type`/`options` live on the loaded model.**
`src/api/templates.js` → `toStudioTemplate()` adapts `schema_jsonb.sections`
for the Studio; it already carried `field_type`, and now also `options`
(`[{value, label, voice_aliases}]`, backend `template_models/schema.py` —
BE S13 step 01, merged) and `min_chars`.

**Where `icd10`/`field_specific_metadata` arrive.** `getReport(id,
{includeContent:true})` → `envelope.content.sections[]` each carry
`section_key, text, icd10[], field_specific_metadata{}` (backend
`report_models/content.py`, extra=forbid). **Found & fixed this step:**
Studio's rehydrate (`Studio.jsx`, seeding effect) kept only `text`, and
`buildReportContent` rebuilt sections from prose alone — the first autosave
PUT would have silently destroyed extractor metadata and confirmed codes.
Both now round-trip via the `sectionMeta` map (see §4).

**Draft-save path (every renderer's write path).**
`Studio.jsx` → `saveDraft()` (serialized, 5 s-paced, 429/409-silent — see
memory of the autosave sprint) → `updateReport`/`createReport`
(`src/api/reports.js`) → `buildReportContent()` → `PUT
/v1/reports/{id}/draft` with `expected_version`. **The one-save-path rule is
encoded:** typed writes are patches merged by `onSectionMetaChange`
(Studio.jsx) into `sectionMeta`, which marks the draft dirty and rides the
same autosave PUT. The helper builders live in
`src/reports/fieldContract.js` (`confirmChoice`, `overrideChoice`,
`overrideMultiChoice`, `confirmDiagnosis`, `removeDiagnosisCode`).

**Finalize + 422 surface (step 06 extends).** `finalizeReport()`
(`src/api/reports.js`) already lifts top-level `problem.problems` onto
`err.problems`. The violation payload `{field, code, detail, section_key,
reason}` and the six codes are pinned in `fieldContract.js`
(`FINALIZE_VIOLATION_CODES`, `violationsBySection` — groups per section,
keeps unknown codes for forward-compat). Studio currently renders finalize
errors as a toast; step 06 replaces that with the per-section surface.

**WS operation handler (step 07 extends).** Sprint-05 channel:
`src/dictation/wsClient.js` → `final.operations[]` →
`applyOperations(operations, ctx)` in `src/dictation/operations.js`, where
`ctx` is the narrow editor adapter Studio supplies. Step 07 adds the four
ops (`VOICE_FIELD_OPS` pinned in `fieldContract.js`) as new `switch` cases
calling the typed helpers with `source:"manual"` semantics; unresolvable →
`arg.reason` ∈ `VOICE_OP_FAIL_REASONS`. Missing `operations` = NLP
downgraded (existing rule, unchanged).

**i18n.** `useI18n()`/`tr(lang, uk, en)` from `src/i18n.js`; STRINGS
registry + en fallback (8 languages). Renderers take `lang` and use `tr`.

**Env.** `.env.example` already carries `VITE_REPORT_SERVICE_URL`
(:8006) — `/v1/icd10/search`, templates, and reports all live there. ✓

## 3. Backend S13 availability (gate, never mock)

| BE step | Status on `S13` |
|---|---|
| 01 template `options` | **merged** (`template_models/schema.py`) |
| 02 field-metadata contract + write validation | **merged** (`report_models/field_metadata.py`, report-service `content_metadata.py`) |
| 03 `/v1/icd10/search` | **not built** — FE client shipped, gated |
| 04/05 extractor metadata in drafts | **not built** |
| 06 finalize codes | **not built** — parser shipped, gated |
| 07 voice ops | **not built** — names pinned, gated |

## 4. What step 01 shipped (spec §4.2/§4.3 → as-built mapping)

| Spec artifact | As-built |
|---|---|
| `src/features/report-fields/api/types.ts` | `src/reports/fieldContract.js` — field-type registry, per-type metadata parse/validate (`parseFieldMeta`, mirrors backend extra=forbid + source/confidence coupling), `Icd10Code` normalizers + `ICD10_CODE_RE`, finalize-violation pins, voice-op pins, `isProposal`/`confirmMeta` |
| `client.ts` (`searchIcd10`) | `src/api/icd10.js` — `searchIcd10(q, {limit, signal})`, bounds-clamped pure `icd10SearchPath` |
| `client.ts` typed helpers | `fieldContract.js`: `confirmChoice` / `overrideChoice` / `overrideMultiChoice` / `confirmDiagnosis` (MOVES code → `section.icd10`) / `removeDiagnosisCode` — pure patch builders for the one draft-save path |
| `__fixtures__/` | `src/reports/fieldFixtures.js` — validated against the contract module by its own test; a test proves no app code imports it |
| `SectionBody.tsx` dispatch | `src/reports/fieldRegistry.js` (dispatch map; `free_text` unregisterable) + `src/reports/FieldWidgetsLayer.jsx` (portals widgets into section DOM). Prose is NOT a movable component here — it is the TipTap document itself, so "FreeTextBody moved unchanged" is satisfied by **not touching the prose path at all**: free_text and unknown types get no widget mount, and the ProseMirror render is the same code path as pre-S13 for every type |
| Forward-compat fallback | unknown `field_type` → prose renders normally (kind attr is inert), no mount, dev-only `console.warn` once per type (`FieldWidgetsLayer.jsx`); prod silent |
| free_text regression snapshot | `src/reports/sectionDoc.test.js` pins the `bodyToDoc` JSON (the editor's full input — rendering is a pure function of it); `docToBody` round-trip pinned; `reports.content.test.js` pins the autosave payload byte-identical without `section_meta` |

Plus the round-trip fix (not in the spec, forced by the audit):
`buildReportContent({..., section_meta})` emits per-section
`icd10`/`field_specific_metadata` (meta-only sections survive with
`text:""`); Studio holds `sectionMeta` parallel to `body` — seeded on
draft reopen, sent on every create/update, reset on template switch,
mid-save-edit-tracked (`latestSectionMetaRef`).

## 5. Per-step decisions (build vs extend)

- **02 proposal grammar** — build: proposal/confirmed visual language +
  telemetry. Extend: `confirmChoice`/`overrideChoice` already exist;
  Studio's `onSectionMetaChange` is the write seam. Gate: BE 04.
- **03 choice/multi_choice** — build `ChoiceBody`/`MultiChoiceBody` in
  `src/reports/renderers/`, register via `registerFieldRenderer` at module
  init. Options/labels already on Studio sections. Gate: BE 04 for
  extracted proposals (manual-only works now).
- **04 numeric/date** — build renderers; same registration. Gate: BE 05.
- **05 ICD-10 picker** — build picker on `searchIcd10` + the
  `useSuggestions` debounce/cancel pattern; `confirmDiagnosis`/
  `removeDiagnosisCode` are the write ops; prose untouched by
  construction (widgets live outside the ProseMirror content flow).
  Gate: BE 03.
- **06 finalize surface** — extend Studio's finalize error handling using
  `violationsBySection`; per-section anchors via `data-section-id`.
  Gate: BE 06.
- **07 voice ops** — extend `applyOperations` ctx with
  `setChoice/addChoice/removeChoice/markDiagnosisText` implemented via the
  typed helpers; no focus theft (widgets render outside the selection).
  Gate: BE 07.
- **08 E2E** — extend `e2e/` Playwright suites, `RUN_BACKEND_INTEGRATION`
  pattern as in `e2e/autocomplete-live.spec.js`.

## 6. Risk notes

- ProseMirror owns the section DOM; widget mounts are re-appended on every
  editor transaction (same resilience model as the existing `is-active`
  class sync). If a later step needs richer in-flow widgets, revisit with
  a NodeView — but only for typed sections, never free_text.
- No DOM-level test runner exists (no RTL/jsdom); interaction-level
  regression (caret, autocomplete mount) rides the existing Playwright
  suites in step 08. The unit-level guard is the pinned `bodyToDoc` JSON +
  the unregisterable `free_text` renderer.
