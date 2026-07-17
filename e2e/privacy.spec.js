// privacy.spec.js — FE sprint 11 step 07: the privacy surfaces against the
// LIVE stack. Gated E2E_PRIVACY=1 on top of RUN_BACKEND_INTEGRATION=1 —
// prerequisites in e2e/README.md (core with ERASURE_GRACE_DAYS=0 and the
// dev master key; signing optional; two-person via the seeded clinician as
// requester + admin as approver — the seed ships ONE admin per tenant).
//
// Erasure execution uses the backend's documented manual runner
// (python -m core_service.erasure.run) — the same engine the scheduler
// runs; never a code path that skips approval.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { installConsoleGuard, runId } from "./helpers/pii.js";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1" && process.env.E2E_PRIVACY === "1";
test.skip(!GATED, "privacy live suite — set RUN_BACKEND_INTEGRATION=1 E2E_PRIVACY=1 (see e2e/README.md)");

const AUTH = "http://localhost:8000";
const CORE = "http://localhost:8003";
const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const BACKEND_DIR = process.env.E2E_BACKEND_DIR || `${process.env.HOME}/Desktop/dictate/medical-dictation-backend`;
const RUN = runId();

const tokenOf = async (email) => {
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "dev-password" }),
  });
  if (!r.ok) throw new Error(`login ${email} failed — is the stack up? (e2e/README.md)`);
  return (await r.json()).access_token;
};
const H = (t) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

async function login(page, email) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ mode: "serial" });

test("role case: clinician deep-links /admin/privacy → the standard forbidden state", async ({ page }) => {
  const guard = installConsoleGuard(page);
  await login(page, "clinician@tenant-a.example");
  await page.goto("/#/admin/privacy");
  await expect(page.getByText(/Access denied|Доступ заборонено/).first()).toBeVisible({ timeout: 10000 });
  guard.assertClean();
});

test("two-person mirror + approve + EXECUTION: the honest report path end-to-end", async ({ page }) => {
  test.setTimeout(180_000);
  const guard = installConsoleGuard(page);

  // fixture: fresh patient with a consent + a note (so destroyed[] is real)
  const clinTok = await tokenOf("clinician@tenant-a.example");
  const patient = await fetch(`${CORE}/patients`, {
    method: "POST", headers: H(clinTok),
    body: JSON.stringify({ name: { uk: `Приватність-${RUN}`, en: `Privacy-${RUN}` }, dob: "1970-01-01", mrn: `E2EP-${RUN}` }),
  }).then((r) => r.json());
  await fetch(`${CORE}/patients/${patient.id}/consents`, {
    method: "POST", headers: H(clinTok),
    body: JSON.stringify({ type: "ai_scribe", method: "verbal", version: "v1" }),
  });
  await fetch(`${CORE}/notes`, {
    method: "POST", headers: H(clinTok),
    body: JSON.stringify({ patient_id: patient.id, structure: "soap", title: `note-${RUN}`, sections: [] }),
  });

  // ADMIN requests erasure via the full-screen UI (their OWN request)
  await login(page, "admin@tenant-a.example");
  await page.goto(`/#/patients/${patient.id}/erasure-request`);
  await page.locator(".privacy-reason").fill(
    `Наскрізна E2E-перевірка ${RUN}: письмова вимога пацієнта про видалення даних, реєстр. номер тесту.`);
  await page.locator("input.privacy-confirm").fill("ВИДАЛЕННЯ");
  await page.getByRole("button", { name: /Надіслати запит на видалення/ }).click();
  await expect(page.getByTestId("erasure-request-created")).toBeVisible({ timeout: 10000 });

  // the queue mirrors the two-person rule: OWN request, no approve controls
  await page.goto("/#/admin/privacy");
  const ownRow = page.locator(".privacy-row", { hasText: `Приватність-${RUN}` }).first();
  await expect(ownRow.getByTestId("own-request-badge")).toBeVisible({ timeout: 15000 });
  await expect(ownRow.getByTestId("approve-btn")).toHaveCount(0);

  // the CLINICIAN's request is approvable by the admin (the second person)
  const req = await fetch(`${CORE}/patients/${patient.id}/erasure`, {
    method: "POST", headers: H(clinTok),
    body: JSON.stringify({ reason: `Друга заявка ${RUN} від клініциста — для схвалення адміністратором (двоособовий контроль).` }),
  }).then((r) => r.json());
  await page.getByRole("button", { name: /Оновити/ }).click();
  const cliRow = page.locator(".privacy-row", { hasText: `Приватність-${RUN}` })
    .filter({ has: page.getByTestId("approve-btn") }).first();
  await cliRow.getByTestId("approve-btn").click();
  await page.locator(".modal .btn.accent", { hasText: /Схвалити/ }).click();
  await expect(page.getByTestId("grace-countdown").first()).toBeVisible({ timeout: 15000 });

  // execute via the backend's manual runner (grace must be 0 on this stack)
  let runnerOut;
  try {
    runnerOut = execSync(
      `cd ${BACKEND_DIR} && MDX_MASTER_KEY_PATH=${BACKEND_DIR}/infra/dev/master.key ` +
      `uv run --project services/core-service python -m core_service.erasure.run ` +
      `--tenant ${TENANT_A} --request ${req.id} --operator e2e-step07 2>&1`,
      { encoding: "utf8", shell: "/bin/zsh" },
    );
  } catch (e) {
    throw new Error(
      `erasure runner refused — is core-service running with ERASURE_GRACE_DAYS=0? (e2e/README.md)\n${e.stdout || e.message}`);
  }
  const report = JSON.parse(runnerOut);
  expect(report.counts.destroyed).toBeGreaterThan(0);
  expect(report.retained.some((r) => r.legal_basis === "retention:consent_record")).toBe(true);
  console.log(`[evidence] report_of_execution: destroyed=${report.counts.destroyed} retained=${report.counts.retained}`);

  // the queue renders the completed request; the report itself is behind
  // backend ask #3 (status endpoint exposes it for DSAR only) — the UI
  // shows either the verbatim report or the HONEST placeholder, never a
  // fabrication.
  await page.getByRole("button", { name: /Оновити/ }).click();
  const doneRow = page.locator(".privacy-row.status-completed").first();
  await expect(doneRow).toBeVisible({ timeout: 15000 });
  await doneRow.locator(".privacy-row-main").click();
  const rendered = page.getByTestId("execution-report");
  const placeholder = page.getByTestId("exec-report-unavailable");
  await expect(rendered.or(placeholder).first()).toBeVisible({ timeout: 10000 });
  if (await rendered.count()) {
    await expect(rendered).toContainText(/Збережено згідно із законом/);
  } else {
    console.log("[evidence] erasure report behind backend ask #3 — honest placeholder rendered");
  }
  guard.assertClean();
});

test("DSAR: request → poll → download with visible expiry (real zip)", async ({ page }) => {
  test.setTimeout(120_000);
  const guard = installConsoleGuard(page);
  const clinTok = await tokenOf("clinician@tenant-a.example");
  const patient = await fetch(`${CORE}/patients`, {
    method: "POST", headers: H(clinTok),
    body: JSON.stringify({ name: { uk: `ДСАР-${RUN}`, en: `DSAR-${RUN}` }, mrn: `E2ED-${RUN}` }),
  }).then((r) => r.json());

  await login(page, "admin@tenant-a.example");
  await page.goto(`/#/patients/${patient.id}`);
  await page.getByRole("button", { name: /Експорт даних/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Надіслати запит/ }).click();
  await expect(page).toHaveURL(/#\/admin\/privacy$/, { timeout: 10000 });

  // explicit poll with a deadline (no sleeps): the export engine completes
  const admTok = await tokenOf("admin@tenant-a.example");
  await expect.poll(async () => {
    const list = await fetch(`${CORE}/privacy-requests?kind=dsar`, { headers: H(admTok) }).then((r) => r.json());
    return list.find((r) => r.patient_id === patient.id)?.status;
  }, { timeout: 60_000, intervals: [2000] }).toBe("completed");

  await page.getByRole("button", { name: /Оновити/ }).click();
  const row = page.locator(".privacy-row", { hasText: `ДСАР-${RUN}` }).first();
  await row.locator(".privacy-row-main").click();
  const dl = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByTestId("dsar-download").click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/^dsar-.*\.zip$/);
  await expect(page.locator(".privacy-download em")).toContainText(/дійсне до/);
  guard.assertClean();
});
