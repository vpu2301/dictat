# Auth roles & client-side gating (F-02)

This doc is the canonical reference the frontend mirrors for **UX-level** role
gating. It is **advisory only** — the real security boundary is the backend
`requires()` + Postgres RLS. Every gated action below is also enforced
server-side; the FE simply hides/disables what the backend would 403 anyway.

Source of truth in code:
- Role membership: `src/auth/AuthContext.jsx` (`hasAnyRole`)
- Action matrix: `src/auth/permissions.js` (`MATRIX`, mirrors
  [`permissions.csv`](./permissions.csv))
- Nav visibility: `src/components/Sidebar.jsx`
- Route guards: `src/auth/RequireRole.jsx`

## Roles

Roles arrive in the RS256 access-token claim `roles` (array), alongside `sub`
and `tid` (tenant id). The FE **decodes** these for display/gating only — it
never verifies the signature.

| Role           | Who                                  |
| -------------- | ------------------------------------ |
| `clinician`    | Doctors authoring dictations / notes |
| `auditor`      | Read-only audit / compliance access  |
| `tenant_admin` | Clinic admin: user mgmt + audit      |
| `super_admin`  | Cross-tenant operator (not surfaced in the pilot UI) |
| `nurse`        | Clinical staff: the clinical surfaces, minus the actions the CSV reserves for a doctor |
| `knowledge_admin` | Evidence-corpus curator (EVA-S01). **Not an admin**: the CSV denies it every `tenant.*`, `user.*`, `patient.*`, `report.*` and `audit.*` action. Its entire authority is `evidence.corpus.manage` + `evidence.domains.manage` |

## Navigation gating (Sidebar)

| Nav group | Visible to                      | Code                                |
| --------- | ------------------------------- | ----------------------------------- |
| Admin (Адмін) | `tenant_admin`              | `isAdmin = hasAnyRole(["tenant_admin"])` |
| Audit (Аудит) | `auditor`, `tenant_admin`   | `isAuditor = hasAnyRole(["auditor","tenant_admin"])` |
| Clinical workspace | any authenticated user | always                              |

A `clinician` sees neither the Admin nor the Audit group. Deep-linking to a
route the role lacks (e.g. `#/admin/users`) renders `ForbiddenPage` via
`RequireRole` — and the backend returns 403 regardless.

## Action matrix

The full `(action, target_kind) → roles` table lives in
[`permissions.csv`](./permissions.csv) and is mirrored by the `MATRIX` in
`src/auth/roles.js` (re-exported from `permissions.js`). Use
`usePermission(action, target_kind)` to gate individual controls.

The CSV is a **verbatim vendored copy** of the backend's own
`docs/auth/permissions.csv` — one row per `(role, action, target_kind,
allowed)`, every role stated explicitly including the denials. It is not
maintained here.

Two guards keep the mirror honest, and both run in CI
(`.github/workflows/evidence-contracts.yml`):

| Guard | Command | Catches |
|---|---|---|
| vendored copy vs backend | `npm run auth:permissions -- --check` | the CSV falling behind the backend (skips when the backend is not checked out beside this repo) |
| CSV ↔ MATRIX, both directions | `node --test src/auth/permissionsDrift.test.js` | a mirrored row naming the wrong roles; a backend action neither mirrored nor explicitly listed as unmirrored |

`npm run auth:permissions` (no flag) pulls the backend copy over the vendored
one.

### Two vocabularies

dictat named several actions before the backend settled on singular nouns:
`reports.read` ↔ `report.read`, `patients.read` ↔ `patient.read`,
`admin.user.invite` ↔ `user.invite`, target kind `job` ↔ `asr_job`, and so on.
Renaming the MATRIX keys would touch every `usePermission()` call site for no
behavioural gain, so the divergence is declared as an explicit alias map at the
top of the drift test — which is also the checklist to work through if the FE
ever adopts the CSV names. **New actions use the CSV name verbatim**: every
`evidence.*` row added in EVA-S01 has no alias.

Two roles are deliberately outside the comparison: `service` (a machine
principal that never renders UI) and `super_admin` (granted outside the
per-tenant matrix).

### Evidence actions (EVA-S01)

| Action | target_kind | Roles |
|---|---|---|
| `evidence.ask` | `evidence` | clinician, nurse, tenant_admin |
| `evidence.context.read` | `evidence` | clinician, nurse |
| `evidence.acts.manage` | `evidence` | clinician, tenant_admin |
| `evidence.deeptrace.run` | `evidence` | clinician, tenant_admin |
| `evidence.drugs.read` | `evidence` | clinician, nurse, tenant_admin |
| `evidence.drugs.predict` | `evidence` | clinician |
| `evidence.ops.read` | `evidence` | auditor, tenant_admin |
| `evidence.corpus.manage` | `evidence_corpus` | knowledge_admin, tenant_admin |
| `evidence.domains.manage` | `evidence_corpus` | knowledge_admin |

`evidence.ask` admits a `tenant_admin` and `evidence.context.read` does not:
the S14 admin ⟂ PHI split carried into evidence — an administrator may ask a
generic clinical question, never one about a patient (ADR-0033). As always
this is a matrix over roles, not people: a doctor who also administers the
clinic holds both roles and keeps both actions.

Gate on the generated `EvidenceAction` union rather than a string literal —
see [`src/types/README.md`](../../src/types/README.md).

## Token & session rules (recap, see ADR 0001)

- Access token: **in memory only** (`src/api/client.js`) — never
  `localStorage` / `sessionStorage`. Proven by E2E §4.1.
- Refresh: HttpOnly `mdx_rt` cookie, single-flight on 401. Proven by E2E §4.3.
