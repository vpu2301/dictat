# ADR 0002 — Per-service base URLs (split the "core" monolith)

- **Status:** Accepted
- **Date:** 2026-06-20
- **Context:** Backend integration guide `medical-dictation-frontend-integration.md` §1, §3
- **Deciders:** Frontend lead
- **Supersedes:** —

## Context

The SPA's `src/api/services.js` modelled the backend as five services, with a
single **`core` service on `:8003`** standing in for reports, templates,
signing, and the clinical/EHR endpoints. The authoritative backend integration
guide (2026-06-20) shows the platform is split differently:

| Concern        | SPA assumed            | Actual backend (guide §1, §3)          |
|----------------|------------------------|----------------------------------------|
| Reports        | `core:8003` `/reports` | `report-service:8006` `/v1/reports`    |
| Templates      | `core:8003` `/templates` | `report-service:8006` `/templates`   |
| Autocomplete   | `nlp:8005` `/nlp/suggest` | `autocomplete-service:8007` `/autocomplete/suggest` |
| Signing/verify | `core:8003` `/signing`, `/verify` | `signing-service:8008` `/signing/sessions`, `/verify/{token}` |

Because of the mismatch, every post-login call from the deployed SPA hit the
wrong port/prefix (compounding the backend CORS gap described in guide §6) — the
"after login nothing happens" symptom.

## Decision

Add three first-class services to `SERVICES` — `report` (8006),
`autocomplete` (8007), `signing` (8008) — and repoint the corresponding API
modules:

- `api/reports.js` → `report` service, `/v1/reports` prefix, with the documented
  lifecycle endpoints (draft autosave, finalize, revert-to-draft, cancel, amend,
  sign, diff).
- `api/templates.js` → `report` service, `/templates`.
- `api/signing.js` → `signing` service: `POST /signing/sessions`, plus the
  **public** `GET /verify/{token}` and `/verify/{token}/pdf`. The unsigned PDF
  for local KEP comes from the report-service (document owner).
- `api/autocomplete.js` (new) → `autocomplete` service: `/autocomplete/suggest`,
  `/phrases`, `/telemetry`. `AutocompletePanel` imports from here; the stale
  `/nlp/suggest` call was removed.

Exported function names/signatures are unchanged, so UI consumers (`Reports`,
`Studio`, `NoteEditor`, `SigningFlow`, `VerifyPage`, …) keep working.

The legacy `core:8003` base is **retained** only for endpoints not yet covered
by the guide (patients, encounters, consents, anamnesis, clinical notes,
scribe). When those land in the contract they move to their real services.

Each new URL reads from a `VITE_*_SERVICE_URL` env var (with the guide's shorter
`VITE_*_URL` accepted as a fallback). In production all URLs point at the single
same-origin gateway (guide §7), which removes cross-origin CORS/cookie issues.

## Consequences

- The deployed SPA reaches the correct services once they send CORS headers
  (backend guide §6, separate `~/Desktop/dictate` repo) or sit behind the §7
  gateway.
- Version-history helpers (`listReportVersions` / `getReportVersion`) are routed
  to the report-service under `/v1/reports/{id}/versions`; if the backend only
  ships `/diff`, the diff view falls back to `reportDiff()`.
- Signing-session response shapes (`signing_id`, `status`, `expires_in`,
  `envelope_id`, …) are assumed unchanged from the SPA's prior contract; confirm
  against `report`/`signing` `/openapi.json` when those services are reachable.
