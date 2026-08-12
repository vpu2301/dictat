// permissions.js — client-side mirror of docs/auth/permissions.csv.
//
// **Server is authoritative.** This table is advisory: it drives whether
// the UI hides/disables an action, but every API call is also gated server-side.
// When backend ships /auth/me/permissions, replace this with a fetched list.
//
// Backend permission shape: pairs of (action, target_kind).
// Roles known in sprints 01-05: clinician, auditor, tenant_admin, super_admin.

import { useAuth } from "./AuthContext.jsx";

// The matrix and its pure predicates live in roles.js (no React, no JSX)
// so they stay unit-testable; this module is the React-facing surface and
// re-exports them so existing import sites keep working.
export {
  ADMIN_ROLES,
  CLINICAL_ROLES,
  EVIDENCE_ACTIONS,
  KNOWLEDGE_ROLES,
  MATRIX,
  PATIENT_ROLES,
  canReadPatients,
  canRequestPhiAccess,
  hasAnyRole,
  hasClinicalAccess,
  isAdminOnly,
  isAllowed,
  isAuditorOnly,
  isKnowledgeAdminOnly,
} from "./roles.js";

import { isAllowed } from "./roles.js";

// React hook: usePermission('dictation.start', 'dictation') → boolean.
// Note the (action, target_kind) signature — the FE TODO's single-string form
// is wrong. Callers must pass both.
export function usePermission(action, target_kind) {
  const { state } = useAuth();
  return isAllowed(state && state.claims, action, target_kind);
}
