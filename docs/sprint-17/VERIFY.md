# Sprint 17 — VERIFY (as run, 2026-08-09)

Every sprint VERIFY item, with the command and its output. Mocked-E2E per repo
convention (live tiers stay env-gated behind `RUN_BACKEND_INTEGRATION=1`).

## Console shell + gating + MFA routing

`npx playwright test e2e/admin-console.spec.js` → **7 passed (19.7s)**

- clinician deep-link `/#/admin/users` → ForbiddenPage client-side AND a
  server-403 error card handled;
- auditor sees audit but not users (rail role-filters);
- non-enrolled admin mutation → 403 `mfa_enrolment_required` →
  `/mfa?required=1&return=%2Fadmin%2Fusers` → mocked enrol+verify →
  «Повернутися до перерваної дії» lands back on the roster → the mutation
  succeeds (the return-to mechanism is new: `mfaGrace.mfaEnrolmentRoute`,
  capture in `client.js`, consume in `MfaPage`).

## Templates surface (incl. structural banner + re-bind)

`npx playwright test e2e/admin-templates.spec.js` → **6 passed (14.6s)**

- renaming a section → banner «Косметична зміна — версія не зміниться»;
- removing a section → «СТРУКТУРНА зміна — буде створено нову версію» with
  the reason («Вилучено секції: …») — live, 250 ms debounce, BEFORE save;
- structural save lands a NEW template id in the list with lineage shown
  (chip → ancestor);
- deprecate consequence dialog → 409 (draft-bound) → re-bind panel:
  per-draft confirmed `POST /templates/{id}/rebind` moves the fixture draft
  to the successor (asserted in the successor's bound list) → retry
  deprecate succeeds; finalized reports shown as immutable context;
- `/library/reports` clinician flow regression-green (shared editor).

Backend (report-service): `GET /templates/{id}/bound-reports` +
`POST /templates/{id}/rebind` added (audit kind `template.rebound`;
deprecate in-use check narrowed to draft references — historical
finalized/signed reports no longer block deprecation, matching the dialog
copy). 277 unit tests green.

## Option-list editor

Covered in admin-templates spec: colliding voice alias blocked by the client
mirror inline AND the backend-shaped 422 `errors[]` message renders; a clean
save's PUT body carries `{value, label, voice_aliases}` verbatim (the
extraction side of the fixture rides the existing dictation fixtures).

## Abbreviations / autocomplete / synonyms

`npx playwright test e2e/admin-content.spec.js` → **8 passed (15.7s)**

- PII 422 (exact Python-repr wire shape) → «Ця фраза схожа на персональні
  дані — не збережено» + pattern chips + digit-run caveat;
- abbreviation edit visible in the test box (`POST /nlp/process` sandbox,
  stage toggles A/B via `stages_disabled`);
- synonym group edit changes the live `expanded_terms` probe result;
- system rows badged read-only on all three surfaces; delete consequences
  named; snippets round-trip as `/trigger`.

Backend (autocomplete-service): `GET /autocomplete/phrases` +
`GET /autocomplete/snippets` added (real `impression_count` /
`acceptance_count` / `last_accepted_at`). 89 unit tests green.

## Users & roles

In admin-console spec (above): invite (+409 duplicate email), last-admin
409 «cannot remove the last tenant_admin» rendered as a blocking in-dialog
explanation, role change round-trips and the target's next (fixture) login
boots the changed shell, deactivate/reactivate + MFA reset with consequence
dialogs, MFA-enrolled badges, auditor read-only roster.

## Audit viewer

In admin-console spec: filters (kind/severity/actor/dates/from_seq) compose
into the request query (asserted server-side in the mock); verify-chain
renders OK on the clean fixture and first-divergence detail on the tampered
one; **no export affordance** — asserted in e2e AND pinned by
`src/admin/noAuditExport.test.js` (source-level egress-token guard).

## Full journey (sprint finale)

`npx playwright test e2e/admin-journey.spec.js` → **1 passed (12.0s)** —
admin (unenrolled, MFA-required world) logs in → blocked mutation routes
through MFA enrolment and back → clones a system template → edits its
option list (live banner: cosmetic) → clinician login sees the clone with
the new option in the library → admin's audit trail shows
`auth.mfa.enrolled`, `user.invited`, `template.cloned`, `template.updated`
(derived from the actions the mocks recorded, not canned), kind filter
composes, chain verify OK, zero console errors, no export control.

## Whole-suite regression

- Four admin specs together: **22 passed (31.2s)**.
- `npm run test:unit`: **923 pass, 0 fail** (4 new files registered:
  `mfaGrace`, `noAuditExport`, `problemCode`, `templates.rebind`).
- `npm run build` ✓ · `npm run lint:contracts` ✓ ·
  `npm run auth:permissions -- --check` ✓ (CSV in sync with backend) ·
  `npm run verify:bundle` ✓ (prod bundle CSP-clean).
- Full e2e sweep: all failures outside the admin family were
  **diagnosed as pre-existing** (verified per-test): 4 × `auth.spec.js`
  fail at HEAD (e.g. `.tenant-badge` rendered nowhere at HEAD; 401-refresh
  double-count reproduces with the sprint-17 client.js lines disabled);
  `evidence-quicksearch` = `EADDRINUSE 127.0.0.1:8013` (the user's real
  evidence stack was running in Docker); 6 × `search-expansion` assert the
  S15 «Звіти» heading that the uncommitted S16 tree replaced with
  «Документи». `company-console`, `patients-directory`,
  `studio-autocomplete` pass in isolation (parallel-load flakiness).
  Zero sprint-17 regressions.

## Backend gates (medical-dictation-backend)

`make lint` ✓ (ruff, all packages) · `make lint-imports` ✓ (18/18 contracts
kept) · grep gates `check-no-os-environ` / `check-no-direct-asyncpg` /
`check-audit-insert` (703 files) / `check-no-object-storage` /
`check-no-crypto` ✓ · unit: autocomplete-service **89 passed**,
report-service **277 passed** (23 new re-bind tests) · `make openapi-dump`
regenerated `autocomplete-service` / `report-service` (+ pre-existing S16
`auth-service` drift refreshed consistently).

## Deliberately not done (filed in todo.md «Backend asks — sprint 17»)

draft→active status transition; machine codes for autocomplete dict-detail
errors; `POST /templates/validate` dry-run; `GET /templates` cursor;
users-list filters/total; audit kind prefix-match; synonyms pagination;
`last_accepted_at` ask (implemented ahead of the ask). Voice-command
per-tenant overrides are a named future backend feature (migration 0011's
own comment); the console ships the read-only reference +
template-option `voice_aliases` as the editable voice surface.
