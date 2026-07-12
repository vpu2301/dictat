# E2E suites

Two tiers, one runner (Playwright; Vite dev server auto-starts via
`playwright.config.js`):

## Hermetic (CI-safe) — `npm run e2e`

Every backend call is route-mocked inside the specs; no services needed.
`auth.spec.js` (F-02 auth machinery), `studio-autosave.spec.js`,
`studio-templates-auth.spec.js`, `studio-autocomplete.spec.js` (sprint 10
steps 02–05: rendering, keyboard protocol, snippets, telemetry batching,
memo, degraded budget, micro-backoff, master toggle). The autocomplete
mocks enforce the real wire contract (`extra="forbid"`, 80-char prefix) so
a contract regression fails hermetically.

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
