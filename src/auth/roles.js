// roles.js — the client-side role/permission mirror, as PURE data + functions.
//
// Split out of permissions.js so it can be unit-tested and imported from
// non-React code: permissions.js pulls in AuthContext.jsx for its hook,
// and a `.jsx` import makes the whole module unloadable by `node --test`.
// Everything here is free of React and of JSX imports — keep it that way.
//
// **Server is authoritative.** This table is advisory: it drives whether
// the UI hides or disables an action; every API call is gated server-side
// as well. Mirrors docs/auth/permissions.csv.

export function hasAnyRole(claims, roles) {
  if (!claims || !Array.isArray(claims.roles)) return false;
  return claims.roles.some((r) => roles.includes(r));
}


// ── S14: the admin ⟂ PHI split ────────────────────────────────────────
// A tenant_admin no longer holds ANY clinical permission. They run the
// clinic — users, tenant settings, templates, the audit trail, the
// patient roster — and reach a single patient's report only through the
// break-glass request below. See libs/auth/perms.py.
//
// This is a matrix over ROLES, not people: a practising doctor who also
// administers the tenant carries BOTH `tenant_admin` and `clinician`,
// and the clinical rows below admit them on the clinician role. Only an
// admin-ONLY account loses the clinical surfaces.
export const CLINICAL_ROLES = ["clinician", "nurse"];
export const ADMIN_ROLES = ["tenant_admin", "super_admin"];

/** Can this user see clinical content (notes, dictations, reports)? */
export function hasClinicalAccess(claims) {
  return hasAnyRole(claims, CLINICAL_ROLES);
}

/** An administrator with no clinical standing — the S14 case. */
export function isAdminOnly(claims) {
  return hasAnyRole(claims, ADMIN_ROLES) && !hasClinicalAccess(claims);
}

// Map: action → target_kind → roles allowed.
// Mirrors docs/auth/permissions.csv; the server is authoritative.
const MATRIX = {
  // ── dictation (sprint 04; tenant_admin dropped in S14) ────────────────
  "dictation.start":    { dictation: ["clinician", "nurse"] },
  "dictation.read":     { dictation: ["clinician", "nurse"] },
  "dictation.finalize": { dictation: ["clinician", "nurse"] },

  // ── nlp (sprint 05) ───────────────────────────────────────────────────
  "nlp.process":              { transcript:    ["clinician", "nurse", "tenant_admin"] },
  "nlp.read.abbreviations":   { abbreviation:  ["clinician", "nurse", "tenant_admin", "auditor"] },
  "nlp.write.abbreviations":  { abbreviation:  ["tenant_admin"] },

  // ── asr batch (sprint 03; tenant_admin dropped in S14) ────────────────
  "asr.submit": { job: ["clinician", "nurse"] },
  "asr.read":   { job: ["clinician", "nurse"] },
  "asr.cancel": { job: ["clinician"] },

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

  // ── reports / patients / notes ────────────────────────────────────────
  // S14: `report.*` and `note.*` are clinical-only. `patient.*` is NOT —
  // the roster is exactly the surface an administrator's job needs, and
  // it is the one clinical-adjacent list they keep.
  "reports.create":   { report:  ["clinician", "nurse"] },
  "reports.read":     { report:  ["clinician", "nurse"] },
  "notes.read":       { note:    ["clinician", "nurse"] },
  "notes.write":      { note:    ["clinician", "nurse"] },
  "patients.read":    { patient: ["clinician", "nurse", "tenant_admin"] },
  "patients.write":   { patient: ["clinician", "nurse", "tenant_admin"] },

  // ── break-glass (S14) ─────────────────────────────────────────────────
  // Only an admin requests it — a clinician already holds report.read, so
  // offering them the modal would be a dead end. `phi_access.read` is the
  // oversight log: who broke glass, on what, and why.
  "phi_access.request": { phi_access_request: ["tenant_admin", "super_admin"] },
  "phi_access.read":    { phi_access_request: ["tenant_admin", "super_admin", "auditor"] },

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
