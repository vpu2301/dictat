// studio-templates-auth.spec.js — reproduce "opening the Studio from a patient
// shows 'No templates available' instead of the recording surface".
//
// Root cause: App.jsx fetched the shared template summaries ONCE at mount. The
// SPA keeps the access token in memory only (client.js), so on a fresh login
// (no refresh cookie → RootGate renders App unauthenticated) that mount-time
// GET /templates fired WITHOUT a bearer token, 401'd, and — keyed on [] — never
// re-fetched after sign-in. templatesMap stayed empty forever, so the Studio's
// template auto-select never ran and the gate fell through to "No templates".
//
// Unlike studio-autosave.spec.js, this mock ENFORCES auth on /templates (a
// missing/blank bearer → 401), which is what the real report-service does and
// what the leaner mock failed to model. That faithfulness is what makes the
// bug reproducible here.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

function meBody(roles = ["clinician"]) {
  return {
    claims: { sub: "user-123", tid: TENANT_A, roles, scope: "openid", iss: "mock", mfa: false },
    db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: roles[0], status: "active" },
  };
}
const TEMPLATE_SUMMARY = {
  id: TEMPLATE_ID, code: "MRI-BRAIN", name: "MRI Brain", specialty: "radiology",
  is_system: true, status: "active", language: "en", schema_version: 1,
};
const TEMPLATE_DETAIL = {
  ...TEMPLATE_SUMMARY,
  schema_jsonb: {
    sections: [
      { id: "findings", name: "Findings", order: 0, required: true, field_type: "text", voice_aliases: ["findings"] },
      { id: "impression", name: "Impression", order: 1, required: false, field_type: "text", voice_aliases: ["impression"] },
    ],
  },
};
const PATIENT = {
  id: PATIENT_ID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1980-01-01",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

async function installMocks(page, calls) {
  const ctl = { sessionOpen: false };
  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8005", "8006", "8007", "8008"].includes(url.port);

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const bearer = (req.headers()["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    // ── auth: unauthenticated until an explicit login ──
    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, meBody());
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    // ── templates (report-service :8006) — AUTH-ENFORCED like the real service ──
    if (path === "/templates" && method === "GET") {
      calls.listTemplates = (calls.listTemplates || 0) + 1;
      if (!bearer) { calls.listTemplatesUnauthed = (calls.listTemplatesUnauthed || 0) + 1; return json(401, { title: "missing_bearer" }); }
      return json(200, { items: [TEMPLATE_SUMMARY] });
    }
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") {
      if (!bearer) return json(401, { title: "missing_bearer" });
      return json(200, TEMPLATE_DETAIL);
    }

    // ── patients (core :8003) ──
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT] });
    if (path === `/patients/${PATIENT_ID}` && method === "GET") return json(200, PATIENT);

    // reports create (autosave may fire once the editor mounts)
    if (path === "/v1/reports" && method === "POST") return json(201, { id: "report-1", version_number: 1, patient_id: PATIENT_ID, status: "draft" });
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT") return json(200, { id: "report-1", version_number: 2, status: "draft" });

    return json(200, { items: [] });
  });
}

test("fresh login → open Studio from a patient → template loads (not 'No templates available')", async ({ page }) => {
  const calls = {};
  await installMocks(page, calls);

  // Fresh login (no refresh cookie): App first mounts unauthenticated.
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();

  // Enter the Studio directly from a patient (no ?template= — relies on the
  // shared template list + auto-select, exactly the reported flow).
  await page.goto(`/#/studio?mode=dictate&patient=${PATIENT_ID}`);

  // The editor must mount. The regression rendered the "No templates available"
  // empty state here instead.
  const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=No templates available")).toHaveCount(0);

  // The template list was re-fetched AFTER auth (with a bearer), which is the fix.
  expect(calls.listTemplates).toBeGreaterThan(0);
});
