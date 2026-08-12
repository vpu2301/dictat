# Sprint 17 — PLAN (admin console)

Decision recap (EXPLORE.md): in-app `/admin` area, delegated sub-router module
(`src/admin/AdminRoutes.jsx`, the EvidenceRoutes pattern), building on the
surfaces that already exist rather than re-writing them.

## Backend slice (medical-dictation-backend — minimal, additive, assigned to
## sprint-17 by the backend's own docs)

- **B1 autocomplete-service**: `GET /autocomplete/phrases` +
  `GET /autocomplete/snippets` (perm `autocomplete.read`/`phrase`; params
  `language`, `specialty`, `source`, `limit`; wires the already-written
  `repository.list_phrases`, adds the snippets twin). DTOs carry
  `impression_count`/`acceptance_count` so the console can show acceptance
  columns. OpenAPI snapshot regenerated; unit tests.
- **B2 report-service re-bind**:
  - `GET /templates/{template_id}/bound-reports` — PHI-free listing
    (report id, status, created/updated timestamps) of reports referencing the
    template, perm `template.update`/`template` (this is template
    administration, not clinical read; no title/snippet/patient fields).
  - `POST /templates/{template_id}/rebind` — body
    `{report_id, to_template_id}`; moves ONE report (per-draft, confirmed in
    UI) to a successor template. Guards: source report actually bound to
    `{template_id}`; target template exists, same language, not deprecated;
    only non-finalized reports. Audit kind `template.rebound`
    (payload: report_id, from/to template ids) documented in
    `docs/audit/event-kinds.md`; runbook + sprint-06 todos updated.
- Everything else stays an ask in `todo.md` (see EXPLORE.md list).

## Frontend slice (dictat)

### F1 Shell
- `src/admin/AdminRoutes.jsx`: `isAdminRoute`, `adminCrumbs`, route table:
  `/admin` (overview → redirect to templates), `/admin/templates[/...]`,
  `/admin/dictionary` (abbreviations + voice-command reference),
  `/admin/autocomplete`, `/admin/synonyms`, `/admin/users`, `/admin/audit`,
  `/admin/audit/verify`. Gate: `RequireRole ["tenant_admin"]` at module level
  (`/admin/privacy` keeps its existing branch and gate; the console left-nav
  links to it).
- `src/admin/AdminLayout.jsx`: console left-nav (seven surfaces + privacy),
  dense ops styling, breadcrumbs via App.jsx crumbs.
- App.jsx: one branch delegating `isAdminRoute(routePath)` (replaces the
  existing `/admin/users` + keeps `/admin/privacy` working), Sidebar admin
  submenu updated to point at the console.
- `src/sprints-17.css` imported after `sprints-16.css`.

### F2 Shared kit
- `src/admin/ConfirmDialog.jsx` — consequence-first destructive dialog
  (title, consequence paragraph, optional typed-word confirmation, danger
  button uses `--rec` tokens). Reused by every surface.
- `src/admin/useLimitedList.js` — absorbs the bare-array/limit-only backends
  ("maybe more" when `length === limit`); cursor/offset surfaces reuse
  existing `useCursorPages`/`Pagination`.

### F3 MFA return-to
- `mfaGrace.js`: `mfaEnrolmentRoute(returnTo)`; `client.js`
  `routeToMfaEnrolment()` captures current hash; `MfaPage` done-state
  navigates back to `return` param (validated: must start `/`). Unit test.

### F4 Templates surface
- Reuse `TemplatesPage` machinery under `/admin/templates` (admin chrome).
- **Live cosmetic/structural banner**: `TemplateFormModal` runs `classifyEdit`
  (existing FE mirror of backend `classify_edit`) on every edit; banner shows
  kind + reason strings BEFORE save; save confirm keeps working.
- Deprecate consequence dialog via ConfirmDialog; on 409 in_use → open
  **re-bind panel**: `GET bound-reports` list → per-draft rebind with
  ConfirmDialog → re-attempt deprecate.
- Option-list editing stays in `SectionEditor` (it already enforces 2..50,
  value slug, alias rules); surface backend 422 `errors[]` inline
  (collision messages: duplicated value/label/alias, cross-section alias).

### F5 Dictionary (abbreviations + voice commands)
- Abbreviations CRUD table (merged list, `is_tenant_override` badges,
  "tenant row wins on collision" copy, delete-override only for tenant rows).
- **Test box**: calls `POST /nlp/process` (admin-typed text, admin-safe) with
  `stages_disabled` toggles; renders result + per-stage warnings.
- Voice commands: read-only reference rendered from the REAL client vocabulary
  (`src/dictation/voiceCommands.js` COMMANDS) + note that per-tenant overrides
  are a future backend feature.

### F6 Autocomplete corpus
- Phrases + snippets tables (new GET endpoints), acceptance-rate columns,
  create forms, delete via ConfirmDialog.
- PII 422 → «Ця фраза схожа на персональні дані — не збережено» with pattern
  chips; parser tolerates BOTH wire shapes (Python-repr string today,
  `problem_extras` code if backend upgrades). 409 already-exists and 429
  rate-limit rendered distinctly.

### F7 Synonyms
- Group editor (system rows read-only — PUT/DELETE 404 by design, UI never
  offers it), 2..12 terms, uk|en; pinned clinical-safety note: «Пов'язане ≠
  взаємозамінне — не групуйте різні діагнози».

### F8 Users & roles
- Real roster (`GET /admin/users`, offset paging), invite modal (4 invitable
  roles), deactivate/reactivate with consequence dialogs, **multi-select role
  editor** (`PUT roles`, KNOWN_ROLES minus `service`), last-admin 409 rendered
  as a blocking explanation, MFA-enrolled badge (`mfa_enrolled_at`) + admin
  MFA reset. Auditor gets read-only roster (holds `user.read`).
- Replaces AdminUsersPage's localStorage pseudo-roster.

### F9 Audit viewer
- `/admin/audit`: filter bar (kind — datalist from the event-kind catalogue,
  severity, actor_sub, since/until, from_seq) over `GET /audit/events`
  (ascending seq paging, existing `useCursorPages`), JsonViewer payloads.
- «Перевірити ланцюг» button → `GET /audit/verify` result panel (ok / first
  divergence + reason + hashes). **No export affordance** — asserted by test.

### F10 Cross-cutting
- MATRIX + `docs/auth/permissions.csv` rows for `synonym.*`,
  `autocomplete.*`, template rebind (keep `permissionsDrift.test.js` green).
- Ukrainian-first copy via `tr()`; empty/loading/error states via
  LoadGate/ApiErrorView everywhere; `data-testid` on actionable controls.
- handoff.md §4/§5 route+dir updates; todo.md backend-asks section.

## VERIFY matrix (per sprint doc)

1. Shell: mocked e2e — clinician deep-link `/admin/*` → ForbiddenPage; server
   403 rendered; non-enrolled admin mutation → 403 `mfa_enrolment_required` →
   `/mfa?required=1&return=…` → done → back at origin route.
2. Templates: rename section → «косметична»; remove section → «СТРУКТУРНА —
   нова версія»; structural save → new id in list with lineage; re-bind flow
   moves fixture draft; draft opens after.
3. Option lists: colliding alias → backend 422 message inline; new option
   visible in dictation extraction fixture (mocked E2E fixture).
4. Dictionary/autocomplete/synonyms: PII 422 message; abbreviation edit
   reflected in test box (mock echoes merged dict); synonym edit changes
   search-expansion fixture.
5. Users: last-admin 409 rendered; role change round-trips; target's nav
   changes on next (fixture) login.
6. Audit: filters compose (mock asserts query params); verify OK + tampered
   detail; no-export snapshot.
7. Full-journey admin E2E + `npm run test:unit` + `npm run build` +
   `npm run lint:contracts` + `npm run auth:permissions -- --check` green.
8. Backend: affected service test suites + openapi snapshots regenerated
   (`make openapi-dump`), `make ci`-relevant gates for touched packages.
