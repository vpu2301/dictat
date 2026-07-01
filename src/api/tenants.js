// tenants.js — Tenant (clinic) endpoints, all served by auth-service on the
// canonical auth base (see TENANT.md §3). Same Bearer + 401-refresh flow as the
// rest of the SPA via api(). A *Tenant* is one isolated clinic; a *membership*
// links a user to a tenant with a management role.

import { api, getAccessToken } from "./client.js";
import { SERVICES } from "./services.js";

// The six management roles the members UI exposes (TENANT.md §5). Distinct from
// the platform RBAC roles (tenant_admin | clinician | nurse | auditor) carried
// in the JWT — those gate the rest of the app.
export const MANAGEMENT_ROLES = ["owner", "admin", "doctor", "nurse", "assistant", "viewer"];

// Only owner/admin may manage the tenant + its members, AND the JWT must carry
// tenant_admin (TENANT.md §1 rule of thumb, §6). Writes still only land on the
// active tenant — enforced server-side — but this gates the affordances.
export function canManageTenant(claims, myRole) {
  const isManager = myRole === "owner" || myRole === "admin";
  const roles = (claims && Array.isArray(claims.roles)) ? claims.roles : [];
  return isManager && roles.includes("tenant_admin");
}

// ── Reads ──────────────────────────────────────────────────────────────────

// GET /tenants — tenants the caller belongs to → { items: [...] }.
export async function listTenants() {
  return api("/tenants", { method: "GET" });
}

// GET /tenants/current — the tenant the access token is scoped to (claims.tid).
export async function getCurrentTenant() {
  return api("/tenants/current", { method: "GET" });
}

// GET /tenants/{id} — full TenantOut profile/branding for a tenant you belong to.
export async function getTenant(id) {
  return api(`/tenants/${encodeURIComponent(id)}`, { method: "GET" });
}

// ── Writes (target the active tenant; cross-tenant writes → 403) ─────────────

// POST /tenants — create a clinic; caller becomes owner. Requires tenant_admin.
export async function createTenant(body) {
  return api("/tenants", { method: "POST", body: JSON.stringify(body) });
}

// PATCH /tenants/{id} — send only the changed fields. Returns updated TenantOut.
export async function updateTenant(id, patch) {
  return api(`/tenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// PUT /tenants/{id}/logo — multipart/form-data with either an image `file`
// (image/*, ≤ 2 MB) or an external `logo_url`. Returns updated TenantOut.
export async function uploadLogo(id, { file, logo_url } = {}) {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (logo_url) fd.append("logo_url", logo_url);
  return api(`/tenants/${encodeURIComponent(id)}/logo`, { method: "PUT", body: fd });
}

// GET /tenants/{id}/logo — raw image bytes. Because the access token lives in
// memory (not a cookie), an <img src> can't carry the Bearer header, so we
// fetch the bytes with auth and hand back an object URL the caller must revoke.
// Returns null when there is no stored logo (404) or the request fails.
export async function fetchLogoObjectUrl(id) {
  const token = getAccessToken();
  try {
    const r = await fetch(`${SERVICES.auth}/tenants/${encodeURIComponent(id)}/logo`, {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ── Members ──────────────────────────────────────────────────────────────────

// GET /tenants/{id}/members → { items: [...] }.
export async function listMembers(id) {
  return api(`/tenants/${encodeURIComponent(id)}/members`, { method: "GET" });
}

// POST /tenants/{id}/members — add by { user_sub, role } or { email, role }.
export async function addMember(id, body) {
  return api(`/tenants/${encodeURIComponent(id)}/members`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// PATCH /tenants/{id}/members/{sub} — { role }. 409 on demoting the last owner.
export async function updateMember(id, sub, role) {
  return api(`/tenants/${encodeURIComponent(id)}/members/${encodeURIComponent(sub)}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// DELETE /tenants/{id}/members/{sub}. 409 on removing the last owner.
export async function removeMember(id, sub) {
  return api(`/tenants/${encodeURIComponent(id)}/members/${encodeURIComponent(sub)}`, {
    method: "DELETE",
  });
}

// POST /tenants/{id}/switch — select active tenant. The pilot token is
// single-tenant, so the response `note` tells the UI whether a re-auth is
// required before the selected tenant's data becomes visible (TENANT.md §2.1).
export async function switchTenant(id) {
  return api(`/tenants/${encodeURIComponent(id)}/switch`, { method: "POST" });
}

// Client-side slug rule (backend returns 422 otherwise). TENANT.md §2.2.
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidSlug(slug) {
  return SLUG_RE.test(String(slug || ""));
}
