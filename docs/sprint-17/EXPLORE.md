# Sprint 17 — EXPLORE (admin console)

## STEP 0 — stack + the console's home

- Stack confirmed: React 18 + Vite 6, plain JS/JSX (no TS in app code; generated
  contract types only), hand-rolled **hash router** in `App.jsx` (no router lib),
  `node --test` unit tests (hand-maintained file list in `package.json`),
  Playwright E2E with **route-mocked** services (live tiers env-gated behind
  `RUN_BACKEND_INTEGRATION=1`).
- **Decision: in-app route-guarded `/admin` area.** The repo structure argues
  *for* it, strongly: `/admin/users` and `/admin/privacy` already exist as
  `RequireRole ["tenant_admin"]` branches in App.jsx; auth, MFA interception,
  the API client, i18n and the table/dialog primitives are all in place. A
  separate build would duplicate all of that and fork the CSP config.
- **Shape: delegated sub-router module** (`src/admin/AdminRoutes.jsx`), the
  proven `EvidenceRoutes` pattern — one branch in App.jsx, the route table,
  crumbs and role gate owned by the module. Not the tab-page pattern: seven
  surfaces with sub-routes outgrow it.
- Route namespace: `/admin/*` is protected-by-default (public allowlist in
  App.jsx doesn't include it). `/templates` is TAKEN by the public marketing
  page; the signed-in library lives at `/library/*`. `/admin/templates` is free.

## What already exists (the sprint table vs. reality)

| Surface | Reality |
|---|---|
| Templates list/clone/edit/deprecate | **~Complete** in `src/components/TemplatesPage.jsx` (1223 lines) at `/library/reports` — filters, `TemplateDetailModal`, `CloneModal`, `DeprecateConfirm`, `TemplateFormModal`+`SectionEditor`, `classifyEdit` confirm at save time. Gaps: lives outside `/admin`; structural warning is a save-time confirm, not a live banner; no re-bind. |
| Option-lists | **Complete** inside `SectionEditor` (value/label/voice_aliases, 2..50 enforced). Options are per-section inside `schema_jsonb` — there is no standalone option-list resource, by design. |
| Abbreviations | API client done (`src/api/nlp.js`); UI exists **only in the platform-owner console** (`src/company/panels/ContentTab.jsx`) — wrong audience, needs a tenant-admin home. |
| Voice commands | **No backend surface at all** (global non-RLS table, loaded at nlp-service startup from seed files; reseed wipes runtime writes). Migration 0011 comment: "Per-tenant overrides come in sprint 17" — i.e. a backend sprint, not this one. FE ships a **read-only reference** (15 intents × uk/en/de) + the one editable voice surface that exists today: template/option `voice_aliases`. |
| Autocomplete phrases/snippets | `createPhrase`/`deletePhrase` exist; **backend has NO list endpoint** — `repository.list_phrases` is implemented and called from nowhere; the trigram index exists with an "Admin search UI" comment. Blocking backend gap. |
| Synonyms | API client + tests done (`src/api/synonyms.js`); UI only in ContentTab (same wrong-audience problem). |
| Users + roles | Split across `AdminUsersPage` (invite/deactivate, roster is a localStorage log — not real), `TenantMembersPage` (real roster but *membership* roles), `AccessReviewPage`. `listUsers`/`setUserRoles`/`reactivateUser` exist in `endpoints.js`; `setUserRoles` has **no caller**. No role-set read-back endpoint (`role` is the collapsed primary). |
| Audit viewer | **Complete**: `/audit/events` (cursor paging, JsonViewer) + `/audit/verify` (gap/mismatch handling). Needs: admin-nav integration, kind/severity/actor/date filters UI, no-export snapshot test. |

## Backend contract highlights (read from as-built code + OpenAPI snapshots)

- Ports: auth :8000, nlp :8005, report :8006 (templates **and** `/v1/synonyms`),
  autocomplete :8007. No gateway; per-service origins, CORS allows :5173/:4173.
- Errors are RFC 9457 `problem+json` everywhere. **One machine code exists**:
  MFA gate 403 carries top-level `"code": "mfa_enrolment_required"` (the client
  interceptor already routes on it). Autocomplete's dict-detail errors
  (`pii_detected`, `phrase_already_exists`, `rate_limited`, `forbidden_scope`)
  arrive as **Python-repr strings** inside `detail` — not JSON-parseable.
- `classify_edit` (backend `libs/template_models/schema.py`) is the authority on
  cosmetic-vs-structural; FE carries a faithful mirror (`classifyEdit` in
  `src/api/templates.js`). STRUCTURAL = code/language change, section add/remove,
  field_type change, required flip, min_chars **increase**, option value
  removed/renamed. Everything else cosmetic. `PUT` returns `{id, kind}` — on
  structural, `id` is the NEW row. `reasons` are computed server-side but not
  returned — the live banner must come from the FE mirror.
- Deprecate → 409 when reports reference the template; detail literally says
  "sprint-17 admin will offer re-bind".
- **Re-bind does not exist server-side.** No endpoint, no repo function; also no
  way to list reports bound to a template (search has no `template_id` filter,
  and `tenant_admin` deliberately lacks `report.read` — PHI separation).
- Users: `GET /admin/users` (offset paging, bare array), invite (roles limited
  to tenant_admin/clinician/nurse/auditor), deactivate/reactivate, `PUT
  /admin/users/{sub}/roles` (multi-role, validated against the wider
  KNOWN_ROLES; last-admin guard → 409 `"cannot remove the last tenant_admin of
  the tenant"`, no machine code). All mutations `requires_mfa()`.
- MFA gating: **only** users/roles/tenants (+ core-service privacy) mutations
  are gated; templates/abbreviations/synonyms/autocomplete are NOT. Both
  `MDX_REQUIRE_MFA` and `MDX_MFA_ENROLMENT_ENABLED` default **off** in dev —
  the 403 path must be exercised in mocked E2E.
- Audit: `GET /audit/events` (cursor=seq, filters: kind exact-match, actor_sub,
  since/until, severity, from_seq/to_seq; **ascending order only**) +
  `GET /audit/verify` (sync full-chain walk; `ok`, `first_divergence_seq`,
  `divergence_reason`, expected/actual hashes). tenant_admin + auditor.
- Abbreviations: merged global+tenant list; `is_tenant_override` badge flag;
  PUT is a silent upsert (204, no id back → re-list after write); tenant row
  wins on collision. Write = tenant_admin only.
- Synonyms: `/v1/synonyms` CRUD, terms 2..12, `uk|en`; system groups visible
  but PUT/DELETE → 404 (deliberate no-oracle); GET has zero params.
- Pagination is four different conventions (seq-cursor / opaque-cursor / offset /
  limit-only bare arrays). The console's table kit must absorb all four.

## The MFA return-to gap

`client.js` intercepts `mfa_enrolment_required` and hash-routes to
`/mfa?required=1` — but MfaPage's done state hardcodes `navigate("/")`. "Routes
to enrolment **and returns after**" needs a `return=` param: capture
`location.hash` in `routeToMfaEnrolment()`, thread it through `mfaGrace.js`,
navigate to it from the done state. Three files, self-contained.

## Blocking backend gaps → additive endpoints this sprint must add (backend repo)

The sprint's own DoD ("re-bind works; every promise kept; no curl") is
unbuildable without two small additive backend changes. The backend's own docs
assign them to sprint-17 (runbook: "until sprint-17 admin UI ships a re-bind
flow"; 409 detail: "sprint-17 admin will offer re-bind"; the unused
`list_phrases` + trigram index comment "Admin search UI"). So they are in
scope, kept minimal and additive:

1. `GET /autocomplete/phrases` + `GET /autocomplete/snippets` — expose the
   already-written repository listing (with `acceptance_count` /
   `impression_count` for the acceptance columns).
2. Re-bind: `GET /templates/{id}/bound-reports` (PHI-free: id/status/dates
   under the admin's own perms) + `POST /templates/{id}/rebind` moving draft
   reports to a successor template, per-draft, audited (`template.rebound`).

Filed as asks (NOT built this sprint — conveniences, not promises):
`draft→active` status transition; `problem_extras` codes for autocomplete
dict-detail errors (FE will tolerate both wire shapes); `POST
/templates/validate` dry-run returning server `reasons[]`; cursor on
`GET /templates`; filters/total on `GET /admin/users`; kind prefix-match on
audit; pagination on `/v1/synonyms`. → `todo.md` "Backend asks (sprint 17)".

## Constraints the console build must respect

- New strings: `tr(lang, "укр", "eng")` inline; default language uk.
- New CSS: `src/sprints-17.css`, imported after `sprints-16.css`; design tokens
  only (no hex; no `--danger` — destructive = `--rec`).
- No shared ConfirmDialog exists — extract one (three hand-rolled copies in the
  wild) with consequence text + optional typed-word confirmation.
- Unit tests must be JSX-free and hand-appended to the `test:unit` list.
- Permission mirrors: new `synonym.*`/`autocomplete.*` rows must land in BOTH
  `src/auth/roles.js` MATRIX and `docs/auth/permissions.csv` or
  `permissionsDrift.test.js` fails.
- 404 ≠ forbidden (RLS): never render "access denied" on a 404.
- `npm run build` + `verify:bundle` + `lint:contracts` are the local gates.
- Two role vocabularies (JWT platform roles vs tenant membership roles) must
  not be conflated on the users surface; role editor is a multi-select.
