# FE Sprint 11 · Step 01 — EXPLORE: Stack, Existing-Screen Inventory, Pinned Patient Contract

Audited 2026-07-15 on branch `S11`, against the live backend
(`~/Desktop/dictate/medical-dictation-backend`, also branch `S11`,
core-service on :8003, auth-service on :8000, seeded dev actors).

## 1. Stack audit — assumptions vs reality

| Assumption `[ASSUMED]` | Reality | Consequence |
|---|---|---|
| React 18 + **TypeScript** + Vite | React 18.3 + **plain JavaScript (JSX)** + Vite 6.3 | Spec's `types.ts` → JSDoc'd typedefs in `src/api/patients.js`; no `tsc --noEmit` — the build gate is `npm run build` |
| Vitest + React Testing Library | **Neither exists.** Pure modules unit-test via `node --test` (`npm run test:unit`); UI behavior via Playwright e2e (`npm run e2e`, hermetic `page.route` mocks) | Sprint-11 units follow `src/api/patients.test.js`; screen behavior pins land as e2e in step 07 |
| `src/features/<domain>/api/` layout | One flat file per domain in `src/api/` (`patients.js`, `consents.js`, …) | Contract lives in the existing modules — no new directory tree |
| `VITE_CORE_URL` | As-built name is `VITE_CORE_SERVICE_URL`; `VITE_CORE_URL` now accepted as an alias (`services.js`) | `.env.example` documents both |
| F-02 client + role helper | Confirmed: `src/api/client.js` (`apiAt`: bearer + single-flight refresh, RFC 7807 shaping); role helpers in `src/auth/` (§4) | — |
| TipTap, Playwright | Confirmed (TipTap 3.23, `@playwright/test` 1.61) | — |

Router: hand-rolled **hash router** in `src/App.jsx` (no react-router). No
state library — `useAsync` / `useCursorPages` hooks. i18n: `I18nProvider`
exists (`src/i18n.js`) but the convention in feature code is inline
`lang === "uk" ? … : …` ternaries — patient screens follow that.

## 2. Existing-screen inventory (the backend docstring was right — most of it exists)

Everything below is **real-API and production-shaped**, gated behind the
off-by-default `VITE_FEAT_PATIENTS` flag, and namespaced under `/scribe/*`
(there is no top-level `/patients` route).

| Surface | Status | Where |
|---|---|---|
| Patient directory (roster, server search, create, pagination) | **exists** | `ScribePatients`, `src/components/Scribe.jsx:503`; route `#/scribe/patients` (`App.jsx:215`) |
| Patient **edit / archive** UI | **absent** | no call site for `PUT /patients/{id}` existed before this step |
| ІПН capture / search / `has_ipn` badge | **absent** | client support added this step; UI is step 02 |
| Patient page + merged timeline | **exists** | `EnhancedScribePatient`, `src/components/PatientProfile.jsx:369`; 6 tabs (timeline/notes/reports/anamnesis/conversations/consents), 6 parallel `useAsync` loads, date-grouped merge; route `#/scribe/patients/:id` |
| Encounter create | **exists** (modal on patient page) | `EncounterModal` → `createEncounter` (`PatientProfile.jsx:440`) |
| Consent capture screen | **exists, not enforced** | `ConsentScreen`, `src/components/ConsentFlow.jsx:183`; route `#/scribe/consent/new?patient=`; grants then redirects with `&consented=1` — **nothing checks that flag** |
| Consent withdraw UI | **exists** | `WithdrawalModal`, `ConsentFlow.jsx:342` |
| Per-patient DSAR / erasure modals | **exists** | `DsarModal` / 3-step `EraseModal`, `PatientProfile.jsx:75-269` |
| Tenant-wide privacy **admin queue / two-person workflow UI** | **absent** | no route, no page, no `privacy.approve` gating anywhere |
| Signing dialog (S09/S10, reused by step 05) | **exists** | `src/components/SigningFlow.jsx` (Дія QR poll + local KEP file flow), launched from `ReportPreview` in Studio |
| Admin area shell (step 06 mounts here) | **exists** | role-gated routes `/admin/users`, `/tenant/*`, `/audit/*` in `App.jsx`; company-admin FE counterparts (`TenantMembersPage`, `TenantSettingsPage`) confirm the pattern |
| E2E for any of the above | **absent** | `e2e/` covers auth/studio/autocomplete only |

## 3. Recording-flow seams (where the consent gate and encounter_id insert)

- **Studio Patient Gate** already blocks the editor until a patient is
  chosen: `PatientGate`, `src/components/Studio.jsx:880-970`;
  `effectivePatientId = patientId || reportReq.data?.patient_id`
  (`Studio.jsx:989`).
- **WS `start_session` composer**: `msgStartSession`,
  `src/dictation/wsClient.js:57-71` — **already accepts `encounterId`** and
  puts `encounter_id` on the wire. However `DictationWsClient`
  (`wsClient.js:120`) is **never instantiated** — `wsClientRef`
  (`Studio.jsx:1068`) stays null and recording runs on the Web-Speech
  fallback (`useSpeechRecognition`, `Studio.jsx:118`). Step 04 therefore has
  two insertion points: pass `encounterId` when the WS client is connected,
  and carry `encounter_id` on the report envelope for the fallback path.
- **Entry links** into recording pass only `?patient=`:
  patient page → `#/dictate/studio?patient=…` and
  `#/scribe/consult/new?patient=…` (`PatientProfile.jsx:517-528`). No
  `encounter_id` flows today; `ScribeConsult` (`Scribe.jsx:603`) is a
  read-only viewer, not a recording surface.

## 4. Role-gating helper — exact API

- `useAuth()` → `{ state: { claims, dbUser }, setState, clear }`;
  `useClaims()`; `hasAnyRole(claims, roles)` — `src/auth/AuthContext.jsx:21-29`.
  `claims.roles: string[]`; roles in play: `clinician`, `nurse`, `auditor`,
  `tenant_admin`, `super_admin`. `tenant_admin` IS cleanly exposed (used by
  existing `/admin` + `/tenant` routes) — no fix needed for step 06.
- Guards: `RequireAuth`, `RequireRole({ any })` — `src/auth/RequireRole.jsx`.
- Fine-grained: `usePermission(action, target_kind)` / `isAllowed` —
  `src/auth/permissions.js`. The matrix has `patients.read` but **no
  `patient.write`-, `patient.dsar`- or `privacy.approve`-equivalent entries**
  → extending the matrix is in scope for steps 02/06 (server scopes:
  `patient.read`, `patient.write`, `patient.dsar`, `privacy.approve`,
  `note.read`, `note.write`).

## 5. As-built contract deltas worth pinning (vs the sprint-doc sketch)

Verified live this step (fixtures in `src/api/patients.fixtures.js`):

- `PatientOut` carries **`has_ipn`**; the raw ІПН is never echoed. `POST`/`PUT`
  accept `ipn` (`""` clears, absent = unchanged). An ІПН-shaped `query=`
  auto-dispatches to exact HMAC lookup — no separate search endpoint.
- **Archive = `PUT {status:"inactive"}`** — no archive route. `status:"erased"`
  is engine-only: 422 `code=status_immutable_erased`.
- Consent **withdraw is nested**: `POST /patients/{pid}/consents/{cid}/withdraw`
  (no top-level `/consents/{id}/withdraw`). Create with `method:"digital"`
  returns a `signing` hint `{resource_type:"consent", resource_id,
  resource_version_id, canonical_hash_hex}`; sign via
  `POST …/consents/{cid}/sign` (providers `file_key|dev_password|diia`).
- **DSAR returns 202** (not 201), already `status:"executing"`, scope
  **`patient.dsar`** (tenant_admin). Erasure `POST` → 201 `status:"requested"`,
  `scheduled_for:null` — the 7-day grace window is set at **approve** time by a
  second person with `privacy.approve` (403 `code=two_person_rule` if
  approver == requester). Admin queue exists: `GET /privacy-requests?status=&kind=`,
  `GET /privacy-requests/{id}` (+ `/download` zip, 14-day TTL).
- Timeline returns `dictate` **and `recording`** rows (recordings landed in
  BE S11 step 02 — metadata only, no media URL); encounters/notes/consents are
  merged client-side. `kind:"scribe"` rows are still stubbed backend-side.
- Everything is `extra="forbid"` (verified: unknown `PUT` key → 422), errors
  are RFC 9457 problem+json with a machine `code` member.

## 6. Contract module delivered this step

| File | What |
|---|---|
| `src/api/patients.js` | JSDoc-typed contract: `PatientOut`/`TimelineItem` typedefs; strict pickers `patientCreateBody`/`patientUpdateBody` (extra="forbid"-safe); **new `updatePatient`** (archive = `{status:"inactive"}`); `listPatients` (+`includeErased`); `toPage`/`patientsPageFetcher` for `useCursorPages`; PII primitives `displayName(patient, lang)` and `yearOfBirth(patient)` — the ONLY DOB derivative lists may render |
| `src/api/consents.js`, `src/api/privacy.js`, `src/api/encounters.js` | comments re-pinned to the as-built wire (nested withdraw, 202 DSAR, two-person semantics, encounter `status` in the create allow-list) — no endpoint stubs added (mandate); step-06 fns land with their UI |
| `src/api/patients.fixtures.js` | real-response fixtures with curl provenance (tests/mocks only — never imported by app code) |
| `src/api/patients.test.js` | units: strict-key serialization, `displayName`/`yearOfBirth`, page adapter (`npm run test:unit`) |
| `src/api/patients.contract.int.test.js` | gated smoke (`npm run verify:patients-contract`, `RUN_BACKEND_INTEGRATION=1`) |
| `package.json`, `.env.example`, `src/api/services.js` | script wiring + `VITE_CORE_URL` alias |

## 7. Per-step decisions: build vs verify-and-extend

| Step | Decision | The gap to close |
|---|---|---|
| 02 Directory | **verify-and-extend** `ScribePatients` | add edit + archive (PUT), ІПН field on create/edit + `has_ipn` chip, ІПН-aware search hint; PII pass: rows show name + `yearOfBirth()` only |
| 03 Patient page | **verify-and-extend** `EnhancedScribePatient` | render timeline `recording` rows, deep-linkable tabs, header uses `displayName` |
| 04 Encounter → dictation | **build** the linkage | start-encounter action → carry `encounter_id` into `#/dictate/studio` and the WS `start_session` (composer already accepts it); decide fallback-path carrier (report envelope) |
| 05 Consent gate | **build** enforcement, reuse capture | hard gate in front of recording (Studio + consult), `digital` → existing `SigningFlow`, withdraw stays |
| 06 Privacy admin | **build** (backend is fully ready) | admin queue page under the existing role-gated shell, two-person mirroring, execution-report rendering; extend `permissions.js`; add step-06 client fns to `privacy.js` |
| 07 E2E | **build** | person→encounter→consent→recording→report + PII-hygiene proof, hermetic `page.route` pattern |

## 8. VERIFY output (2026-07-15)

```
$ npm run test:unit          # includes the 6 new patient contract units
ℹ tests 26  ℹ pass 26  ℹ fail 0

✔ patientCreateBody: picks only PatientCreate keys, drops unknowns and undefined
✔ patientCreateBody: minimal input serializes to name only
✔ patientUpdateBody: undefined = key absent (unchanged); empty string ipn survives (= clear)
✔ displayName: prefers the UI language, falls back across uk/en, trims blanks
✔ yearOfBirth: the only DOB derivative — year or null, never the date
✔ toPage: adapts { items, next_cursor } to useCursorPages' shape

$ npm run verify:patients-contract   # live core-service :8003, branch S11
✔ patient lifecycle: create → list finds it via query= → empty timeline → archive (418ms)
✔ consent lifecycle on an encounter: grant verbal → withdraw via the NESTED path (306ms)
ℹ tests 2  ℹ pass 2  ℹ fail 0

$ npm run build
✓ built in 1.75s
```
