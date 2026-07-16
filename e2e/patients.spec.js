// patients.spec.js — FE sprint 11 step 07: the person-to-report flow
// against the LIVE local backend. Observe-mode only — no route mocking.
//
// Gated: RUN_BACKEND_INTEGRATION=1 (needs the stack in e2e/README.md —
// auth :8000, core :8003, report :8006; signing :8008 only for the
// privacy spec). Run: npm run e2e:person
//
// Recording substitution (documented in the sprint sign-off): the local
// E2E stack has no dictation-service/ASR, so "record" = the studio's real
// dictation-editing affordance (typing into the TipTap editor) → the real
// autosave → a real report row in report-service. The consent gate guards
// the same speech.start() transition either way; the WS encounter_id
// contract is unit-tested (src/dictation/messages.test.js) and the
// audio_files linkage was SQL-proven in step 04.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  installPiiTaps, assertNoPatientPii, installConsoleGuard, runId, genValidIpn,
} from "./helpers/pii.js";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1";
test.skip(!GATED, "live suite — set RUN_BACKEND_INTEGRATION=1 (see e2e/README.md)");

const RUN = runId();
const FIXTURE = {
  name: `Тест-${RUN} Наскрізний`,
  ipn: genValidIpn(),
  mrn: `E2E-${RUN}`,
};

// SQL assert helper — scoped by the run marker so reruns never collide.
const sql = (q) =>
  execSync(
    `docker exec medical-dictation-postgres-1 psql -U postgres -d medical_dictation -t -A -c "${q.replace(/"/g, '\\"')}"`,
    { encoding: "utf8" },
  ).trim();

async function login(page, email) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ mode: "serial" }); // the golden path seeds later cases

test("golden path: create patient → прийом → gate blocks → consent → dictate → report on the timeline", async ({ page }) => {
  const guard = installConsoleGuard(page);
  const taps = installPiiTaps(page);
  await login(page, "clinician@tenant-a.example");

  // create the patient (uk name, DOB, valid fixture ІПН)
  await page.goto("/#/patients");
  await page.getByRole("button", { name: /Новий пацієнт/ }).click();
  const form = page.locator(".modal");
  await form.locator("input").first().fill(FIXTURE.name);
  await form.locator('input[type="date"]').fill("1985-04-20");
  await form.locator('input[inputmode="numeric"]').fill(FIXTURE.ipn);
  await expect(form.locator(".pdir-ipn-hint.ok")).toBeVisible();
  const mrnBox = form.locator("input.ti.mono").first();
  await mrnBox.fill(FIXTURE.mrn);
  await form.getByRole("button", { name: /Додати пацієнта/ }).click();
  await expect(form).toHaveCount(0, { timeout: 10000 });

  // open the record via server search
  await page.locator(".pdir-toolbar .search-input input").first().fill(`Тест-${RUN}`);
  const row = page.locator(".ptable-row", { hasText: FIXTURE.name });
  await expect(row).toHaveCount(1, { timeout: 10000 });
  await row.click();
  await expect(page.locator(".ph-card")).toContainText(FIXTURE.name);

  // Почати прийом → studio with the context bar
  await page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом/ }).click();
  await page.locator(".modal textarea").fill("наскрізний E2E-візит");
  await page.locator(".modal .btn.accent", { hasText: /Почати диктування/ }).click();
  await expect(page).toHaveURL(/dictate\/studio\?patient=[0-9a-f-]{36}&encounter=[0-9a-f-]{36}$/, { timeout: 15000 });
  const encounterId = page.url().match(/encounter=([0-9a-f-]{36})/)[1];
  const patientId = page.url().match(/patient=([0-9a-f-]{36})/)[1];
  const bar = page.getByTestId("studio-context-bar");
  await expect(bar).toContainText(FIXTURE.name.split(" ")[0]);
  await expect(bar).toContainText("нар. 1985");

  // the consent gate BLOCKS the real record button…
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible({ timeout: 10000 });
  await page.locator(".mic-btn").click();
  await expect(page.getByTestId("consent-sheet")).toBeVisible();
  await expect(page.locator(".mic-btn")).toHaveAttribute("data-state", "idle");

  // …verbal consent unblocks it (one POST to the REAL consent endpoint)
  await page.locator(".consent-method", { hasText: /Усно/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Зафіксувати згоду/ }).click();
  await expect(page.getByTestId("consent-gate-banner")).toHaveCount(0, { timeout: 10000 });

  // dictate (typed — see the substitution note) → real autosaved report
  const editor = page.locator(".ProseMirror").first();
  await editor.waitFor({ timeout: 15000 });
  await editor.click();
  await page.keyboard.type(`Скарги на кашель і слабкість. Наскрізна перевірка ${RUN}.`);
  const create = await page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/v1/reports") && r.status() === 201,
    { timeout: 15000 },
  );
  const reportId = (await create.json()).id;

  // back on the record: the timeline shows the encounter AND the report
  await page.goto(`/#/patients/${patientId}?tab=timeline`);
  await expect(page.locator(".tl-row.tl-type-encounter", { hasText: "наскрізний E2E-візит" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".tl-row.tl-type-report")).toBeVisible();
  await expect(page.locator(".tl-row.tl-type-consent")).toBeVisible();

  // SQL asserts, scoped to this run's rows
  expect(sql(`SELECT patient_id FROM reports WHERE id='${reportId}'`)).toBe(patientId);
  expect(sql(`SELECT status FROM encounters WHERE id='${encounterId}'`)).toBe("in_progress");
  expect(sql(`SELECT count(*) FROM patient_consents WHERE patient_id='${patientId}' AND type='ai_scribe' AND status='granted'`)).toBe("1");

  await assertNoPatientPii(page, taps, FIXTURE);
  guard.assertClean();
});

test("gate persistence: withdraw → a NEW encounter's recording attempt is blocked again", async ({ page }) => {
  const guard = installConsoleGuard(page);
  const taps = installPiiTaps(page);
  await login(page, "clinician@tenant-a.example");

  // find this run's patient, withdraw the consent in the Згоди tab
  await page.goto("/#/patients");
  await page.locator(".pdir-toolbar .search-input input").first().fill(`Тест-${RUN}`);
  await page.locator(".ptable-row", { hasText: FIXTURE.name }).click();
  await page.locator(".tabs .tab", { hasText: /Згоди/ }).click();
  await page.locator(".consent-row", { hasText: /AI-скрайб/ }).getByRole("button", { name: /Відкликати/ }).click();
  await page.locator(".modal .btn", { hasText: /Відкликати згоду/ }).click();
  await expect(page.locator(".consent-row.withdrawn")).toBeVisible({ timeout: 10000 });

  // new encounter → the gate blocks again
  await page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Почати диктування/ }).click();
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible({ timeout: 15000 });
  await page.locator(".mic-btn").click();
  await expect(page.getByTestId("consent-sheet")).toBeVisible();

  await assertNoPatientPii(page, taps, FIXTURE);
  guard.assertClean();
});

test("ІПН search: exact hit via HMAC; checksum typo errors locally with ZERO queries", async ({ page }) => {
  const guard = installConsoleGuard(page);
  const taps = installPiiTaps(page);
  await login(page, "clinician@tenant-a.example");
  await page.goto("/#/patients");
  await expect(page.locator(".ptable, .ptable-row").first()).toBeVisible({ timeout: 10000 });

  // observe-mode request tap: count roster queries
  const queries = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/patients" && u.searchParams.get("query")) queries.push(u.searchParams.get("query"));
  });

  // checksum-broken ІПН (flip the control digit) → local error, no network
  const broken = FIXTURE.ipn.slice(0, 9) + String((Number(FIXTURE.ipn[9]) + 1) % 10);
  await page.locator(".pdir-ipn-search input").fill(broken);
  await page.waitForTimeout(600);
  await expect(page.locator(".pdir-ipn-search .pdir-ipn-hint.err")).toBeVisible();
  expect(queries).toEqual([]);

  // the real ІПН, pasted with spaces → exactly this run's patient
  const spaced = `${FIXTURE.ipn.slice(0, 3)} ${FIXTURE.ipn.slice(3, 6)} ${FIXTURE.ipn.slice(6)}`;
  await page.locator(".pdir-ipn-search input").fill(spaced);
  await expect(page.locator(".ptable-row")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".ptable-row")).toContainText(FIXTURE.name);
  expect(queries).toEqual([FIXTURE.ipn]);

  await assertNoPatientPii(page, taps, FIXTURE);
  guard.assertClean();
});

test("nurse: consent capture available; privacy surfaces absent", async ({ page }) => {
  const guard = installConsoleGuard(page);
  await login(page, "nurse@tenant-a.example");

  // no Приватність in the nav, no DSAR/erasure on the record
  await expect(page.locator("nav, .sidebar").getByText(/Приватність/)).toHaveCount(0);
  await page.goto("/#/patients");
  await page.locator(".pdir-toolbar .search-input input").first().fill(`Тест-${RUN}`);
  await page.locator(".ptable-row", { hasText: FIXTURE.name }).click();
  await expect(page.locator(".ph-card")).toBeVisible();
  await expect(page.getByRole("button", { name: /DSAR|видалення/i })).toHaveCount(0);

  // consent capture available to the nurse (patient.write): the studio
  // gate offers it on this consent-less (withdrawn) patient
  await page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом/ }).click();
  await page.locator(".modal .btn.accent", { hasText: /Почати диктування/ }).click();
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("consent-gate-banner").getByRole("button", { name: /Отримати згоду/ })).toBeVisible();

  guard.assertClean();
});
