// companyMocks.js — the mocked backend the owner-console specs drive.
// Extracted so the spec and any ad-hoc screenshot run share ONE definition of
// the wire shapes (TenantListOut / TenantOut / MemberListOut / UserSummary /
// audit events); two copies would drift the moment one is updated.
import { expect } from "@playwright/test";

export const TENANT_A = "00000000-0000-0000-0000-00000000000a";
export const TENANT_B = "00000000-0000-0000-0000-00000000000b";
export const KLINIC = "0000c111-0000-0000-0000-000000000001";
export const OWNER_SUB = "0f000000-0000-0000-0000-00000000000f";
export const OWNER_EMAIL = "vpu2301@gmail.com";

export const TENANT_SUMMARIES = [
  { id: TENANT_A, name: "tenant-a", display_name: "Dev Hospital A", slug: "tenant-a", status: "active", is_active: true, logo_url: "", my_role: "owner" },
  { id: TENANT_B, name: "tenant-b", display_name: "Dev Hospital B", slug: "tenant-b", status: "active", is_active: true, logo_url: "", my_role: "owner" },
  { id: KLINIC, name: "klinic", display_name: "Klinic", slug: "klinic", status: "active", is_active: true, logo_url: "", my_role: "owner" },
];

export const tenantDetail = (s, extra = {}) => ({
  ...s,
  legal_name: `${s.display_name} LLC`,
  locale: "uk", timezone: "Europe/Kyiv",
  has_logo: false, contact_email: `contact@${s.name}.example`,
  phone_number: "+380 44 000 0001", website: `https://${s.name}.example`,
  address_line1: "1 Khreshchatyk St", address_line2: "", postal_code: "01001",
  city: "Kyiv", state_or_region: "", country: "Ukraine",
  tax_id: "12345678", registration_number: "RN-1",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z",
  ...extra,
});

export const MEMBERS = {
  [TENANT_A]: [
    { user_sub: OWNER_SUB, role: "owner", status: "active", email: OWNER_EMAIL, display_name: "Klarnote Owner", platform_role: "tenant_admin", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    { user_sub: "0c000000-0000-0000-0000-00000000000a", role: "doctor", status: "active", email: "clinician@tenant-a.example", display_name: "Dev Clinician A", platform_role: "clinician", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ],
  [TENANT_B]: [
    { user_sub: OWNER_SUB, role: "owner", status: "active", email: OWNER_EMAIL, display_name: "Klarnote Owner", platform_role: "tenant_admin", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ],
  [KLINIC]: [
    { user_sub: OWNER_SUB, role: "owner", status: "active", email: OWNER_EMAIL, display_name: "Klarnote Owner", platform_role: "tenant_admin", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ],
};

export const USERS = [
  { sub: OWNER_SUB, email: OWNER_EMAIL, display_name: "Klarnote Owner", role: "tenant_admin", status: "active" },
  { sub: "0c000000-0000-0000-0000-00000000000a", email: "clinician@tenant-a.example", display_name: "Dev Clinician A", role: "clinician", status: "active" },
  { sub: "0d000000-0000-0000-0000-00000000000a", email: "nurse@tenant-a.example", display_name: "Dev Nurse A", role: "nurse", status: "active" },
];

export const AUDIT_EVENTS = [
  { seq: 42, kind: "auth.login_succeeded", actor_sub: OWNER_SUB, actor_role: "tenant_admin", target_kind: "user", target_id: OWNER_SUB, severity: "info", created_at: new Date().toISOString() },
  { seq: 43, kind: "tenant.switched", actor_sub: OWNER_SUB, actor_role: "tenant_admin", target_kind: "tenant", target_id: TENANT_B, severity: "info", created_at: new Date().toISOString() },
  { seq: 44, kind: "user.roles_changed", actor_sub: OWNER_SUB, actor_role: "tenant_admin", target_kind: "user", target_id: "0c000000-0000-0000-0000-00000000000a", severity: "sec", created_at: new Date().toISOString() },
];

export const TEMPLATES = [
  { id: "tpl-sys-1", code: "mri_brain", name: "MRI Brain", specialty: "radiology",
    language: "en", is_system: true, status: "active", schema_version: 1 },
  { id: "tpl-sys-2", code: "echo_tte", name: "Echocardiogram", specialty: "cardiology",
    language: "uk", is_system: true, status: "active", schema_version: 2 },
  { id: "tpl-own-1", code: "clinic_discharge", name: "Discharge summary", specialty: "general",
    language: "uk", is_system: false, status: "active", schema_version: 1 },
  { id: "tpl-own-2", code: "old_intake", name: "Legacy intake", specialty: "general",
    language: "uk", is_system: false, status: "deprecated", schema_version: 3 },
];

// `email`/`roles` parameterise WHO signs in, so the gate can be tested both ways.
// `auditEvents` swaps the audit fixture, so a test can exercise a specific event
// — a refresh replay, say — without that event polluting every other spec.
export async function installMocks(page, {
  email = OWNER_EMAIL,
  roles = ["tenant_admin", "clinician", "auditor"],
  auditEvents = AUDIT_EVENTS,
} = {}) {
  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8004", "8005", "8006", "8007", "8008"].includes(url.port);
  let sessionOpen = false;

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/auth/login") && method === "POST") {
      sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST")
      return sessionOpen ? json(200, { access_token: "tok" }) : json(401, { title: "refresh_failed" });
    if (path.endsWith("/auth/logout") && method === "POST") {
      // Must actually end the session: the staff door signs a non-staff account
      // back out, and a mock that no-oped here would hide a real leak.
      sessionOpen = false;
      return json(204, null);
    }
    if (path.endsWith("/auth/me")) {
      if (!sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: OWNER_SUB, tid: TENANT_A, roles, scope: "openid", iss: "mock", mfa: false },
        db_user: { sub: OWNER_SUB, tenant_id: TENANT_A, email, display_name: "Klarnote Owner", role: roles[0], status: "active" },
      });
    }
    if (path.endsWith("/readyz")) return json(200, { status: "ready" });
    if (path.endsWith("/healthz")) return json(200, { status: "ok", version: "1.2.3" });

    // ── the cross-tenant trio ────────────────────────────────────────
    if (path === "/tenants" && method === "GET") return json(200, { items: TENANT_SUMMARIES });
    const memberMatch = path.match(/^\/tenants\/([^/]+)\/members$/);
    if (memberMatch && method === "GET") return json(200, { items: MEMBERS[memberMatch[1]] || [] });
    const tenantMatch = path.match(/^\/tenants\/([^/]+)$/);
    if (tenantMatch && method === "GET") {
      const s = TENANT_SUMMARIES.find((t) => t.id === tenantMatch[1]);
      return s ? json(200, tenantDetail(s)) : json(404, { detail: "tenant not found" });
    }

    // ── active-tenant reads ──────────────────────────────────────────
    if (path === "/admin/users" && method === "GET") return json(200, USERS);
    if (path === "/audit/events" && method === "GET") {
      // Honour ?kind= — the real endpoint filters, and asrQuotaStatus() relies
      // on it: served unfiltered, the console would report a quota trip that
      // never happened.
      const kind = url.searchParams.get("kind");
      const events = kind ? auditEvents.filter((e) => e.kind === kind) : auditEvents;
      return json(200, { events });
    }
    if (path === "/audit/verify" && method === "GET") return json(200, { ok: true, from_seq: 42, to_seq: 44 });
    if (path === "/sessions" && method === "GET") return json(200, { sessions: [] });
    if (path === "/asr/jobs" && method === "GET") return json(200, { jobs: [] });
    if (path.startsWith("/v1/reports/search")) return json(200, { hits: [], total_exact: 0 });

    // ── templates (report-service) ───────────────────────────────────
    if (path === "/templates" && method === "GET") {
      // Honour ?include_deprecated= — the real endpoint hides deprecated
      // templates by default, and the console's "show deprecated" toggle is
      // meaningless if the mock ignores it.
      const inc = url.searchParams.get("include_deprecated") === "true";
      const items = inc ? TEMPLATES : TEMPLATES.filter((t) => t.status !== "deprecated");
      return json(200, { items });
    }
    if (path === "/templates" && method === "POST") return json(201, { id: "tpl-new" });
    if (path === "/templates/clone" && method === "POST") return json(201, { id: "tpl-clone" });
    if (/^\/templates\/[^/]+$/.test(path) && method === "DELETE") return json(204, null);

    return json(200, { items: [] });
  });
}

/** Sign in through the CLINIC front desk (#/login) — lands in the app shell. */
export async function login(page, email = OWNER_EMAIL) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("VOVAp1987@");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 10000 });
}

/**
 * Sign in through the STAFF door (#/company/login). Does not assert the
 * destination — callers test both the admitted and the refused outcome.
 */
export async function staffLogin(page, email = OWNER_EMAIL, password = "VOVAp1987@") {
  await page.goto("/#/company/login");
  await page.locator(".colog-field input[type='email']").fill(email);
  await page.locator(".colog-field input[type='password']").fill(password);
  await page.locator(".colog-btn.primary").click();
}

/**
 * Sign in through the staff door and land on a specific tab.
 *
 * Must WAIT for the console before navigating: a successful staff login ends in
 * the page's own `navigate("/company")`, so a goto issued before that lands
 * fires first and is then overwritten — the tab silently stays on Overview.
 */
export async function staffLoginTo(page, tab) {
  await staffLogin(page);
  await expect(page.locator(".co-rail-brand")).toBeVisible({ timeout: 15000 });
  await page.goto(`/#/company/${tab}`);
  await expect(page.locator(`.co-rail-group button.on`)).toBeVisible();
}

