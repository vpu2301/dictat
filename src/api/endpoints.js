// endpoints.js — typed wrappers around the auth-service API.
// Mirrors the routes from medical-dictation-backend/docs/api/auth-service-openapi.json.

import { api, setAccessToken, BASE_URL } from "./client.js";

// POST /auth/login is application/x-www-form-urlencoded on the backend.
// JSON body returns 422. Use URLSearchParams.
//
// Backend response: { access_token, expires_in, token_type, user }.
// `mdx_rt` HttpOnly cookie is set at path /auth and rides credentials:"include".
export async function login(email, password) {
  const form = new URLSearchParams();
  form.set("email", email);
  form.set("password", password);
  const r = await api("/auth/login", { method: "POST", body: form });
  if (r && r.access_token) setAccessToken(r.access_token);
  return r;
}

export async function me() {
  return api("/auth/me", { method: "GET" });
}

// Idempotent — safe to call twice. Server clears the cookie + revokes refresh.
export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
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
