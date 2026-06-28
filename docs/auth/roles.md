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
[`permissions.csv`](./permissions.csv) and is mirrored verbatim by the `MATRIX`
in `src/auth/permissions.js`. Use `usePermission(action, target_kind)` to gate
individual controls.

## Token & session rules (recap, see ADR 0001)

- Access token: **in memory only** (`src/api/client.js`) — never
  `localStorage` / `sessionStorage`. Proven by E2E §4.1.
- Refresh: HttpOnly `mdx_rt` cookie, single-flight on 401. Proven by E2E §4.3.
