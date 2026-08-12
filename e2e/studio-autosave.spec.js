// studio-autosave.spec.js — reproduce "autosave doesn't work" in the Studio.
// Mocks auth + report/core services, drives the real SPA: pick a patient in
// the gate, type, and assert an autosave create fires.
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
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    // ── auth (refresh/me 401 until an explicit login, like auth.spec) ──
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

    // ── templates (report-service :8006) ──
    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_SUMMARY] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);

    // ── patients (core :8003) ──
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT] });
    if (path === `/patients/${PATIENT_ID}` && method === "GET") return json(200, PATIENT);

    // ── existing report (draft reopen) ──
    if (path === "/v1/reports/report-9" && method === "GET") {
      calls.getReport++;
      return json(200, {
        id: "report-9", status: "draft", patient_id: PATIENT_ID, version_number: 3,
        content: {
          template_id: TEMPLATE_ID, template_schema_version: 1,
          sections: [{ section_key: "findings", text: "Existing findings text." }],
        },
      });
    }

    // ── reports autosave ──
    if (path === "/v1/reports" && method === "POST") {
      calls.create++;
      calls.lastCreateBody = req.postDataJSON();
      return json(201, { id: "report-1", version_number: 1, patient_id: PATIENT_ID, status: "draft" });
    }
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT") {
      calls.update++;
      calls.lastUpdateBody = req.postDataJSON();
      (calls.updateVersions ||= []).push(req.postDataJSON()?.expected_version);
      // Simulate the backend autosave rate limiter on the first PUT.
      if (calls.rateLimitFirstPut && calls.update === 1) {
        return route.fulfill({
          status: 429,
          headers: { "Retry-After": "1", "content-type": "application/json" },
          body: JSON.stringify({ detail: { error: "autosave_rate_limited", retry_after: 1 } }),
        });
      }
      // Simulate an optimistic-lock conflict where the server is far ahead and
      // reports `detail` as a Python dict repr STRING (single quotes), not an
      // object — the shape that leaked the raw error into a toast.
      if (calls.conflictFirstPut && calls.update === 1) {
        return route.fulfill({
          status: 409,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            detail: "{'error': 'optimistic_lock_mismatch', 'current_version': 11, 'expected_version': 1}",
          }),
        });
      }
      return json(200, { id: "report-9", version_number: calls.update + 3, status: "draft" });
    }

    // autocomplete / everything else → empty
    return json(200, { items: [] });
  });
}

test("typing in the Studio triggers an autosave create", async ({ page }) => {
  const calls = { create: 0, update: 0, lastCreateBody: null };
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

  await installMocks(page, calls);

  // login
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();

  // studio
  await page.goto("/#/studio?mode=dictate");

  // patient gate → open it from the header (the workspace no longer pops it
  // on arrival) and pick the seeded patient
  await page.locator("[data-testid='sw-patient']").click();
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await expect(gateRow).toBeVisible({ timeout: 10000 });
  await gateRow.click();

  // editor should mount
  const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
  await expect(editor).toBeVisible({ timeout: 10000 });

  // type
  await editor.click();
  await page.keyboard.type("Normal brain parenchyma. No acute findings.");

  // wait out the idle debounce for the create
  await page.waitForTimeout(3000);
  // keep editing → should UPDATE the same report, not create a second one.
  // Autosave is paced to the backend's 5s/draft limit, so allow >6s.
  await editor.click();
  await page.keyboard.type(" Addendum line.");
  await page.waitForTimeout(8000);

  console.log("CREATE calls:", calls.create, "UPDATE calls:", calls.update);
  console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
  console.log("CREATE BODY:", JSON.stringify(calls.lastCreateBody));

  expect(calls.create).toBe(1);        // exactly one report created (no dup-create race)
  expect(calls.update).toBeGreaterThan(0); // subsequent edits update it
});

test("reopening a draft autosaves via PUT (update, not create)", async ({ page }) => {
  const calls = { create: 0, update: 0, getReport: 0, lastCreateBody: null };
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

  await installMocks(page, calls);

  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();

  // reopen an existing draft
  await page.goto("/#/studio?mode=dictate&report=report-9");

  // editor should mount straight into the rehydrated draft (no patient gate)
  const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
  await expect(editor).toBeVisible({ timeout: 10000 });

  await editor.click();
  await page.keyboard.type(" plus an addendum.");

  await page.waitForTimeout(2500);

  console.log("[reopen] getReport:", calls.getReport, "CREATE:", calls.create, "UPDATE:", calls.update);
  console.log("[reopen] CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));

  // A reopened draft must UPDATE its own report, never create a new one.
  expect(calls.getReport).toBeGreaterThan(0);
  expect(calls.create).toBe(0);
  expect(calls.update).toBeGreaterThan(0);
});

test("a 429 autosave_rate_limited is handled silently and the save still lands", async ({ page }) => {
  const calls = { create: 0, update: 0, getReport: 0, rateLimitFirstPut: true };
  await installMocks(page, calls);

  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();

  await page.goto("/#/studio?mode=dictate&report=report-9");
  const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(" first edit.");

  // wait through the first (429'd) save + the retry_after backoff + a successful retry
  await page.waitForTimeout(9000);
  await editor.click();
  await page.keyboard.type(" second edit.");
  await page.waitForTimeout(9000);

  // No "Не вдалося / rate limited" toast should ever be shown to the user.
  const toastText = (await page.locator(".toast").allTextContents()).join(" | ");
  console.log("[429] updates:", calls.update, "toasts:", JSON.stringify(toastText));
  expect(toastText).not.toContain("rate_limited");
  expect(toastText).not.toContain("Не вдалося");
  // Despite the first 429, a save eventually succeeds (≥2 PUTs attempted).
  expect(calls.update).toBeGreaterThanOrEqual(2);
});

test("a 409 optimistic_lock_mismatch (stringified detail) is recovered silently", async ({ page }) => {
  const calls = { create: 0, update: 0, getReport: 0, conflictFirstPut: true, lastUpdateBody: null };
  await installMocks(page, calls);

  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();

  // Reopen a draft seeded at version 3; the server (conflictFirstPut) answers
  // the first PUT with a 409 saying current_version is 11.
  await page.goto("/#/studio?mode=dictate&report=report-9");
  const editor = page.locator(".ProseMirror, [contenteditable='true']").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(" first edit.");

  // Let the first (409'd) save fire, then a retry.
  await page.waitForTimeout(9000);
  await editor.click();
  await page.keyboard.type(" second edit.");
  await page.waitForTimeout(9000);

  // The raw conflict payload must never reach the user as a toast.
  const toastText = (await page.locator(".toast").allTextContents()).join(" | ");
  console.log("[409] updates:", calls.update, "versions:", JSON.stringify(calls.updateVersions), "toasts:", JSON.stringify(toastText));
  expect(toastText).not.toContain("optimistic_lock_mismatch");
  expect(toastText).not.toContain("Не вдалося");
  // The retry adopts the server's current_version (11) from the conflict,
  // instead of re-sending the stale seeded version forever.
  expect(calls.update).toBeGreaterThanOrEqual(2);
  expect(calls.updateVersions).toContain(11);
});
