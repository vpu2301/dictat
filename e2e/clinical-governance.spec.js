// clinical-governance.spec.js — the 2026-08-09 hotfix, driven through the
// real app in a real browser.
//
//   npx playwright test e2e/clinical-governance.spec.js
//
// Two defects, both about who may do what to a patient's record:
//
//   1. A qualified signature is a physician's act. Nurse, tenant_admin and
//      auditor were being offered it.
//   2. Privileged access to a patient a principal has no treatment
//      relationship with must be deliberate — reason, justification,
//      re-authentication — and must keep SAYING it is privileged for as long
//      as the record is open.
//
// Everything below drives the real components. The backend is mocked at the
// wire (helpers/s15Mocks.js) so the refusals under test — a 403 carrying
// `phi_access_required`, a 401 on a stale ticket — arrive exactly as the
// services send them, deterministically, without a seeded database.
//
// The FE is not the security boundary and these tests do not pretend it is:
// every gate here is a response to something the SERVER said.
import { test, expect } from "@playwright/test";

import { installBaseMocks, newCalls, login, PATIENT_ID, PATIENT } from "./helpers/s15Mocks.js";

const REPORT_ID = "44444444-4444-4444-4444-444444444444";

const REPORT = {
  id: REPORT_ID,
  code: "REP-001",
  status: "final",
  patient_id: PATIENT_ID,
  current_version_number: 1,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-01T09:00:00Z",
  content: { template_id: "22222222-2222-2222-2222-222222222222", sections: [
    { section_key: "anamnesis", text: "Скарги на біль у грудях." },
  ] },
  section_labels: [{ section_key: "anamnesis", name: { uk: "Анамнез", en: "Anamnesis" } }],
};

const REASONS = {
  reasons: [
    { code: "care_continuity", label_uk: "Безперервність надання допомоги", label_en: "Continuity of care", requires_note: false },
    { code: "legal_request", label_uk: "Юридичний запит", label_en: "Legal or regulatory request", requires_note: false },
    { code: "other", label_uk: "Інше (вкажіть причину)", label_en: "Other (state the reason)", requires_note: true },
  ],
  grant_ttl_minutes: 60,
  note_min_chars: 10,
};

// The reason field is the platform MenuSelect, not a native <select>: its
// options exist in the DOM only while the menu is open, so choosing one is
// two clicks rather than selectOption().
async function pickReason(page, label) {
  await page.locator('[data-testid="bg-reason"] .menu-select-trigger').click();
  await page.getByRole("option", { name: label }).click();
}

// Layered on top of the base mocks. `granted` flips when the break-glass
// request succeeds — which is what makes the retry meaningful: the SAME GET
// that 403'd now returns the record, exactly as the server behaves.
async function installGovernanceMocks(page, { relationship }) {
  const state = { granted: false, requests: [], reauths: 0 };

  await page.route(
    (url) => url.hostname === "localhost" && ["8003", "8006"].includes(url.port),
    async (route, request) => {
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const json = (status, body) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

      // The break-glass vocabulary + window, served rather than hard-coded.
      if (path.endsWith("/v1/phi-access-requests/reasons")) return json(200, REASONS);

      // Minting the grant. The backend models are extra="forbid", so the
      // assertion on the body here is a contract test as much as a flow test.
      if (path.endsWith("/v1/phi-access-requests") && method === "POST") {
        const body = JSON.parse(request.postData() || "{}");
        state.requests.push(body);
        if (!body.reauth_ticket) return json(401, { code: "reauth_required" });
        state.granted = true;
        return json(201, {
          id: "grant-1", resource_kind: body.resource_kind, resource_id: body.resource_id,
          reason_code: body.reason_code, reason_note: body.reason_note,
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        });
      }

      // The patient record itself. Without a treatment relationship AND
      // without a live grant, core-service refuses with the machine-readable
      // code the FE turns into the interstitial.
      if (path === `/patients/${PATIENT_ID}`) {
        if (!relationship && !state.granted) {
          return json(403, { code: "phi_access_required", detail: "no standing access" });
        }
        return json(200, PATIENT);
      }
      if (path === `/v1/reports/${REPORT_ID}`) {
        if (!relationship && !state.granted) {
          return json(403, { code: "phi_access_required", detail: "no standing access" });
        }
        return json(200, REPORT);
      }
      // Every other record surface is empty rather than broken — a failing
      // side panel must not be mistaken for the gate working.
      if (path.startsWith("/patients/") || path.startsWith("/v1/")) return json(200, { items: [] });
      return route.fallback();
    },
  );

  await page.route((url) => url.hostname === "localhost" && url.port === "8000", async (route, request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/reauth") && request.method() === "POST") {
      state.reauths += 1;
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ reauth_ticket: "ticket-1", expires_in: 300 }),
      });
    }
    return route.fallback();
  });

  return state;
}

// ── Defect 1 — signing is a physician's act ────────────────────────────

test.describe("signing is clinician-only", () => {
  test("a nurse is served no sign affordance on a finalized report", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["nurse"] });
    await installGovernanceMocks(page, { relationship: true });
    await login(page);

    await page.goto(`/#/dictate/reports/${REPORT_ID}`);
    await expect(page.locator(".report-page")).toBeVisible({ timeout: 15000 });

    // Absent from the DOM — not disabled, not hidden.
    await expect(page.getByRole("button", { name: /Підписати/ })).toHaveCount(0);
    await expect(page.locator('[data-icon="sign"]')).toHaveCount(0);
    // …while the report itself is perfectly readable. Removing the act must
    // not remove the record.
    await expect(page.getByText("Скарги на біль у грудях.")).toBeVisible();
  });

  test("a clinician IS served it", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["clinician"] });
    await installGovernanceMocks(page, { relationship: true });
    await login(page);

    await page.goto(`/#/dictate/reports/${REPORT_ID}`);
    await expect(page.locator(".report-page")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Підписати/ })).toBeVisible();
  });

  test("a tenant_admin is served no sign affordance either", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["tenant_admin"] });
    await installGovernanceMocks(page, { relationship: true });
    await login(page);

    await page.goto(`/#/dictate/reports/${REPORT_ID}`);
    await expect(page.locator(".report-page")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Підписати/ })).toHaveCount(0);
  });
});

// ── Defect 2 — break-glass ─────────────────────────────────────────────

test.describe("break-glass", () => {
  test("an unrelated admin passes an interstitial before any clinical data", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["tenant_admin"] });
    const state = await installGovernanceMocks(page, { relationship: false });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);

    // The gate, and nothing behind it.
    const gate = page.locator('[data-testid="break-glass-gate"]');
    await expect(gate).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Доступ буде зафіксовано/)).toBeVisible();
    await expect(page.getByText(PATIENT.name.uk)).toHaveCount(0);
    await expect(page.locator(".ph-card")).toHaveCount(0);

    await page.locator('[data-testid="bg-request"]').click();

    // Reason from a closed list; justification demanded before submit.
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();
    await pickReason(page, "Безперервність надання допомоги");
    await expect(submit).toBeDisabled(); // reason alone is not enough
    await page.locator('[data-testid="bg-justification"]')
      .fill("Підміняю д-ра К. на час відпустки");
    await page.locator('input[type="password"]').fill("dev-password");
    await expect(submit).toBeEnabled();
    await submit.click();

    // The record renders, and it keeps saying how it was opened.
    await expect(page.locator(".ph-card")).toBeVisible({ timeout: 15000 });
    const banner = page.locator('[data-testid="break-glass-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-reason", "care_continuity");
    await expect(banner).toContainText("Безперервність надання допомоги");
    // Not dismissable: no control inside it at all.
    await expect(banner.locator("button")).toHaveCount(0);

    // The wire carried both the category and the account of this access.
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].reason_code).toBe("care_continuity");
    expect(state.requests[0].reason_note).toContain("Підміняю");
    expect(state.reauths).toBe(1);
  });

  test("cancelling leaves with NO clinical payload in the page", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["tenant_admin"] });
    const state = await installGovernanceMocks(page, { relationship: false });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);
    await expect(page.locator('[data-testid="break-glass-gate"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="bg-request"]').click();
    await pickReason(page, "Безперервність надання допомоги");
    await page.locator('[data-testid="bg-justification"]').fill("Помилково відкрив картку");

    // Walk away instead of finishing.
    await page.getByRole("button", { name: /Скасувати|Cancel/ }).first().click();

    await expect(page.locator('[data-testid="break-glass-gate"]')).toBeVisible();
    // The clinical payload never entered the DOM.
    const html = await page.content();
    expect(html).not.toContain(PATIENT.name.uk);
    expect(html).not.toContain(PATIENT.mrn);
    expect(state.requests).toHaveLength(0);
  });

  test("the treating clinician walks straight in — no gate, no banner", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["clinician"] });
    await installGovernanceMocks(page, { relationship: true });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);

    await expect(page.locator(".ph-card")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="break-glass-gate"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="break-glass-banner"]')).toHaveCount(0);
    // Nothing asked them to justify treating their own patient.
    await expect(page.getByText(/Запитати доступ/)).toHaveCount(0);
  });

  test("a clinician served a 403 is refused, not invited to justify themselves", async ({ page }) => {
    // 2026-08-09. Break-glass is an ADMINISTRATOR's door: a clinical role holds
    // `patient.read_full` outright, so a refusal reaching one is a stale token
    // or a deep link into another tenant. Offering "Request access" there is a
    // door they cannot open — and would put grant-minting power on the one role
    // that must never hold it.
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["clinician"] });
    const state = await installGovernanceMocks(page, { relationship: false });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);

    await expect(page.locator('[data-testid="break-glass-gate"]')).toBeVisible({ timeout: 15000 });
    // Still no clinical payload — the gate's first job is unchanged.
    await expect(page.getByText(PATIENT.name.uk)).toHaveCount(0);
    await expect(page.locator(".ph-card")).toHaveCount(0);
    // …and no way to talk their way in.
    await expect(page.locator('[data-testid="bg-request"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bg-reason"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText(/зверніться до адміністратора/i)).toBeVisible();
    expect(state.requests).toHaveLength(0);
  });

  test("an admin's episode is not the next user's banner", async ({ page }) => {
    // The reported defect. sessionStorage is scoped to the TAB, not the
    // session: the admin's break-glass episode survived the sign-out and told
    // the clinician who signed in next that their own entitled read was an
    // exception being counted.
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["tenant_admin"] });
    await installGovernanceMocks(page, { relationship: false });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);
    await expect(page.locator('[data-testid="break-glass-gate"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="bg-request"]').click();
    await pickReason(page, "Безперервність надання допомоги");
    await page.locator('[data-testid="bg-justification"]').fill("Перевірка якості за скаргою");
    await page.locator('input[type="password"]').fill("dev-password");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[data-testid="break-glass-banner"]')).toBeVisible({ timeout: 15000 });

    // A marker in the SAME tab storage the episode lives in. If it survives to
    // the end, the absence of the banner is the scoping working rather than a
    // fresh browser context quietly passing the test for us.
    await page.evaluate(() => window.sessionStorage.setItem("mdx.e2e.tab", "same"));

    // Sign out through the real control, then hand the workstation over.
    await page.locator(".sb-user").click();
    await page.getByRole("menuitem", { name: /Вийти|Sign out/ }).click();
    await page.locator(".signout-modal .btn-danger").click();
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15000 });

    // Next person at the same tab: a clinician, with standing access.
    await installBaseMocks(page, calls, { roles: ["clinician"] });
    await installGovernanceMocks(page, { relationship: true });
    await login(page);

    await page.goto(`/#/patients/${PATIENT_ID}`);
    await expect(page.locator(".ph-card")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="break-glass-banner"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.sessionStorage.getItem("mdx.e2e.tab"))).toBe("same");
  });

  test("the compliance view lists the events and offers no export", async ({ page }) => {
    const calls = newCalls();
    await installBaseMocks(page, calls, { roles: ["auditor"] });
    await page.route(
      (url) => url.hostname === "localhost" && url.port === "8006",
      async (route, request) => {
        const path = new URL(request.url()).pathname;
        const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
        if (path.endsWith("/v1/phi-access-requests/reasons")) return json(REASONS);
        if (path.endsWith("/v1/phi-access-requests")) {
          return json({ items: [{
            id: "grant-1", requested_by: "00000000-0000-4000-8000-00000000d0c5",
            resource_kind: "patient", resource_id: PATIENT_ID, patient_id: PATIENT_ID,
            reason_code: "care_continuity", reason_note: "Підміняю д-ра К. на час відпустки",
            granted_at: "2026-08-09T10:00:00Z",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            revoked_at: null, use_count: 3, last_used_at: "2026-08-09T10:05:00Z",
          }] });
        }
        return route.fallback();
      },
    );
    await login(page);

    await page.goto("/#/audit/phi-access");
    await expect(page.getByText(/Безперервність надання допомоги|care_continuity/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Підміняю д-ра К. на час відпустки")).toBeVisible();

    // Read-only: no way to take the log out of the app as a file.
    await expect(page.getByRole("button", { name: /Експорт|Export|CSV/i })).toHaveCount(0);
    await expect(page.locator('[data-icon="download"]')).toHaveCount(0);
  });
});
