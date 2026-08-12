// endpoints.js — typed wrappers around the auth-service API.
// Mirrors the routes from medical-dictation-backend/docs/api/auth-service-openapi.json.

import { api, setAccessToken, BASE_URL } from "./client.js";
import { clearSessionEndReason, endSession, SESSION_END } from "../auth/sessionEnd.js";

// POST /auth/login is application/x-www-form-urlencoded on the backend.
// JSON body returns 422. Use URLSearchParams.
//
// Backend response: { access_token, expires_in, token_type, user }.
// `mdx_rt` HttpOnly cookie is set at path /auth and rides credentials:"include".
//
// `otp` is the TOTP second factor (sprint 16, ADR-0039). There is no separate
// MFA endpoint: auth-service's direct-grant proxy checks the code in the same
// call and refuses the token without it, answering 401 with `code:
// "otp_required"`. So the login form makes this call twice — once without a
// code, and again with one if the first attempt comes back challenged. Omitted
// entirely when absent rather than sent blank, because a present-but-empty
// `otp` is indistinguishable at the backend from a user who typed nothing.
export async function login(email, password, otp) {
  const form = new URLSearchParams();
  form.set("email", email);
  form.set("password", password);
  if (otp) form.set("otp", String(otp).replace(/\D/g, ""));
  const r = await api("/auth/login", { method: "POST", body: form });
  if (r && r.access_token) {
    setAccessToken(r.access_token);
    // Whatever ended the last session is history now. Without this, signing
    // back in after a revocation and then signing out normally would show the
    // stale "your session was ended" banner on the way out.
    clearSessionEndReason();
  }
  return r;
}

export async function me() {
  return api("/auth/me", { method: "GET" });
}

// Idempotent — safe to call twice. Server clears the cookie + revokes refresh
// (and, since sprint 16, pushes this session's `sid` onto the revocation
// denylist, so the access token dies here rather than in fifteen minutes).
export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
    // Announce it as a DELIBERATE ending. Everything listening for a session
    // end — the auth context, the dictation room — reacts the same way, but
    // the login screen stays quiet: a user who just clicked "sign out" does
    // not need to be told their session ended.
    endSession(SESSION_END.SIGNED_OUT);
  }
}

// GET /admin/users — UserSummary[] (RLS-scoped to the caller's tenant).
// Offset-paginated (limit ≤ 200, offset ≥ 0); returns a bare array.
export async function listUsers({ limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  return api(`/admin/users?${qs.toString()}`, { method: "GET" });
}

// GET /admin/users/{sub} — UserDetail. Worth a separate call per user because
// it carries two fields the roster list does NOT: `last_login_at` (dormant
// accounts) and `mfa_enrolled_at` (second-factor coverage). Neither exists on
// UserSummary, so any coverage figure has to be assembled row by row — see
// fetchPeopleDirectory() in company.js, which does exactly that under a cap.
export async function getUser(sub) {
  return api(`/admin/users/${encodeURIComponent(sub)}`, { method: "GET" });
}

// The realm-role catalogue the backend will accept (libs/auth/perms.py
// KNOWN_ROLES). `service` is deliberately absent: it is a machine identity and
// handing it to a person through a console dropdown is not a thing we want to
// make one click away. `super_admin` is absent because it does not exist
// server-side — the SPA references it, the server neither issues nor honours it.
export const ASSIGNABLE_ROLES = ["tenant_admin", "clinician", "nurse", "auditor", "knowledge_admin"];

// PUT /admin/users/{sub}/roles — REPLACES the whole realm-role set with `roles`
// (non-empty; every entry must be in KNOWN_ROLES or the server 422s). Requires
// tenant_admin + a verified MFA session. 409 when it would strip a tenant's
// last tenant_admin.
//
// Caveat the UI must state rather than hide: there is no endpoint that reads a
// user's role SET back. Both UserSummary and UserDetail carry `role` — the
// single value auth-service collapses the set to by precedence
// (tenant_admin > clinician > nurse > auditor > service). So a PUT here is a
// write against a value we can only partially observe, and a doctor who also
// administers the clinic reads back as `tenant_admin` alone.
export async function setUserRoles(sub, roles) {
  return api(`/admin/users/${encodeURIComponent(sub)}/roles`, {
    method: "PUT",
    body: JSON.stringify({ roles: [...new Set(roles)].filter(Boolean) }),
  });
}

export async function inviteUser({ email, display_name, role, first_name, last_name }) {
  const body = { email, display_name, role };
  if (first_name) body.first_name = first_name;
  if (last_name) body.last_name = last_name;
  return api("/admin/users/invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// POST /admin/users/{sub}/deactivate — disables login in Keycloak AND revokes
// every active session. Platform-wide, not scoped to one clinic. tenant_admin
// + MFA only. Reversible via reactivateUser().
export async function deactivateUser(sub) {
  return api(`/admin/users/${encodeURIComponent(sub)}/deactivate`, { method: "POST" });
}

// POST /admin/users/{sub}/reactivate — re-enables login (users.status → active).
// Does NOT restore sessions; the user has to sign in again.
export async function reactivateUser(sub) {
  return api(`/admin/users/${encodeURIComponent(sub)}/reactivate`, { method: "POST" });
}

export async function listAuditEvents(params = {}) {
  const qs = new URLSearchParams();
  const set = (k, v) => { if (v !== undefined && v !== null && v !== "") qs.set(k, v); };
  set("from_seq", params.from_seq);
  set("to_seq", params.to_seq);
  set("kind", params.kind);
  set("actor_sub", params.actor_sub);
  set("since", params.since);
  set("until", params.until);
  set("severity", params.severity);
  set("limit", params.limit ?? 100);
  set("cursor", params.cursor);
  return api(`/audit/events?${qs.toString()}`, { method: "GET" });
}

export async function verifyAuditChain({ from_seq = 1, to_seq } = {}) {
  const qs = new URLSearchParams();
  qs.set("from_seq", String(from_seq));
  if (to_seq !== undefined && to_seq !== null && to_seq !== "") qs.set("to_seq", String(to_seq));
  return api(`/audit/verify?${qs.toString()}`, { method: "GET" });
}

// /readyz returns { status: "ready" | "not_ready", ... } per backend convention.
// Note: NOT /health.
export async function readyz(baseUrl = BASE_URL) {
  const r = await fetch(`${baseUrl}/readyz`, { method: "GET" });
  if (!r.ok && r.status !== 503) throw new Error("readyz_failed");
  return r.json();
}

export async function healthz(baseUrl = BASE_URL) {
  const r = await fetch(`${baseUrl}/healthz`, { method: "GET" });
  if (!r.ok) throw new Error("healthz_failed");
  return r.json();
}

// ── Step-up re-authentication (S14 break-glass) ──────────────────────────────
// POST /auth/reauth — re-enter the CURRENT user's password to mint a
// single-use, short-lived ticket proving they are still at the keyboard.
// The ticket is then spent on a high-risk action (today: requesting
// break-glass access to one report).
//
// Returns { reauth_ticket, expires_in, purpose }. Throws ApiError 401 when
// the password is wrong — surface that as "wrong password", never as a
// session problem: the caller's session is fine, their typing was not.
//
// The password is passed straight through and never stored, logged or
// retained by the SPA; hold the returned ticket in component state only.
export async function reauth(password, { purpose = "phi_access_request" } = {}) {
  return api("/auth/reauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, purpose }),
  });
}
