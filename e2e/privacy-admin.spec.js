// privacy-admin.spec.js — FE sprint 11 step 06: role gating (hidden +
// deep-link-safe), the two-person mirror, the weighty erasure request form,
// the verbatim execution report, and the DSAR download lifecycle.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const MY_SUB = "user-123";
const OTHER_SUB = "aaaa0000-0000-4000-8000-000000000001";

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: false,
};

const REQ = (over = {}) => ({
  id: "eeeeeeee-0000-4000-8000-000000000001", patient_id: PID, kind: "erasure",
  reason: "письмова вимога пацієнта про реалізацію права на забуття від 15.07.2026, реєстр. №123",
  status: "requested", requested_by: OTHER_SUB, requested_at: new Date(Date.now() - 3600e3).toISOString(),
  scheduled_for: null, reviewed_by: null, reviewed_at: null, rejection_reason: null, completed_at: null,
  ...over,
});

const EXEC_REPORT = {
  executed_at: "2026-07-16T12:00:00Z", engine_version: "erasure-engine/1", operator: "erasure-engine",
  destroyed: [
    { kind: "audio_file", id: "a-1", detail: "32s webm" },
    { kind: "audio_file", id: "a-2", detail: "61s webm" },
    { kind: "transcript", id: "t-1", detail: null },
    { kind: "patient", id: PID, detail: "identity fields nulled; ІПН crypto-shredded" },
  ],
  retained: [
    { kind: "report", id: "r-1", legal_basis: "retention:clinical_record_signed" },
    { kind: "consent", id: "c-1", legal_basis: "retention:consent_record" },
    { kind: "envelope", id: "e-1", legal_basis: "retention:mystery_future_basis" }, // unknown → raw
  ],
  counts: { destroyed: 4, retained: 3, inventory_before: 7 },
};

async function installMocks(page, calls, opts = {}) {
  const ctl = {
    sessionOpen: false,
    roles: opts.roles || ["tenant_admin"],
    requests: opts.requests || [],
    detail: opts.detail || {},           // id → PrivacyRequestStatus extras
    dsar409: opts.dsar409 || false,
    approve403: opts.approve403 || false,
  };
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
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "u@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: MY_SUB, tid: TENANT_A, roles: ctl.roles, scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "u@tenant-a.example", display_name: "Admin Test", role: ctl.roles[0], status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    if (path === `/patients/${PID}` && method === "GET") return json(200, PATIENT);
    if (/\/patients\/.+\/(timeline)$/.test(path)) return json(200, { items: [] });
    if (/\/patients\/.+\/(encounters|consents)$/.test(path) && method === "GET") return json(200, []);
    if (/\/patients\/.+\/(anamnesis)$/.test(path)) return json(200, { patient_id: PID, record: {}, updated_at: null });
    if (path === "/notes" && method === "GET") return json(200, { items: [] });
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT], next_cursor: null });

    if (path === `/patients/${PID}/dsar` && method === "POST") {
      calls.dsar.push(req.postDataJSON());
      if (ctl.dsar409) return json(409, { title: "Conflict", status: 409, code: "dsar_already_running", request_id: "existing-1" });
      return json(202, REQ({ id: "dddd0000-0000-4000-8000-000000000001", kind: "dsar", status: "executing", requested_by: MY_SUB }));
    }
    if (path === `/patients/${PID}/erasure` && method === "POST") {
      calls.erasure.push(req.postDataJSON());
      return json(201, REQ({ requested_by: MY_SUB }));
    }

    if (path === "/privacy-requests" && method === "GET") return json(200, ctl.requests);
    const idm = path.match(/^\/privacy-requests\/([0-9a-z-]+)$/);
    if (idm && method === "GET") {
      calls.statusGet.push(idm[1]);
      const base = ctl.requests.find((r) => r.id === idm[1]) || REQ({ id: idm[1] });
      return json(200, { ...base, download: null, package_expired: false, manifest_summary: null, ...(ctl.detail[idm[1]] || {}) });
    }
    const act = path.match(/^\/privacy-requests\/([0-9a-z-]+)\/(review|approve|reject)$/);
    if (act && method === "POST") {
      calls.actions.push({ id: act[1], action: act[2], body: req.postDataJSON?.() });
      if (act[2] === "approve" && ctl.approve403) {
        return json(403, { title: "Forbidden", status: 403, code: "two_person_rule", detail: "approver must differ from requester" });
      }
      const row = ctl.requests.find((r) => r.id === act[1]) || REQ({ id: act[1] });
      const next = act[2] === "approve"
        ? { ...row, status: "approved", scheduled_for: new Date(Date.now() + 7 * 86400e3).toISOString(), reviewed_by: MY_SUB }
        : act[2] === "reject"
          ? { ...row, status: "rejected", rejection_reason: "test", reviewed_by: MY_SUB }
          : { ...row, status: "review" };
      Object.assign(row, next);
      return json(200, next);
    }
    if (/^\/privacy-requests\/[0-9a-z-]+\/download$/.test(path)) {
      return route.fulfill({ status: 200, contentType: "application/zip", body: Buffer.from("PK\x03\x04dsar") });
    }

    return json(200, { items: [] });
  });
  return ctl;
}

function newCalls() { return { dsar: [], erasure: [], actions: [], statusGet: [] }; }

async function login(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("u@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
}

test("clinician: privacy surfaces hidden AND deep-link-safe (standard forbidden state)", async ({ page }) => {
  await installMocks(page, newCalls(), { roles: ["clinician"] });
  await login(page);

  // patient page: no DSAR / erasure entries at all
  await page.goto(`/#/patients/${PID}`);
  await expect(page.locator(".ph-card")).toBeVisible();
  await expect(page.getByRole("button", { name: /DSAR/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /видалення|erasure/i })).toHaveCount(0);

  // sidebar: no Приватність entry
  await expect(page.locator(".sidebar, nav").getByText(/Приватність|Privacy/)).toHaveCount(0);

  // deep links land on the standard forbidden state
  await page.goto("/#/admin/privacy");
  await expect(page.getByText(/Access denied|Доступ заборонено/i).first()).toBeVisible({ timeout: 10000 });
  await page.goto(`/#/patients/${PID}/erasure-request`);
  await expect(page.getByText(/Access denied|Доступ заборонено/i).first()).toBeVisible();
});

test("two-person mirror: own request has NO approve controls, others' do; raced 403 handled", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls, {
    requests: [
      REQ({ id: "eeeeeeee-0000-4000-8000-00000000000a", requested_by: MY_SUB }),
      REQ({ id: "eeeeeeee-0000-4000-8000-00000000000b", requested_by: OTHER_SUB }),
    ],
    approve403: true, // simulate the race: server still says two_person_rule
  });
  await login(page);
  await page.goto("/#/admin/privacy");

  const rows = page.locator(".privacy-row");
  await expect(rows).toHaveCount(2);

  const own = rows.filter({ has: page.getByTestId("own-request-badge") });
  await expect(own).toHaveCount(1);
  await expect(own.getByTestId("approve-btn")).toHaveCount(0);
  await expect(own.getByTestId("reject-btn")).toHaveCount(0);
  await expect(own.getByTestId("own-request-badge")).toContainText(/іншим адміністратором|another administrator/);

  const other = rows.filter({ hasNot: page.getByTestId("own-request-badge") });
  await other.getByTestId("approve-btn").click();
  await page.locator(".modal .btn.accent", { hasText: /Схвалити|Approve/ }).click();
  await expect(page.locator(".modal [role=alert]")).toContainText(/Правило двох осіб|Two-person rule/);
});

test("erasure form: consequences copy, 50-char reason, exact «ВИДАЛЕННЯ», request wording", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await login(page);
  await page.goto(`/#/patients/${PID}/erasure-request`);

  const pageRoot = page.getByTestId("erasure-request-page");
  await expect(pageRoot).toBeVisible();
  // consequences enumerated as fixed copy — both directions
  await expect(pageRoot).toContainText(/безповоротно знищено/);
  await expect(pageRoot).toContainText(/збережено/i);
  await expect(pageRoot).toContainText(/інший адміністратор/);
  // the CTA is a REQUEST, never a delete verb
  const cta = pageRoot.getByRole("button", { name: /Надіслати запит на видалення/ });
  await expect(cta).toBeDisabled();

  // short reason + wrong word keep it disabled
  await pageRoot.locator("textarea").fill("закоротко");
  await pageRoot.locator("input.privacy-confirm").fill("ВИДАЛИТИ");
  await expect(cta).toBeDisabled();

  const reason = "Письмова вимога пацієнта від 15.07.2026 про реалізацію права на забуття згідно зі ст. 17 GDPR.";
  await pageRoot.locator("textarea").fill(reason);
  await expect(cta).toBeDisabled(); // word still wrong
  await pageRoot.locator("input.privacy-confirm").fill("ВИДАЛЕННЯ");
  await expect(cta).toBeEnabled();
  await cta.click();

  await expect(page.getByTestId("erasure-request-created")).toContainText(/інший адміністратор/);
  expect(calls.erasure[0]).toEqual({ reason });
});

test("execution report renders destroyed vs retained verbatim; unknown basis stays raw", async ({ page }) => {
  const done = REQ({ id: "eeeeeeee-0000-4000-8000-0000000000cc", status: "completed", requested_by: OTHER_SUB, completed_at: "2026-07-16T12:00:00Z" });
  await installMocks(page, newCalls(), {
    requests: [done],
    detail: { [done.id]: { manifest_summary: EXEC_REPORT } },
  });
  await login(page);
  await page.goto("/#/admin/privacy");

  await page.locator(".privacy-row-main").click(); // expand
  const report = page.getByTestId("execution-report");
  await expect(report).toBeVisible();

  // destroyed: grouped by kind with counts
  await expect(report).toContainText(/Знищено/);
  await expect(report).toContainText("Аудіозаписи — 2");
  await expect(report).toContainText(/Транскрипти — 1/);
  await expect(report).toContainText(/ІПН|Ідентифікаційні дані/);

  // retained: every row with its legal basis; unknown basis renders RAW
  await expect(report).toContainText(/Збережено згідно із законом/);
  await expect(report).toContainText(/обов'язковий строк зберігання клінічної документації/);
  await expect(report).toContainText(/доказ правової підстави/);
  await expect(report).toContainText("retention:mystery_future_basis");

  // metadata footer
  await expect(report).toContainText("erasure-engine/1");
  await expect(report).toContainText(/Виконано/);
});

test("approved erasure: grace countdown + cancel-during-grace via the reject path", async ({ page }) => {
  const calls = newCalls();
  const appr = REQ({
    id: "eeeeeeee-0000-4000-8000-0000000000dd", status: "approved", requested_by: OTHER_SUB,
    scheduled_for: new Date(Date.now() + 5 * 86400e3 + 7200e3).toISOString(),
  });
  await installMocks(page, calls, { requests: [appr] });
  await login(page);
  await page.goto("/#/admin/privacy");

  await expect(page.getByTestId("grace-countdown")).toContainText(/залишилось 5 дн|5d/);
  await page.getByRole("button", { name: /Скасувати видалення|Cancel the erasure/ }).click();
  const dlg = page.locator(".modal");
  const confirmBtn = dlg.getByRole("button", { name: /Скасувати видалення|Cancel the erasure/ });
  await expect(confirmBtn).toBeDisabled(); // reason required
  await dlg.locator("textarea").fill("Пацієнт відкликав вимогу 16.07.2026, лист у справі.");
  await confirmBtn.click();
  await expect.poll(() => calls.actions.length).toBe(1);
  expect(calls.actions[0].action).toBe("reject");
  expect(calls.actions[0].body.rejection_reason).toContain("відкликав");
});

test("DSAR: fresh mint per click, visible expiry, real download; expired → re-request copy; 409 → queue", async ({ page }) => {
  const calls = newCalls();
  const dsarDone = REQ({
    id: "dddd0000-0000-4000-8000-0000000000ee", kind: "dsar", status: "completed",
    requested_by: MY_SUB, completed_at: "2026-07-16T10:00:00Z",
  });
  const dsarExpired = REQ({
    id: "dddd0000-0000-4000-8000-0000000000ff", kind: "dsar", status: "completed",
    requested_by: MY_SUB, completed_at: "2026-06-01T10:00:00Z",
  });
  const ctl = await installMocks(page, calls, {
    requests: [dsarDone, dsarExpired],
    detail: {
      [dsarDone.id]: {
        download: { url: `/privacy-requests/${dsarDone.id}/download`, expires_at: "2026-07-30T10:00:00Z" },
        manifest_summary: { package_sha256: "ab", item_count: 12, excluded: ["raw_audio"], inventory_counts: {} },
      },
      [dsarExpired.id]: { package_expired: true },
    },
  });
  await login(page);
  await page.goto("/#/admin/privacy");

  const rows = page.locator(".privacy-row");
  await rows.nth(0).locator(".privacy-row-main").click();
  const before = calls.statusGet.length;
  const dl = page.waitForEvent("download");
  await page.getByTestId("dsar-download").click();
  await dl; // the zip actually downloaded
  expect(calls.statusGet.length).toBeGreaterThan(before); // fresh mint per click
  await expect(page.locator(".privacy-download em")).toContainText(/дійсне до|valid until/);
  await expect(page.locator(".privacy-manifest")).toContainText("12");
  await expect(page.locator(".privacy-manifest")).toContainText("raw_audio");

  await rows.nth(1).locator(".privacy-row-main").click();
  await expect(page.getByTestId("dsar-expired")).toContainText(/запросіть експорт повторно|request the export again/);

  // 409 dsar_already_running from the patient page lands on the queue
  ctl.dsar409 = true;
  await page.goto(`/#/patients/${PID}`);
  await page.getByRole("button", { name: /Експорт даних|Data export/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Надіслати запит|Submit request/ }).click();
  await expect(page).toHaveURL(/#\/admin\/privacy$/);
});
