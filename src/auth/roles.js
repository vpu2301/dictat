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

// ── What NOT to show a human ──────────────────────────────────────────
// Keycloak puts its own housekeeping roles in the same `roles` claim as
// ours: `offline_access` and `uma_authorization` are protocol scopes and
// `default-roles-<realm>` is the composite every new account is given.
// None of them grants anything in this product. Anywhere the claim is
// RENDERED — the account block, the access-denied screen — it has to come
// through here first, or "your roles" reads as a debug dump with the one
// role that matters buried in it.
//
// Authorisation is unaffected: hasAnyRole() and the matrix below still see
// the raw claim. This is a display filter and nothing else.
const KEYCLOAK_INTERNAL = /^(offline_access|uma_authorization|default-roles-.*)$/;
export const productRoles = (roles) =>
  (roles || []).filter((r) => typeof r === "string" && !KEYCLOAK_INTERNAL.test(r));

// ── EVA-S01: the corpus-curation role ─────────────────────────────────
// `knowledge_admin` curates the evidence corpus and the web-search domain
// allowlist. It is NOT an admin role: docs/auth/permissions.csv denies it
// every tenant.*, user.*, patient.*, report.* and audit.* action explicitly.
// Deliberately its own constant rather than a member of ADMIN_ROLES — a
// curator who inherited the admin console would be exactly the privilege
// creep the CSV rows were written to prevent. It holds no clinical access
// either, so `hasClinicalAccess`/`isAdminOnly` already report false for it.
export const KNOWLEDGE_ROLES = ["knowledge_admin"];

// Who may open the patient roster. An auditor is deliberately absent: their
// subject is the trail — who touched what, when — not the people in it.
// Single source for the `patient.*` matrix rows below and for the route gate.
export const PATIENT_ROLES = ["clinician", "nurse", "tenant_admin"];

/** Can this user see clinical content (notes, dictations, reports)? */
export function hasClinicalAccess(claims) {
  return hasAnyRole(claims, CLINICAL_ROLES);
}

/** An administrator with no clinical standing — the S14 case. */
export function isAdminOnly(claims) {
  return hasAnyRole(claims, ADMIN_ROLES) && !hasClinicalAccess(claims);
}

/**
 * An auditor with no clinical standing and no admin powers — the read-only
 * oversight account. Their entire surface is the audit trail (events + chain
 * verification) plus the template library they read records against; every
 * other nav entry would be a button that 403s.
 *
 * Like `isAdminOnly` this is a matrix over ROLES, not people: a clinician who
 * also audits carries both roles and keeps the full clinical workspace.
 */
export function isAuditorOnly(claims) {
  return hasAnyRole(claims, ["auditor"])
    && !hasClinicalAccess(claims)
    && !hasAnyRole(claims, ADMIN_ROLES);
}

/** Can this user open the patient roster? */
export function canReadPatients(claims) {
  return isAllowed(claims, "patients.read", "patient");
}

/**
 * May this user MINT a break-glass grant?
 *
 * Admin-only, and the check matters on the REFUSAL screens as much as on the
 * buttons: a 403 `phi_access_required` reaching a clinical role is a stale
 * token or a deep link, not an invitation. Offering "Request access" there
 * would put a door in front of someone who cannot open it — and, if a server
 * ever agreed, would mint a grant on the one role that must never hold one.
 */
export function canRequestPhiAccess(claims) {
  return isAllowed(claims, "phi_access.request", "phi_access_request");
}

/** A corpus curator: knowledge_admin and nothing else. */
export function isKnowledgeAdminOnly(claims) {
  return hasAnyRole(claims, KNOWLEDGE_ROLES)
    && !hasClinicalAccess(claims)
    && !hasAnyRole(claims, ADMIN_ROLES)
    && !hasAnyRole(claims, ["auditor"]);
}

// Map: action → target_kind → roles allowed.
// Mirrors docs/auth/permissions.csv; the server is authoritative.
// Exported for the drift test (permissionsDrift.test.js), which reads the CSV
// and asserts this table against it in both directions. Treat it as read-only.
export const MATRIX = {
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
  // ── signing (the 2026-08-09 hotfix) ───────────────────────────────────
  // The three actions that carry SIGNING authority, as distinct from
  // authorship. Before the hotfix every signing surface gated on
  // `report.write` / `patient.write` — both held by nurse — so the authority
  // to affix a qualified signature had no representation in this matrix at
  // all, and the UI offered the act to everyone who could type.
  //
  // `report.finalize` is deliberately NOT here: finalizing is the structural
  // draft → finalized transition, it applies no signature, and nurses keep it.
  "report.sign":   { report:  ["clinician"] },
  "report.amend":  { report:  ["clinician"] },
  "consent.sign":  { consent: ["clinician"] },

  "reports.create":   { report:  ["clinician", "nurse"] },
  "reports.read":     { report:  ["clinician", "nurse"] },
  "notes.read":       { note:    ["clinician", "nurse"] },
  "notes.write":      { note:    ["clinician", "nurse"] },
  "patients.read":    { patient: PATIENT_ROLES },
  "patients.write":   { patient: PATIENT_ROLES },

  // ── break-glass (S14; re-asserted 2026-08-09) ─────────────────────────
  // Only an admin requests it. A clinical role holds `patient.read_full` and
  // `report.read` outright — standing access, with the treatment relationship
  // RECORDED in the audit event rather than required — so there is no door
  // left for a clinician to walk through. A permission with no reachable use
  // is not harmless: it is grant-minting power sitting on the role that least
  // needs it. `phi_access.read` is the oversight log: who broke glass, on
  // what, and why.
  "phi_access.request": { phi_access_request: ["tenant_admin", "super_admin"] },
  "phi_access.read":    { phi_access_request: ["tenant_admin", "super_admin", "auditor"] },

  // ── privacy (S11 step 06 — server scopes patient.dsar / privacy.approve) ─
  // DSAR + erasure surfaces are tenant-admin-only in the UI; the backend
  // additionally enforces the two-person rule on approve/reject.
  "privacy.dsar":    { patient: ["tenant_admin", "super_admin"] },
  "privacy.request": { patient: ["tenant_admin", "super_admin"] },
  "privacy.approve": { patient: ["tenant_admin", "super_admin"] },

  // ── evidence (EVA-S01) ────────────────────────────────────────────────
  // Nine actions over two target kinds, mirrored verbatim from the CSV rows
  // the backend added this sprint. No screen consumes them yet (S01 ships
  // plumbing only) — they land now so that from S03 onward every evidence
  // surface gates on a string that already exists on both sides.
  //
  // Two shapes are worth reading twice, because they are the sprint's whole
  // security argument in table form:
  //  · `evidence.ask` admits tenant_admin but `evidence.context.read` does
  //    NOT — the S14 admin ⟂ PHI split, carried into evidence: an admin may
  //    ask a generic clinical question, never one about a patient (ADR-0033).
  //  · `evidence.corpus.manage` / `evidence.domains.manage` are the only
  //    rows knowledge_admin appears in at all.
  "evidence.ask":             { evidence: ["clinician", "nurse", "tenant_admin"] },
  "evidence.context.read":    { evidence: ["clinician", "nurse"] },
  "evidence.acts.manage":     { evidence: ["clinician", "tenant_admin"] },
  "evidence.deeptrace.run":   { evidence: ["clinician", "tenant_admin"] },
  "evidence.drugs.read":      { evidence: ["clinician", "nurse", "tenant_admin"] },
  "evidence.drugs.predict":   { evidence: ["clinician"] },
  "evidence.ops.read":        { evidence: ["auditor", "tenant_admin"] },
  "evidence.corpus.manage":   { evidence_corpus: ["knowledge_admin", "tenant_admin"] },
  "evidence.domains.manage":  { evidence_corpus: ["knowledge_admin"] },
};

/**
 * The evidence action vocabulary, derived from the MATRIX so it cannot drift
 * from it. The generated `EvidenceAction` union in src/types/evidence.d.ts is
 * asserted equal to this list by the drift test — that is the tie between the
 * compile-time union and the runtime table.
 */
export const EVIDENCE_ACTIONS = Object.keys(MATRIX)
  .filter((a) => a.startsWith("evidence."))
  .sort();

// ── signing (sprint 09; clinician-only as of the 2026-08-09 hotfix) ────
//
// A qualified electronic signature is a doctor's legal act. It attests that
// THIS clinician takes responsibility for the content — which is why the law
// binds it to a personal KEP and why no one may perform it on another's
// behalf. Before this, the sign, amend and КЕП-consent affordances rendered
// for nurse, tenant_admin and auditor alike.
//
// Backed by a REAL server-side action: signing-service gates every signing
// route on `report.sign` (see the MATRIX rows above, mirrored from the
// backend's own table). So this is an ordinary permission check, not a
// cosmetic one — hiding the button and refusing the call now agree.
export const SIGNING_ROLES = ["clinician"];

/** May this user affix a qualified signature to a REPORT? */
export function canSign(claims) {
  return isAllowed(claims, "report.sign", "report");
}

/** …and to a patient CONSENT (the КЕП option in the consent sheet). */
export function canSignConsent(claims) {
  return isAllowed(claims, "consent.sign", "consent");
}

/** Amending a signed report re-signs it — the same act, the same authority. */
export function canAmend(claims) {
  return isAllowed(claims, "report.amend", "report");
}

/**
 * Is this error the server refusing a signing act for want of standing?
 *
 * Anything the signing/report services answer 403 to on a signing path is
 * this: the FE gate is advisory, so a 403 here means a stale tab, a deep
 * link, or a role that changed under the user — never a bug to shout about.
 */
export function isSigningForbidden(err) {
  return err?.status === 403;
}

export function isAllowed(claims, action, target_kind) {
  const entry = MATRIX[action];
  if (!entry) return false;
  const allowed = entry[target_kind];
  if (!allowed) return false;
  return hasAnyRole(claims, allowed);
}
