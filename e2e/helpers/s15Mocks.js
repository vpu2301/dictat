// s15Mocks.js — shared route mocks for the sprint-15 suites.
//
// The mocks enforce the REAL wire contracts (extra="forbid" bodies, the
// layer_c telemetry rules, the ?expand= param) so a contract regression fails
// the E2E instead of silently passing against a permissive fake.

export const TENANT_A = "00000000-0000-0000-0000-00000000000a";
export const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
export const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";
export const REPORT_ID = "33333333-3333-3333-3333-333333333333";

export const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: {
    sections: [
      { id: "anamnesis", name: "Anamnesis", order: 0, required: false, field_type: "text", voice_aliases: ["anamnesis"] },
    ],
  },
};

export const PATIENT = {
  id: PATIENT_ID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1980-01-01",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

export const API_PORTS = ["8000", "8001", "8002", "8003", "8004", "8005", "8006", "8007", "8008", "8009"];

export function newCalls() {
  return { completions: [], telemetry: [], suggest: [], badCompletion: [], badTelemetry: [], search: [], tips: 0, clips: [], segments: [] };
}

// Base app mocks: auth, templates, patients, drafts. Every spec layers its own
// feature routes on top (Playwright matches the most recently registered
// handler first).
export async function installBaseMocks(page, calls, opts = {}) {
  const ctl = { sessionOpen: false, layerCEnabled: opts.layerCEnabled !== false };

  const isApi = (url) =>
    url.hostname === "localhost" && API_PORTS.includes(url.port);

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const port = url.port;
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    // ── auth-service ──
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
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }

    // generation-service /readyz IS the Layer C feature flag (there is no
    // bootstrap payload). Must be answered before the generic health route.
    if (port === "8009" && path.endsWith("/readyz")) {
      return json(200, { status: "ready", layer_c_enabled: ctl.layerCEnabled, model: "gemma3:1b" });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    // ── templates / patients ──
    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT] });
    if (path === `/patients/${PATIENT_ID}` && method === "GET") return json(200, PATIENT);
    if (path === "/consents" || path.startsWith("/consents")) {
      return json(200, { items: [{ id: "c1", patient_id: PATIENT_ID, type: "recording", status: "active" }] });
    }

    // ── report drafts ──
    if (path === "/v1/reports" && method === "POST")
      return json(201, { id: REPORT_ID, version_number: 1, patient_id: PATIENT_ID, status: "draft" });
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT")
      return json(200, { id: REPORT_ID, version_number: 2, status: "draft" });

    // ── autocomplete-service ──
    // Layer A stays deliberately silent in the sprint-15 suites: Layer C only
    // speaks when the corpus has nothing, and that is the state under test.
    if (path === "/autocomplete/suggest" && method === "POST") {
      calls.suggest.push(req.postDataJSON());
      return json(200, { request_id: `ac-${calls.suggest.length}`, suggestions: [] });
    }
    if (path === "/autocomplete/telemetry" && method === "POST") {
      const body = req.postDataJSON();
      calls.telemetry.push(body);
      // The real backend 422s a layer_c event carrying a corpus id.
      if (body.source === "layer_c" && (body.phrase_id || body.snippet_id)) {
        calls.badTelemetry.push(body);
        return json(422, { title: "Unprocessable Content" });
      }
      return route.fulfill({ status: 204, body: "" });
    }

    return json(200, { items: [] });
  });

  return ctl;
}

export async function login(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await page.locator(".sb-brand").waitFor({ state: "visible", timeout: 15000 });
}

export async function openStudio(page) {
  await login(page);
  await page.goto("/#/dictate/studio");
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await gateRow.waitFor({ state: "visible", timeout: 15000 });
  await gateRow.click();
  const editor = page.locator(".ProseMirror").first();
  await editor.waitFor({ state: "visible", timeout: 15000 });
  await editor.click();
  return editor;
}

// Suppress the one-time Layer C coach-mark for specs that are not testing it
// (it is fixed-positioned near the caret and would sit over the touch chip).
export async function suppressCoachMark(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("mdx.layerc.coach.v1.user-123", "1"); } catch { /* ignore */ }
  });
}
