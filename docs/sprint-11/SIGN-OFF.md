# FE Sprint 11 — Sign-off

Branch `S11`, steps 01–07, 2026-07-15 → 2026-07-16. Backend: branch
`S11` of `medical-dictation-backend` (all S11 backend steps found
merged — every "BE-pending" dependency in the sprint doc was already
as-built; nothing was feature-gated off).

## Delivered

| Step | Commit | Delivered |
|---|---|---|
| 01 | `9e8ddb3` | inventory (docs/sprint-11/EXPLORE.md), pinned patient contract (JSDoc'd `src/api/patients.js`), real fixtures, gated live smoke, `displayName`/`yearOfBirth` PII primitives |
| 02 | `44e8ed7` | PatientDirectory: debounced cancel-safe search, cursor append, create/edit/archive, ІПН field+search (checksum shared vectors), PII-hygiene e2e, telemetry-import tripwire |
| 03 | `05b4589` | patient page: identity header (has_ipn badge), merged feed as pure `src/patients/feed.js` (recordings incl.), per-source error isolation, `?tab=` enum deep links, back-restore |
| 04 | `8f05af5` | Почати прийом → encounter `in_progress` → studio with context bar (name+yob only) + wrong-patient escape; WS `start_session` provably carries `encounter_id`; encounter-invalid/closed recovery; retro-logging |
| 05 | `b850a20` | consent gate (fail-closed, re-check every start) + capture sheet + КЕП sign dialog (file_key + dev provider) + withdraw management |
| 06 | `4c270a7` | /admin/privacy queue (two-person mirror), full-screen erasure request («ВИДАЛЕННЯ»), verbatim ExecutionReport + legal-basis map, DSAR download lifecycle |
| 07 | this commit | live person→report + privacy E2E suites, PII sweep (mutation-checked), e2e README, sprint records |

## Step-01 inventory resolutions (assumptions → reality)

- Stack is **plain JS** (JSDoc, `npm run build` gate), **no Vitest/RTL**
  (units = `node --test`; UI proof = Playwright), api modules flat in
  `src/api/` — every "`.ts`/`tsc`" item in the sprint doc mapped
  accordingly.
- Most patient UI already existed (directory, patient page, consent
  screen, DSAR/erase modals) — steps 02/03 were verify-and-extend; the
  audit found real wire bugs in the existing code (NaN timeline sort on
  `e.date`/`c.date`, encounter kinds outside the backend enum, anamnesis
  shape) which are fixed and test-pinned.
- No source endpoint paginates timeline/encounters/notes/consents — the
  spec'd k-way cursor merge has nothing to attach to; the merge is one
  pure module (`feed.js`) with windowed rendering, documented for the day
  cursors appear.

## HONESTY NOTE — client-enforced consent (carry-over)

The backend does **not** reject a dictation session for missing consent.
The consent gate is **client-enforced policy**: fail-closed, re-checked
before every recording start, with no override UI (there is no backend
override to audit). **Named carry-over for the backend team: a
dictation-service consent check.** Until it lands, the pilot's
clinicians are the trusted operators — stated here, not hidden.

## Named backend asks (all recorded in ~/Desktop/dictat-s11-encounter-backend-asks.md)

1. `PATCH /encounters/{id}` (status) — encounters currently stay
   `in_progress` honestly; no fake client-side completion.
2. `encounter_id` on report create (`CreateReportRequest` is
   `extra="forbid"` without it) — reports reach the timeline via
   `patient_id` only.
3. `GET /privacy-requests/{id}` exposes `report_of_execution` for DSAR
   only — completed erasures render an honest "звіт ще не публікується
   API" note; the verbatim renderer is fixture-proven and wired.
4. (Step 05 carry-overs, todo.md): backend consent enforcement; Diia QR
   flow for consent signing.

## Legal-copy review (BLOCKING for pilot — todo.md, owners assigned)

All consent-gate, withdraw-consequences, erasure-consequences, DSAR
package-contents and execution-report strings are flagged in `todo.md`
for DPO + clinic-lead review. The legal-basis→text map
(`src/patients/legalBasis.js`) is locked to the backend's `BASIS_*` set
by a unit test; unknown bases render raw — never hidden.

## Deliberate deviations / decisions

- Consent gate applies whenever a **patient** is resolved (not only in
  encounter context) — otherwise ad-hoc entry would bypass a legal gate.
- Roster search state never syncs to the URL (no shareable searches) —
  the privacy call the sprint doc names; may surprise users.
- E2E recording substitution: the local stack has no dictation-/ASR
  service, so the golden path "records" via the studio's real editing
  affordance; the WS `encounter_id` contract is unit-tested and the
  `audio_files.encounter_id` join was SQL-proven in step 04
  (e2e/README.md documents this).
- Two-person E2E uses clinician-requester + admin-approver (the seed
  ships one admin per tenant); the mirror case uses the admin's own
  request. The invite flow was not used to mint a second admin.

## PII-hygiene DoD

Lists render name + year of birth only (`yearOfBirth` is the single DOB
derivative); routes carry opaque UUIDs (+ the closed `?tab=` enum);
nothing patient-derived touches storage or telemetry — proven by the
step-02/03 hermetic suites and the step-07 live sweep whose scanner is
mutation-checked (`e2e/helpers/pii.test.js`).

## Known issues at close

- `e2e/auth.spec.js`: 2–3 tests fail/flake on the CLEAN tree (demo
  journey, single-flight, tenant_admin nav) — pre-existing environment
  breakage, verified by stash-runs during steps 02/05; not S11 scope
  but should be fixed before the next auth-touching sprint.
- Erasure execution report over HTTP blocked on backend ask #3.
