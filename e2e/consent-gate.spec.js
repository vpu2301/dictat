// consent-gate.spec.js — FE sprint 11 step 05: recording is provably
// blocked/unblocked by consent state (the sprint doc's VERIFY), the gate
// fails CLOSED on fetch errors, re-checks on every start, `digital`
// round-trips through the consent sign dialog with the dev (mock) provider,
// and the Згоди tab withdraw flow re-blocks + renders struck rows.
//
// Observable for "recording started": any real start attempt moves the mic
// button's data-state off "idle" (headless Chromium has no usable Web
// Speech, so it lands in an error_* state — which still proves the gate
// LET THE ATTEMPT THROUGH). A blocked attempt leaves data-state="idle".
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const ENC_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
const ENVELOPE_ID = "55555555-5555-4555-8555-555555555555";

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: false,
};
const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: { sections: [{ id: "anamnesis", name: "Anamnesis", order: 0, required: true, field_type: "text", voice_aliases: ["anamnesis"] }] },
};
const ENCOUNTER = { id: ENC_ID, patient_id: PID, kind: "visit", reason: "огляд", occurred_at: "2026-07-16T08:00:00Z", status: "in_progress", created_at: "2026-07-16T08:00:00Z" };

// ctl.consents is the mutable server state; ctl.failConsents forces 500s.
async function installMocks(page, calls, ctl0 = {}) {
  const ctl = { sessionOpen: false, consents: [], failConsents: false, ...ctl0 };
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

    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);
    if (path === "/v1/reports" && method === "POST")
      return json(201, { id: "report-1", code: "R-1", version_id: "v1", version_number: 1, status: "draft" });
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT")
      return json(200, { id: "report-1", version_number: 2, status: "draft" });

    if (path === `/patients/${PID}` && method === "GET") return json(200, PATIENT);
    if (path === `/encounters/${ENC_ID}` && method === "GET") return json(200, ENCOUNTER);
    if (/\/patients\/.+\/(timeline)$/.test(path)) return json(200, { items: [] });
    if (/\/patients\/.+\/(encounters)$/.test(path) && method === "GET") return json(200, []);
    if (/\/patients\/.+\/(anamnesis)$/.test(path)) return json(200, { patient_id: PID, record: {}, updated_at: null });
    if (path === "/notes" && method === "GET") return json(200, { items: [] });
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT], next_cursor: null });

    // ── consents (the gate's server state) ──
    if (path === `/patients/${PID}/consents` && method === "GET") {
      calls.consentList.push(1);
      if (ctl.failConsents) return json(500, { title: "Internal Server Error", status: 500 });
      return json(200, ctl.consents);
    }
    if (path === `/patients/${PID}/consents` && method === "POST") {
      const body = req.postDataJSON();
      calls.consentCreate.push(body);
      const c = {
        id: `cccccccc-0000-4000-8000-${String(calls.consentCreate.length).padStart(12, "0")}`,
        patient_id: PID, encounter_id: body.encounter_id || null,
        type: body.type, method: body.method, version: body.version || "",
        status: "granted", granted_at: new Date().toISOString(),
        withdrawn_at: null, signed_envelope_id: null,
        signing: body.method === "digital"
          ? { resource_type: "consent", resource_id: "x", resource_version_id: "x", canonical_hash_hex: "ab".repeat(32) }
          : null,
      };
      const { signing, ...row } = c;
      ctl.consents.push(row);
      return json(201, c);
    }
    const signM = path.match(/^\/patients\/[0-9a-f-]{36}\/consents\/([0-9a-f-]{36})\/sign$/);
    if (signM && method === "POST") {
      const body = req.postDataJSON();
      calls.consentSign.push({ id: signM[1], body });
      const row = ctl.consents.find((c) => c.id === signM[1]);
      if (row) row.signed_envelope_id = ENVELOPE_ID;
      return json(200, {
        consent: { ...row }, envelope_id: ENVELOPE_ID, signature_level: "dev",
        verification_token: "vt", signed_at: new Date().toISOString(),
        signer_full_name: "Dr Test", is_qualified: false,
      });
    }
    const wdM = path.match(/^\/patients\/[0-9a-f-]{36}\/consents\/([0-9a-f-]{36})\/withdraw$/);
    if (wdM && method === "POST") {
      const row = ctl.consents.find((c) => c.id === wdM[1]);
      if (row) { row.status = "withdrawn"; row.withdrawn_at = new Date().toISOString(); }
      return json(200, { ...row });
    }

    return json(200, { items: [] });
  });
  return ctl;
}

function newCalls() { return { consentList: [], consentCreate: [], consentSign: [] }; }

async function openStudio(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto(`/#/studio?mode=dictate&patient=${PID}&encounter=${ENC_ID}`);
  await expect(page.getByTestId("studio-mic")).toBeVisible({ timeout: 10000 });
}

test("no consent → recording blocked, sheet opens on the attempt; verbal capture unblocks", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  // the blocked state explains itself before any click
  await expect(page.getByTestId("consent-gate-banner")).toContainText(/Потрібна згода|consent .* required/i);

  // record attempt: NOT let through (state stays idle), the sheet opens
  await page.getByTestId("studio-mic").click();
  await expect(page.getByTestId("consent-sheet")).toBeVisible();
  await expect(page.getByTestId("studio-mic")).toHaveAttribute("data-state", "idle");

  // capture verbal — the one POST the happy path costs
  await page.locator(".consent-method", { hasText: /Усно|Verbal/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Зафіксувати згоду|Record consent/ }).click();

  await expect.poll(() => calls.consentCreate.length).toBe(1);
  expect(calls.consentCreate[0]).toEqual({
    type: "ai_scribe", method: "verbal", version: "v1", status: "granted", encounter_id: ENC_ID,
  });

  // gate flipped: banner gone and the auto-start attempt went THROUGH the
  // gate (data-state leaves idle — headless has no usable speech engine)
  await expect(page.getByTestId("consent-gate-banner")).toHaveCount(0);
  await expect(page.getByTestId("studio-mic")).not.toHaveAttribute("data-state", "idle", { timeout: 5000 });
});

test("fail CLOSED: consent fetch error blocks recording with a retry — never a silent pass", async ({ page }) => {
  const calls = newCalls();
  const ctl = await installMocks(page, calls, { failConsents: true });
  await openStudio(page);

  await expect(page.getByTestId("consent-gate-error")).toContainText(/заблоковано|blocked/i);

  // attempt: no sheet, no start — blocked
  await page.getByTestId("studio-mic").click();
  await page.waitForTimeout(400);
  await expect(page.getByTestId("consent-sheet")).toHaveCount(0);
  await expect(page.getByTestId("studio-mic")).toHaveAttribute("data-state", "idle");

  // retry after the backend recovers → gate re-evaluates to "required"
  ctl.failConsents = false;
  await page.getByTestId("consent-gate-error").getByRole("button", { name: /Повторити|Retry/ }).click();
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible();
});

test("re-check on EVERY start: a consent withdrawn elsewhere blocks the next attempt", async ({ page }) => {
  const calls = newCalls();
  const ctl = await installMocks(page, calls, {
    consents: [{
      id: "cccccccc-0000-4000-8000-000000000099", patient_id: PID, encounter_id: null,
      type: "ai_scribe", method: "verbal", version: "v1", status: "granted",
      granted_at: "2026-07-16T07:00:00Z", withdrawn_at: null, signed_envelope_id: null,
    }],
  });
  await openStudio(page);
  await expect(page.getByTestId("consent-gate-banner")).toHaveCount(0);

  // first attempt passes the gate
  await page.getByTestId("studio-mic").click();
  await expect(page.getByTestId("studio-mic")).not.toHaveAttribute("data-state", "idle", { timeout: 5000 });
  const checksAfterFirst = calls.consentList.length;

  // consent is withdrawn from another session
  ctl.consents[0].status = "withdrawn";
  ctl.consents[0].withdrawn_at = new Date().toISOString();

  // attempt again — depending on where the failed speech engine left the
  // state machine, the first click may only pause; click until the start
  // path runs and the gate re-checks
  let sheetOpen = false;
  for (let i = 0; i < 3 && !sheetOpen; i++) {
    await page.getByTestId("studio-mic").click();
    sheetOpen = await page.getByTestId("consent-sheet").waitFor({ timeout: 2500 })
      .then(() => true).catch(() => false);
  }
  expect(sheetOpen).toBe(true);
  expect(calls.consentList.length).toBeGreaterThan(checksAfterFirst); // it DID re-ask the server
});

test("digital: capture → dev (mock) provider sign → envelope linked, badge shown", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  await page.getByTestId("studio-mic").click();
  await page.locator(".consent-method", { hasText: /КЕП/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Зафіксувати та підписати|Record & sign/ }).click();

  await expect.poll(() => calls.consentCreate.length).toBe(1);
  expect(calls.consentCreate[0].method).toBe("digital");

  // the sign dialog (consent flavour of S09): pick the dev scaffold provider
  await page.locator(".np-sex-toggle button", { hasText: /Тест-підпис|Dev signature/ }).click();
  await page.locator('.modal input[type="password"]').fill("dev-password");
  await page.locator(".modal .btn.accent", { hasText: /Підписати|^Sign$/ }).click();

  await expect(page.getByTestId("consent-signed-ok")).toContainText(ENVELOPE_ID);
  expect(calls.consentSign[0].body).toEqual({ provider: "dev_password", password: "dev-password" });

  // the gate is satisfied (consent exists granted) — recording attempt passes
  await page.locator(".modal .btn.accent", { hasText: /Готово|Done/ }).click();
  await page.getByTestId("studio-mic").click();
  await expect(page.getByTestId("studio-mic")).not.toHaveAttribute("data-state", "idle", { timeout: 5000 });
});

test("Згоди tab: withdraw needs the consequences dialog; withdrawn rows render struck and stay", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls, {
    consents: [
      { id: "cccccccc-0000-4000-8000-000000000010", patient_id: PID, encounter_id: null,
        type: "ai_scribe", method: "digital", version: "v1", status: "granted",
        granted_at: "2026-07-15T10:00:00Z", withdrawn_at: null, signed_envelope_id: null },
    ],
  });
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto(`/#/patients/${PID}?tab=consents`);

  const row = page.locator(".consent-row");
  await expect(row).toHaveCount(1);
  // unsigned digital shows its state + re-initiate action
  await expect(row.locator(".chip.draft")).toContainText(/не підписано|unsigned/);
  await expect(row.getByRole("button", { name: /Підписати|Sign/ })).toBeVisible();

  await row.getByRole("button", { name: /Відкликати|Withdraw/ }).click();
  const dlg = page.locator(".modal");
  await expect(dlg).toContainText(/нові записи.*заблоковано|new recordings.*blocked/i);
  await expect(dlg).toContainText(/вже створені.*зберігаються|already created are retained/i);
  await dlg.getByRole("button", { name: /Відкликати згоду|Withdraw consent/ }).click();

  // struck, both dates, never disappears
  await expect(page.locator(".consent-row.withdrawn")).toHaveCount(1);
  await expect(page.locator(".consent-row .status-badge")).toContainText(/Відкликано|Withdrawn/);
  await expect(page.locator(".consent-row .cr-detail")).toContainText(/відкликано|withdrawn/);
});
