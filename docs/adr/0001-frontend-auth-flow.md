# ADR 0001 — Frontend auth flow: server-side proxy (Option A)

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context sprint:** F-02 (Frontend Auth Integration) §2.1
- **Deciders:** Frontend lead, security lead
- **Supersedes:** —

## Context

Backend sprint-02 exposes identity through two reachable surfaces:

- **`auth-service`** (`/auth/login|refresh|logout`, `/auth/me`) — performs
  the Keycloak password grant server-side and sets an HttpOnly refresh
  cookie (`mdx_rt`, path `/auth`). Access tokens are RS256, audience
  `mdx-api`, carrying `tid` + `roles`.
- **Keycloak `mdx-frontend` client** (PKCE) — the standard browser
  auth-code + PKCE redirect flow.

F-02 §2.1 requires us to pick exactly one and record it as an ADR. The
two candidates:

- **Option A — server-side proxy.** The SPA posts credentials to
  `auth-service /auth/login`; auth-service does the Keycloak grant and
  sets the HttpOnly cookie. The browser never talks to Keycloak.
- **Option B — PKCE standard flow.** The SPA talks to Keycloak directly
  and handles the auth-code redirect.

## Decision

**We use Option A (server-side proxy) for the pilot.**

The token-handling rules (F-02 §2.2) are identical under either option,
so this decision is reversible at the edges without touching the API
client or auth context:

- Access token kept **in memory only** (`src/api/client.js`
  `inMemoryAccessToken`) — never `localStorage`/`sessionStorage`.
- Refresh via the **HttpOnly `mdx_rt` cookie** (`credentials: "include"`),
  not JavaScript.
- On boot/hard-refresh: one `POST /auth/refresh`
  (`src/auth/RootGate.jsx`).
- On any API 401: **single-flight** refresh then retry-once
  (`src/api/client.js` `refreshOnce()` / `request()`).

## Rationale

1. **Smaller browser attack surface.** No PKCE verifier, no token
   exchange, no auth-code in the URL. The XSS/CSRF reasoning in the
   backend threat model (access token in memory, refresh in HttpOnly
   cookie) holds with fewer moving parts in untrusted JS.
2. **Simpler CSP.** No redirect to a Keycloak origin in the critical
   login path, so the eventual CSP hardening pass (backend threat-model
   ~sprint-16) has fewer origins to allow.
3. **Already implemented and verified.** `src/api/endpoints.js`
   (`login` posts `application/x-www-form-urlencoded`) and
   `src/api/client.js` implement Option A, and the live-backend contract
   harness `scripts/integration/batch-a-verify.mjs` (`npm run
   verify:batch-a`) exercises it end-to-end against the seeded realm.
4. **Reversibility.** If federation (social / enterprise IdP) is needed
   later, Option B is a drop-in at the login boundary — the in-memory
   token + single-flight refresh + auth context are flow-agnostic.

## Consequences

- **Positive:** minimal JS-side auth machinery; pure-cookie refresh;
  CSP stays simple; matches the already-shipped code and its verifier.
- **Negative / deferred:** no IdP federation in the pilot (F-02 §9
  out-of-scope). Adopting it later means revisiting the login boundary
  per Option B — the rest of the auth stack is unaffected.
- **Risk F5 (redirect/PKCE needed later)** is mitigated: the token rules
  are identical, so Option B remains a localized future change.
