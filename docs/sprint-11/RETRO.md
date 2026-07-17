# FE Sprint 11 — Retro

## What went right

- **Pin the as-built contract first, every step.** Reading the backend
  routers before writing FE code caught the doc-vs-reality gaps early
  (nested withdraw path, DSAR 202, grace-at-approve, `has_ipn`,
  recording rows already in the timeline) and turned three "wait for
  backend" dependencies into "already merged, wire it now".
- **Verify-and-extend beat rebuild.** The existing directory/patient
  page carried real latent bugs (NaN sort on wrong date fields,
  encounter kinds the backend 422s, anamnesis shape) that only surfaced
  because the audit diffed them against the live wire — the sprint's
  cheapest wins.
- **Pure modules for the risky logic** (`feed.js`, `ipn.js`,
  `consentGate.js` predicate, `legalBasis.js`) kept every "one place,
  exported, unit-tested" promise and made the e2e suites thin.
- **Live verification per step** (real stack, real signing, real DSAR
  zip) repeatedly caught what mocks can't: the master-key mode rule,
  the KEK/master-key pairing, the grace-days refusal path.

## What dragged

- **Environment archaeology.** Host-running services needed
  undocumented env (MDX_MASTER_KEY_PATH + 0400 mode,
  SIGNING_DEV_PASSWORD_ENABLED, ERASURE_GRACE_DAYS) — now captured in
  e2e/README.md, but each was found by hitting the failure.
- **Pre-existing auth.spec flakes** cost stash-runs to prove innocence
  twice. A quarantine tag (or fixing them) would have been cheaper.
- **IntersectionObserver auto-fire** on short lists invalidated naive
  e2e request-counting; the "filter query-bearing requests" pattern is
  now established, but it cost a red run.

## Carry-overs (owners in SIGN-OFF / todo.md)

1. Backend consent enforcement in dictation-service (the sprint's known
   gap — client-enforced today, stated).
2. Backend asks 1–3 (encounter PATCH, report encounter_id, erasure
   report exposure).
3. Legal copy review — blocking for pilot.
4. auth.spec repair.
5. Diia QR signing for consents (reuse of the S09 QR flow).

## Numbers

7 steps, 7 commits, ~4.1k insertions. Unit suite 26 → 55 tests; e2e
12 → 34 hermetic cases + 2 gated live suites; 3 named backend asks; 0
mock data in app code.
