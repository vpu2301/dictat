// patient-page.spec.js — FE sprint 11 step 03: identity header, the merged
// clinical feed (all artifact kinds, newest first), deep links, per-source
// error isolation, ?tab= enum deep links, and the hygiene rules on this
// screen (full DOB allowed in the HEADER, opaque-UUID routes, no storage).
//
// Hermetic: real wire shapes (timeline carries dictate + recording rows —
// metadata only, no media URL, matching the backend's deliberate exclusion).
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const ENC_ID = "22222222-2222-4222-8222-222222222222";

const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "Гіпертонія", en: "Hypertension" },
  tags: ["діабет"], status: "active", last_visit: hoursAgo(2),
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: true,
};

// Interleaved kinds, newest first: consent(1h) → recording(2h) →
// encounter(3h) → report(4h) → note(5h)
const TIMELINE = {
  items: [
    { id: "aaaaaaaa-0000-4000-8000-000000000001", kind: "recording", title: "Recording",
      date: hoursAgo(2), status: "completed", by: null, encounter_id: ENC_ID, duration_s: 61.5 },
    { id: "aaaaaaaa-0000-4000-8000-000000000002", kind: "dictate", title: "Виписка кардіолога",
      date: hoursAgo(4), status: "signed", by: "Dr Test", encounter_id: null, duration_s: null },
  ],
};
const ENCOUNTERS = [
  { id: ENC_ID, patient_id: PID, kind: "visit", reason: "плановий огляд",
    occurred_at: hoursAgo(3), status: "completed", created_at: hoursAgo(3) },
];
const CONSENTS = [
  { id: "cccccccc-0000-4000-8000-000000000001", patient_id: PID, encounter_id: ENC_ID,
    type: "ai_scribe", method: "verbal", version: "", status: "granted",
    granted_at: hoursAgo(1), withdrawn_at: null, signed_envelope_id: null },
];
const NOTES = {
  items: [
    { id: "dddddddd-0000-4000-8000-000000000001", patient_id: PID, encounter_id: null,
      structure: "soap", title: "SOAP-нотатка", sections: [], status: "draft",
      author_id: "u1", source_session_id: null, created_at: hoursAgo(5), updated_at: hoursAgo(5), signed_at: null },
  ],
};

async function installMocks(page, calls, opts = {}) {
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

    if (path === `/patients/${PID}` && method === "GET") return json(200, PATIENT);
    if (path === `/patients/${PID}/timeline`) return json(200, TIMELINE);
    if (path === `/patients/${PID}/encounters` && method === "GET") {
      if (opts.failEncounters) return json(500, { title: "Internal Server Error", status: 500, detail: "boom" });
      return json(200, ENCOUNTERS);
    }
    if (path === `/patients/${PID}/encounters` && method === "POST") {
      const body = req.postDataJSON();
      calls.encounterCreate.push(body);
      return json(201, { id: "22222222-9999-4999-8999-999999999999", patient_id: PID, kind: body.kind, reason: body.reason, occurred_at: hoursAgo(0), status: "completed", created_at: hoursAgo(0) });
    }
    if (path === `/patients/${PID}/consents` && method === "GET") return json(200, CONSENTS);
    if (path === `/patients/${PID}/anamnesis`) return json(200, { patient_id: PID, record: { allergies: ["пеніцилін"] }, updated_at: hoursAgo(24) });
    if (path === "/notes" && method === "GET") return json(200, NOTES);
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT], next_cursor: null });

    return json(200, { items: [] });
  });
  return ctl;
}

function newCalls() { return { encounterCreate: [] }; }

async function openPatient(page, tail = "") {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto(`/#/patients/${PID}${tail}`);
  await expect(page.locator(".ph-card")).toBeVisible({ timeout: 10000 });
}

test("merged feed renders every artifact kind, newest first", async ({ page }) => {
  await installMocks(page, newCalls());
  await openPatient(page);

  const rows = page.locator(".tl-row");
  await expect(rows).toHaveCount(5);
  // consent(1h) → recording(2h) → encounter(3h) → report(4h) → note(5h)
  await expect(rows.nth(0)).toHaveClass(/tl-type-consent/);
  await expect(rows.nth(1)).toHaveClass(/tl-type-recording/);
  await expect(rows.nth(2)).toHaveClass(/tl-type-encounter/);
  await expect(rows.nth(3)).toHaveClass(/tl-type-report/);
  await expect(rows.nth(4)).toHaveClass(/tl-type-note/);

  // recording row: duration rendered, and NEVER a media element or URL
  await expect(rows.nth(1)).toContainText("1:02");
  expect(await page.locator("audio, video").count()).toBe(0);
  const feedText = await page.locator(".tl-group").allInnerTexts();
  expect(feedText.join(" ")).not.toMatch(/\.mp3|\.wav|\.ogg|media_url|https?:\/\//);
});

test("header shows full identity (allowed HERE): full DOB, ІПН badge, status, allergy", async ({ page }) => {
  await installMocks(page, newCalls());
  await openPatient(page);

  const header = page.locator(".ph-card");
  await expect(header).toContainText("Іван Петренко");
  await expect(header).toContainText("1984-03-12"); // full DOB is correct on the record page
  await expect(header.locator(".pdir-ipn-chip")).toBeVisible(); // presence badge, never the number
  await expect(header).toContainText("MRN-001");
  await expect(header.locator(".allergy-chip")).toBeVisible();
  expect(await header.innerText()).not.toMatch(/\d{10}/); // no raw ІПН anywhere
});

test("deep links open existing screens; browser-back restores the active tab", async ({ page }) => {
  await installMocks(page, newCalls());
  await openPatient(page);

  // switch to the Reports tab, open the report, go back → Reports tab kept
  await page.locator(".tabs .tab", { hasText: /Звіти|Reports/ }).click();
  await page.locator(".tab.on", { hasText: /Звіти|Reports/ }).waitFor();
  await page.getByText("Виписка кардіолога").click();
  await expect(page).toHaveURL(/#\/dictate\/reports\/aaaaaaaa-0000-4000-8000-000000000002$/);
  await page.goBack();
  await expect(page.locator(".ph-card")).toBeVisible();
  await expect(page.locator(".tab.on")).toContainText(/Звіти|Reports/);

  // note deep link from the merged feed
  await page.locator(".tabs .tab", { hasText: /Усе|All/ }).first().click();
  await page.locator(".tl-row.tl-type-note").click();
  await expect(page).toHaveURL(/#\/scribe\/notes\/dddddddd-0000-4000-8000-000000000001/);
});

test("?tab= enum deep link opens that tab; URL carries UUID + enum only", async ({ page }) => {
  await installMocks(page, newCalls());
  await openPatient(page, "?tab=consents");

  await expect(page.locator(".tab.on")).toContainText(/Згоди|Consents/);
  await expect(page.locator(".consent-row")).toHaveCount(1);
  await expect(page.locator(".consent-row")).toContainText(/AI-скрайб|AI Scribe/);

  // hygiene on this screen: URL has nothing identifying, storage untouched
  expect(decodeURIComponent(page.url())).not.toMatch(/Іван|Петренко|MRN-001|1984/);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  for (const leak of ["Іван", "Петренко", "MRN-001", "1984"]) expect(storage).not.toContain(leak);
});

test("one failing source degrades its tab and warns in the feed — never blanks the page", async ({ page }) => {
  await installMocks(page, newCalls(), { failEncounters: true });
  await openPatient(page);

  // the feed still renders the other four kinds + a source warning
  await expect(page.locator(".tl-source-warn")).toContainText(/прийоми|encounters/);
  await expect(page.locator(".tl-row")).toHaveCount(4);
  await expect(page.locator(".tl-row.tl-type-report")).toBeVisible();

  // the encounters tab shows its own error state, nothing else broken
  await page.locator(".tabs .tab", { hasText: /Прийоми|Encounters/ }).click();
  await expect(page.locator('[role="alert"]')).toContainText(/Internal Server Error|Помилка|boom/);
});

test("new encounter sends only as-built enum kinds", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openPatient(page);

  await page.locator(".tabs .tab", { hasText: /Прийоми|Encounters/ }).click();
  await page.getByRole("button", { name: /Додати без диктування|Log without dictation/ }).click();
  const modal = page.locator(".modal");

  await modal.locator(".menu-select-trigger").click();
  const opts = modal.locator(".spec-menu-item");
  const labels = await opts.allTextContents();
  expect(labels).toEqual([
    "Візит", "Повторний прийом", "Телефонна консультація", "Відеоконсультація", "Інше",
  ]);
  await opts.filter({ hasText: "Повторний прийом" }).click();
  await modal.locator("textarea").fill("контроль тиску");
  await modal.getByRole("button", { name: /Зберегти|Save/ }).click();
  await expect(modal).toHaveCount(0);
  expect(calls.encounterCreate[0].kind).toBe("followup");
});
