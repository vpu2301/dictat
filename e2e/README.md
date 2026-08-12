# E2E suites

Two tiers, one runner (Playwright). `playwright.config.js` starts TWO servers:
the Vite **dev** server on :5173, which almost every spec drives, and a
**preview** server on :4173 serving the production build with the production
security headers, which only `csp.spec.js` drives (sprint 16 — the dev server
has to hand Vite a nonce for its own injected tags, so "zero CSP violations"
there would prove a weaker policy than the one a clinic runs).

## Hermetic (CI-safe) — `npm run e2e`

Every backend call is route-mocked inside the specs; no services needed.
`auth.spec.js` (F-02 auth machinery), `studio-autosave.spec.js`,
`studio-templates-auth.spec.js`, `studio-autocomplete.spec.js` (sprint 10
steps 02–05: rendering, keyboard protocol, snippets, telemetry batching,
memo, degraded budget, micro-backoff, master toggle). The autocomplete
mocks enforce the real wire contract (`extra="forbid"`, 80-char prefix) so
a contract regression fails hermetically.

Sprint 16 adds three:

- `csp.spec.js` — the production artifact under the ENFORCED policy. Asserts
  the header itself, then exercises everything the policy could break (login,
  both WebSockets, blob audio, a blob PDF download, the MFA QR canvas, the
  Swagger iframe, the self-hosted fonts) with the violation log asserted empty.
- `mfa.spec.js` — TOTP enrolment and the login second step. The codes are the
  real RFC 6238 computation over RFC 4226's test-vector secret, so the fixture
  accepts only the code an authenticator app would show. Includes the
  assertion that the enrolment secret never reaches storage, the URL or the
  console.
- `session-revocation.spec.js` — a session killed before its token expires
  (ADR-0040). Drives a real recording over a routed WebSocket, revokes
  mid-consultation, and asserts the IndexedDB ring survives and the next
  sign-in offers it back — including that restoring RESUMES the old session
  and replays the preserved frames.

## Live (backend required) — `npm run e2e:live` / `e2e:live:chaos`

`autocomplete-live.spec.js` — sprint 10 step 06. Drives the REAL backend:
UI login as the seeded clinician, real suggest/telemetry over CORS, and
telemetry rows asserted via SQL against the dockerized postgres
(`autocomplete_telemetry`, scoped per-run by `created_at`). `page.route`
is never used — the network is only observed.

Prerequisites (backend repo `~/Desktop/dictate/medical-dictation-backend`):

```bash
make dev-up && make migrate-up && make seed
# services used: auth :8000, core :8003, report :8006, autocomplete :8007
# (the dev docker-compose stack runs them all)
```

- `npm run e2e:live` — cases 1–3 + 5 (happy path, snippet `/vitals`,
  reject, toggle). Case 4 self-skips with a documented reason.
- `npm run e2e:live:chaos` — adds case 4: docker-stops
  `medical-dictation-autocomplete-service-1` mid-test and restarts it.
  Never run against a stack someone else is using.

Both self-skip entirely when `RUN_BACKEND_INTEGRATION=1` is absent, so
`npm run e2e` stays CI-green without any stack.

Known dev-stack noise (filtered in the live spec, see comment there): the
Studio probes each service's `/readyz` on mount; dictation-service (:8002)
has no CORS headers in the dev stack, which Chromium logs as console
errors unrelated to autocomplete.

## Live — sprint 11 (`npm run e2e:person` / `e2e:privacy`)

| Script | Spec | Gate |
|---|---|---|
| `npm run e2e:person` | `patients.spec.js` — person→report golden path, consent gate block/unblock/re-block, ІПН search, PII sweep, nurse role | `RUN_BACKEND_INTEGRATION=1` |
| `npm run e2e:privacy` | `privacy.spec.js` — two-person erasure incl. REAL execution, DSAR download, role forbidden | + `E2E_PRIVACY=1` |

Stack (host-run services; infra via `make dev-up && make migrate-up && make seed`):

```bash
# auth :8000
make run-auth-service
# core :8003 — BOTH env vars matter:
#  * dev master key (mode 0400) — DSAR export/envelope crypto fails without it
#  * ERASURE_GRACE_DAYS=0 — the privacy spec's execution case; approve stamps
#    scheduled_for=now, otherwise the manual runner refuses (by design)
MDX_MASTER_KEY_PATH=$PWD/infra/dev/master.key ERASURE_GRACE_DAYS=0 \
  uv run --project services/core-service uvicorn core_service.main:app --port 8003
# report :8006
uv run --project services/report-service uvicorn report_service.main:app --port 8006
# signing :8008 (consent КЕП dev provider; only needed for consent-sign flows)
SIGNING_DEV_PASSWORD_ENABLED=true \
  uv run --project services/signing-service uvicorn signing_service.main:app --port 8008
```

Conventions the S11 suites add:

- **Two-person without a second admin:** the seed ships ONE tenant_admin
  per tenant, so the CLINICIAN files erasure requests (`patient.write`)
  and the admin approves as the second person; the "own request has no
  approve controls" mirror uses the admin's own request.
- **Recording substitution:** no dictation-/ASR-service in this stack, so
  "record" = the studio's real dictation-editing affordance (typing) →
  real report autosave. The consent gate guards the same `speech.start()`
  transition; WS `encounter_id` is unit-tested
  (`src/dictation/messages.test.js`); `audio_files.encounter_id` linkage
  was SQL-proven in step 04.
- **Erasure execution** runs the backend's documented manual runner
  (`python -m core_service.erasure.run`) — the scheduler's engine and
  advisory lock; nothing bypasses approval.
- **PII sweep:** `helpers/pii.js` taps every URL/telemetry request in
  observe mode and scans storage; the scanner itself is mutation-checked
  (`helpers/pii.test.js` — it must catch planted leaks). Fixture names
  carry a per-run marker (`Тест-<runid>`) so SQL asserts scope cleanly.
- **Zero console errors** is asserted in every case (uncaught JS +
  `console.error`; browser network-log lines and the :8002 CORS gap are
  the two documented exclusions).

## Sprint 13 — typed fields (`typed-fields.spec.js`)

Stack prerequisites beyond the S11 list: report-service must carry the
S13 template schema (seeded `anamnesis_intake` with `choice`/
`multi_choice` options — probed automatically) and the
field_specific_metadata write validation (BE step 02).

Live-capability gates (each case names its own):

- **Runs today:** manual typed flow (chips → tap → confirmed →
  autosave → SQL assert; prose invariant), free_text regression, voice
  op via the dev seam `window.__mdxStudioOps` (the labeled WS-fixture
  variant — real registry → ctx → model path; spoken-command E2E
  arrives with BE step 07).
- `E2E_EXTRACTOR=1` — extractor golden path (BE steps 04/05).
- `E2E_S13_FINALIZE=1` — finalize gating (BE step 06; probed
  2026-07-23: finalize on a typed draft returns 500 on the current
  stack — reported to backend).
- ICD-10 picker — auto-gates on `GET /v1/icd10/search` (404 today) and
  on the template carrying a `structured_diagnosis` section.

Console-guard exclusions gained one entry: the notification-service
(:8004) is not in the minimal stack; its WS retry logs a browser
connection error handled by the app's backoff.

Note: the HERMETIC suites (auth, studio-autocomplete) assume they own
all routes; running them while the live stack is up produces
environmental failures (verified identical on a pre-S13 tree) — run
them with the backend stopped, or rely on CI.
