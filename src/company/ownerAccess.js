// ownerAccess.js — who may open the Klarnote *platform owner* console (#/company).
//
// This is US — the vendor — not a clinic administrator. The distinction matters:
// `tenant_admin` runs one clinic and is a customer; a platform owner runs
// Klarnote and looks *across* clinics.
//
// **The backend has no platform-owner role.** `libs/auth/perms.py` pins
// KNOWN_ROLES to {tenant_admin, clinician, nurse, auditor, service} — `super_admin`
// is referenced by the FE role table but the server neither issues nor honours
// it (see libs/auth/tests/unit/test_perms.py, which asserts super_admin is
// denied). So the gate here is an **email allowlist**, and it is a *presentation*
// gate only: it decides which nav entry renders, not what the API returns. Every
// call the console makes is still RLS-scoped and role-checked server-side, so a
// non-owner who forces the route sees a page of 403s, not our data.
//
// When the backend ships a real platform role, add it to PLATFORM_ROLES below
// and the allowlist becomes a fallback rather than the mechanism.
//
// Pure module (no React, no JSX) so `node --test` can load it.

// Roles that would grant the console if the server ever issues them.
export const PLATFORM_ROLES = ["super_admin", "platform_owner"];

// Comma-separated override, e.g. VITE_PLATFORM_OWNER_EMAILS="a@x.com,b@y.com".
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const DEFAULT_OWNER_EMAILS = ["vpu2301@gmail.com"];

export function parseOwnerEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const OWNER_EMAILS = (() => {
  const configured = parseOwnerEmails(env.VITE_PLATFORM_OWNER_EMAILS);
  return configured.length ? configured : DEFAULT_OWNER_EMAILS;
})();

/**
 * Is this session a Klarnote platform owner?
 *
 * @param {object|null} state  the AuthContext state — { claims, dbUser }.
 * @param {string[]}    owners allowlist override (defaults to OWNER_EMAILS).
 */
export function isPlatformOwner(state, owners = OWNER_EMAILS) {
  if (!state) return false;
  const claims = state.claims || null;
  const roles = (claims && Array.isArray(claims.roles)) ? claims.roles : [];
  if (roles.some((r) => PLATFORM_ROLES.includes(r))) return true;

  // /auth/me returns the DB row under `db_user`; RootGate normalises it to
  // `dbUser`. Tolerate both so this works wherever it is called from.
  const email = ownerEmailOf(state);
  if (!email) return false;
  return owners.map((o) => o.toLowerCase()).includes(email);
}

/** The session's email, lowercased — or "" when the session carries none. */
export function ownerEmailOf(state) {
  if (!state) return "";
  const user = state.dbUser || state.db_user || null;
  const raw = (user && user.email) || (state.claims && state.claims.email) || "";
  return String(raw).trim().toLowerCase();
}

/**
 * Why the console is (not) available — drives the honest empty state instead of
 * a bare 403. Returns "owner" | "no-session" | "not-owner".
 */
export function ownerGateReason(state, owners = OWNER_EMAILS) {
  if (!state) return "no-session";
  return isPlatformOwner(state, owners) ? "owner" : "not-owner";
}
