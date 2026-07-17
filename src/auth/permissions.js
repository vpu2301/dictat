// permissions.js — client-side mirror of docs/auth/permissions.csv.
//
// **Server is authoritative.** This table is advisory: it drives whether
// the UI hides/disables an action, but every API call is also gated server-side.
// When backend ships /auth/me/permissions, replace this with a fetched list.
//
// Backend permission shape: pairs of (action, target_kind).
// Roles known in sprints 01-05: clinician, auditor, tenant_admin, super_admin.

import { useAuth, hasAnyRole } from "./AuthContext.jsx";

// Map: action → target_kind → roles allowed.
// Sourced from the spec's "sprint 04/05 perms" line + the standard scribe model.
const MATRIX = {
  // ── dictation (sprint 04) ─────────────────────────────────────────────
  "dictation.start":    { dictation: ["clinician", "tenant_admin"] },
  "dictation.read":     { dictation: ["clinician", "tenant_admin", "auditor"] },
  "dictation.finalize": { dictation: ["clinician", "tenant_admin"] },

  // ── nlp (sprint 05) ───────────────────────────────────────────────────
  "nlp.process":              { transcript:    ["clinician", "tenant_admin"] },
  "nlp.read.abbreviations":   { abbreviation:  ["clinician", "tenant_admin", "auditor"] },
  "nlp.write.abbreviations":  { abbreviation:  ["tenant_admin"] },

  // ── asr batch (sprint 03 backend) ─────────────────────────────────────
  "asr.submit": { job: ["clinician", "tenant_admin"] },
  "asr.read":   { job: ["clinician", "tenant_admin", "auditor"] },
  "asr.cancel": { job: ["clinician", "tenant_admin"] },

  // ── audit (sprint 02) ─────────────────────────────────────────────────
  "audit.read":   { event: ["auditor", "tenant_admin"] },
  "audit.verify": { chain: ["auditor", "tenant_admin"] },

  // ── admin (sprint 02 — invite/deactivate built) ───────────────────────
  "admin.user.invite":     { user: ["tenant_admin"] },
  "admin.user.deactivate": { user: ["tenant_admin"] },

  // ── templates (report-service, sprint 06) ────────────────────────────
  // Read/list/preview is open to all clinical roles; clone/update/deprecate
  // is tenant_admin only (the backend 403s the write actions otherwise).
  "templates.read":  { template: ["clinician", "tenant_admin", "auditor", "nurse"] },
  "templates.write": { template: ["tenant_admin"] },

  // ── reports / patients / notes (NOT BUILT — sprints 08/11/12) ─────────
  // Leave entries here so usePermission won't crash; they always return
  // false until the matching FEATURE flag flips on.
  "reports.create":   { report:  ["clinician", "tenant_admin"] },
  "reports.read":     { report:  ["clinician", "tenant_admin", "auditor"] },
  "patients.read":    { patient: ["clinician", "tenant_admin"] },

  // ── privacy (S11 step 06 — server scopes patient.dsar / privacy.approve) ─
  // DSAR + erasure surfaces are tenant-admin-only in the UI; the backend
  // additionally enforces the two-person rule on approve/reject.
  "privacy.dsar":    { patient: ["tenant_admin", "super_admin"] },
  "privacy.request": { patient: ["tenant_admin", "super_admin"] },
  "privacy.approve": { patient: ["tenant_admin", "super_admin"] },
};

export function isAllowed(claims, action, target_kind) {
  const entry = MATRIX[action];
  if (!entry) return false;
  const allowed = entry[target_kind];
  if (!allowed) return false;
  return hasAnyRole(claims, allowed);
}

// React hook: usePermission('dictation.start', 'dictation') → boolean.
// Note the (action, target_kind) signature — the FE TODO's single-string form
// is wrong. Callers must pass both.
export function usePermission(action, target_kind) {
  const { state } = useAuth();
  return isAllowed(state && state.claims, action, target_kind);
}
