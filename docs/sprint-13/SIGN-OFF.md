# FE Sprint 13 — Sign-off

Typed field renderers, extraction review, ICD-10 picker. Steps 01–08
complete 2026-07-22/23 on branch `S13`. As-built architecture:
`EXPLORE.md`; authoring notes & limitations:
`field-authoring-notes.md`.

## Cumulative VERIFY (final runs, 2026-07-23)

- Unit: `npm run test:unit` — **305 pass / 0 fail** (≈120 added this
  sprint across contract, actions, grammar SSR, renderers, search
  controller, finalize gating, voice ops, fixtures self-validation,
  tripwires).
- Build: `npm run build` — green (the repo's `tsc`/lint equivalent; no
  TS or lint config exists — see EXPLORE.md §1).
- Live E2E `typed-fields.spec.js` (real backend, observe mode):
  **3 passed / 3 gated-skipped**, three consecutive green runs (flake
  gate). SQL asserts on `report_versions.content_jsonb` (manual
  metadata + selections) and the browser-level prose invariant pass.
- Break-detection: mutating the confirm/override write to a non-manual
  source turns the golden-path case red; reverting restores green.
- Full hermetic e2e: 43 passed / 18 skipped; 15 failures in
  auth/studio-autocomplete are ENVIRONMENTAL (identical on a stashed
  pre-S13 tree — hermetic suites vs. the running live stack; noted in
  e2e/README.md).

## Recorded deviations & judgment calls

1. **Diagnosis staging** (per backend, overriding the FE doc's sketch):
   extractor proposals live in `metadata.proposals`; confirmed codes
   live ONLY in `section.icd10`; confirming MOVES the code. The FE
   never invents a code (confirm + pick are the only entry points).
2. **Voice provenance** (step 07): voice-set values render CONFIRMED
   (`source:"manual"`), not proposal-style — a spoken command is an
   explicit clinician act; finalize must not demand re-confirming it.
   Reversible via a style prop.
3. **Confidence as bands** (step 02): low/&lt;0.6/medium/&lt;0.85/high
   as a 3-bar shape meter; the raw percentage exists only on hover.
4. **Multi-choice partial confirm is unrepresentable** (one `source`
   per section): per-chip dismiss shrinks the staged set; per-chip
   confirm = "exactly this value"; subset acceptance = dismiss wrong →
   confirm all. (`field-authoring-notes.md`.)
5. **`date_with_note`**: the note IS `section.text` (metadata carries
   only `{date}`); no second input.
6. **BP compound**: not special-cased; empty field + preserved prose;
   template authors model two sections. (`field-authoring-notes.md`.)
7. **Optimistic-rollback dropped** (step 02): a confirm is an edit like
   typing; failures follow the existing autosave retry/toast semantics.
8. **ARIA**: not a literal radiogroup (nested confirm/dismiss buttons
   forbid it) — labeled groups of native buttons, arrows move focus
   and never select.
9. **SQL asserts** use the S11 docker-psql pattern; API reads
   (`GET /v1/reports/{id}?include_content`) cross-check the same
   content.

## Architectural note (found by E2E, fixed in step 08)

Portaling widgets into ProseMirror-managed DOM is unsound — PM's
DOMObserver parses injected nodes into document CONTENT (chip labels
became body text). Fix: the Section NodeView owns a
`.field-widget-mount` slot outside `contentDOM` with mutations ignored;
the widget layer only finds slots, never creates them, and re-scans on
transactions + a MutationObserver (PM can rebuild a NodeView outside
any transaction, orphaning React's mount — observed live).

## Named backend asks / findings (open)

- `ChoiceOption.exclusive: bool` for `none_known`-style options (FE is
  forward-compat ready; no slug hardcoding).
- **Finalize 500s on a typed-template draft** on the current dev stack
  (probed 2026-07-23, report c7ed8d6d…) — blocks the finalize-gating
  E2E; presumably resolved by BE step 06.
- `diagnosis_not_confirmed` vs `missing_icd10` must BOTH be emitted for
  the distinct-copy UX to reach users.

## Gates still closed (FE ready, waiting on backend)

Extractor metadata (BE 04/05) · finalize codes (BE 06) · voice ops over
WS + the streaming path itself (BE 07; FE registry/ctx/seam wired).

**BE 03 /v1/icd10/search: LIVE as of 2026-07-23** — after fixing a
search bug found via a user report: the shared ranking SQL used
`plainto_tsquery` (whole-word matching), so every mid-typing query
(«гіперт», «стенокард») returned nothing — the picker looked dead.
Fixed in backend `libs/db/src/db/icd10_query.py` (per-lexeme prefix
tsquery, quote-safe for apostrophes), 3 regression tests added, all 17
icd10 tests + the p95 ≤ 50 ms budget green; report-service and
nlp-service images rebuilt/restarted. Verified in-browser: type
«стенокард» → 3 options → pick I20.0 → confirmed chip → persisted to
`section.icd10`, prose intact.
