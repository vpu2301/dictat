# Batch-A Exit Review — Sprint A3 Integration Checkpoint

**Status:** ready for sign-off
**Scope:** A1 (backend foundation) + A2 (SPA shell) + A3 (integration) — Batch A only
**Frontend repo:** `~/Desktop/dictat` (this repo)
**Backend repo:** `~/Desktop/dictate/medical-dictation-backend` (separate)
**Verification harness:** `scripts/integration/batch-a-verify.mjs` (`npm run verify:batch-a`)

> This sprint added **no features**. It wired the existing A1/A2 surface together,
> observed the identity / isolation / audit invariants *through the real contract*,
> and hardened one latent gap found along the way.

---

## 1. What was proven

The first true end-to-end path runs through the real SPA contract against the
real backend: **login → identity from `/auth/me` → admin invite → audit visible**,
with every negative path (403, refresh-replay, cross-tenant) enforced **and
observed on both layers** (SPA route guard + server enforcement).

The SPA↔backend contract is now locked and machine-checked. The harness mirrors
the SPA's exact request shape (`src/api/endpoints.js` + `src/api/client.js`):
form-encoded login, in-memory bearer access token, the `mdx_rt` HttpOnly refresh
cookie, RFC 7807 `application/problem+json` error bodies, and the
`auth_refresh_replay` problem code. A green harness run means the contract the
SPA depends on holds against the live stack.

---

## 2. How to reproduce the demo

Backend (separate repo), one-command dev stack:

```bash
cd ~/Desktop/dictate/medical-dictation-backend
make dev-up && make migrate-up && make run-auth-service   # auth-service on :8000
```

Frontend automated verification (this repo):

```bash
npm run verify:batch-a            # drives all of AC-A3-1 … AC-A3-7 + chain integrity
```

Frontend manual / witnessed walkthrough:

```bash
npm run dev                       # SPA on http://localhost:5173 (in backend CORS allowlist)
# 1. sign in as clinician@tenant-a.example / dev-password → lands on the session list,
#    name + role shown (sourced from /auth/me)
# 2. sign in as admin@tenant-a.example → /admin/users → invite a user → toast
# 3. /audit/events → the user.invited row is visible under tenant A
# 4. as the clinician, /admin/users and /audit/events are blocked by the route guard
```

Seeded actors (Keycloak realm `medical-dictation`, all password `dev-password`):

| Email | Roles | Tenant |
| --- | --- | --- |
| `admin@tenant-a.example` | tenant_admin, clinician | A (`…000a`) |
| `clinician@tenant-a.example` | clinician | A |
| `auditor@tenant-a.example` | auditor | A |
| `nurse@tenant-a.example` | nurse | A |
| `admin@tenant-b.example` | tenant_admin, clinician | B (`…000b`) |
| `clinician@tenant-b.example` | clinician | B |

---

## 3. Acceptance criteria — observed result

Harness run against `http://localhost:8000`: **17 / 17 checks passed, exit 0.**

| AC | Criterion | Result | Evidence (harness check) |
| --- | --- | --- | --- |
| AC-A3-1 | Login → session list → name/role end-to-end | ✅ | `AC-A3-1a/b` — access token in body; `/auth/me` → name `Dev Clinician A`, role `clinician`, tenant A |
| AC-A3-2 | `tenant_admin` invite/deactivate produce correct rows + visible audit events | ✅ | `AC-A3-2a/b` — invite `201 status=invited`; deactivate `200 status=deactivated` |
| AC-A3-3 | Each UI write maps to exactly one audit row | ✅ | `AC-A3-3a/b` — exactly one `user.invited` and one `user.deactivated` row per action (counted) |
| AC-A3-4 | Clinician blocked at route guard **and** server (403 + `authz.denied`) | ✅ | `AC-A3-4a/b/c` — SPA `RequireRole` gates the screens; server returns `403` and emits `authz.denied` (sec) |
| AC-A3-5 | Expiry → silent refresh; replay → clean re-login + audit | ✅ | `AC-A3-5a/b/c` — refresh rotates the cookie; replayed token → `401 code=auth_refresh_replay`; `auth.refresh_replay_detected` (sec) row present |
| AC-A3-6 | Two tenants; A's admin cannot see B's data; API probe confirms isolation | ✅ | `AC-A3-6a/b` — tenant A admin sees **zero** tenant-B rows; tenant B sees its own (isolation, not an empty query) |
| AC-A3-7 | SPA never sends a tenant id; isolation is server-derived | ✅ | `AC-A3-7a/b` — two admins resolve to distinct token-derived tenants; an **injected** `tenant_id` in the invite body is ignored and lands in the caller's tenant |
| — | (A1 reaffirm) audit chain integrity through the API | ✅ | `AC-A1-chain` — `GET /audit/verify` → `ok:true`, chain intact |
| AC-A3-8 | This exit-review doc + demo captured + sign-offs | ✅ (doc) | this file; sign-offs in §6 |

---

## 4. Layer-agreement findings & hardening

The expected risk (§6 of the spec) was **SPA guard vs server enforcement
disagreement**. None found at the gate boundary: every screen the SPA guard
blocks for a clinician is also `403`+audited by the server, and every screen it
allows for an admin succeeds. Two integration findings, both resolved here:

1. **`WWW-Authenticate` not surfaced to the SPA (fixed in this sprint).**
   `LoginPage.jsx` detects an MFA/step-up challenge via
   `err.problem.www_authenticate`, but `client.js` only parsed the JSON body —
   the challenge arrives in the CORS-exposed `WWW-Authenticate` **header**, so the
   branch was dead. `src/api/client.js` now copies that header onto the problem
   object. MFA is off by pilot policy, so this is latent until MFA is re-enabled,
   but the wiring is now correct.

2. **Replay-code content-type (harness only, no product change).** The replay
   `401` body is `application/problem+json`. The SPA's `client.js` parses every
   response with `r.json()` regardless of content-type, so it reads
   `problem.code` correctly. The first harness draft over-restricted its parse to
   `application/json` and produced a false negative; the harness now accepts any
   `*+json`. **No frontend defect** — the product contract was correct; this is
   recorded because it is exactly the kind of false-confidence a checkpoint exists
   to catch.

Confirmed-good invariants (no change needed):
- Access token lives **in module memory only** (`src/api/client.js`), never
  `localStorage`/`sessionStorage`. The `mdx_rt` cookie is HttpOnly, path `/auth`.
- Boot-time session restore (`src/auth/RootGate.jsx`) does one `POST /auth/refresh`
  then `/auth/me`, so a page reload keeps the session without persisting the token.
- 401 on any authed call triggers a single silent `refreshOnce()` + retry; a
  replay trips a hard `replayDetected` lock that forces re-login.
- No SPA request wrapper sends a tenant id (verified statically and by probe).

---

## 5. Carry-over tickets (do not block Batch B)

- **CO-1 — MFA end-to-end.** Header surfacing is fixed; the enrollment + challenge
  flow remains gated off by pilot policy (`VITE_FEAT_MFA_ENROLMENT=false`). Verify
  end-to-end when MFA is switched on.
- **CO-2 — No `GET /admin/users` (by design in Batch A).** `AdminUsersPage`
  shows a local optimistic "recent actions" list and points to the audit log as
  the system of record. A real tenant directory endpoint is a Batch-B item; until
  then AC-A3-2's "row appears" is evidenced via the `user.invited` audit row.
- **CO-3 — Proactive refresh.** Refresh is reactive (on 401). Optional: refresh
  slightly before `expires_in` to avoid a one-request latency bump on expiry.

---

## 6. Sign-offs

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Tech lead | _________ | ☐ approve | |
| Frontend lead | _________ | ☐ approve | |
| Security lead | _________ | ☐ approve | |
| DPO | _________ | ☐ approve | |
| SRE | _________ | ☐ approve | |

**Demo capture:** _attach recording link or live-walkthrough date_

On all approvals, **Batch B is formally open.**
