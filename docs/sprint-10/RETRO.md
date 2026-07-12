# FE Sprint 10 — Retro (short)

**What worked**

- Pinning the as-built backend contract from source (step 01) caught four
  spec-vs-reality conflicts *before* code was written against the sketch
  (`.бп` triggers, `shown_only` ids, blur-reject, `context` shape) — the
  exact failure mode the sprint doc warned about.
- Two-tier E2E (hermetic mocks enforcing the wire contract + a gated live
  suite with SQL telemetry asserts) kept CI green while still proving
  auth/CORS/timing/joins against the real stack.
- The "typing always wins" rules composed cleanly because they live in
  three small seams: the plugin's `apply` (any divergence clears), the
  hook's budget/backoff, and the sink's fire-and-forget queue.

**What bit us**

- The inline ghost lives inside the editor's DOM → `innerText` assertions
  see ghost text; tests must strip `.autocomplete-ghost` before
  not-contains checks. Documented in memory + spec comments.
- Dev-stack sharp edges cost real time: auth-service wedges with
  `httpx.PoolTimeout` while `/readyz` stays green (fix: container
  restart); the dev refresh cookie doesn't survive reload cross-origin,
  so "session reuse" recovery paths must re-login; dictation-service
  lacks CORS → console noise on every Studio mount.
- Playwright's default 30 s test budget is too small for a chaos case
  that docker-restarts a service — set per-test timeouts explicitly.

**Would do differently**

- Write the live-suite selectors against a single-section template from
  the start; the six-section surgery template made blind caret clicks
  land in the wrong section twice.
