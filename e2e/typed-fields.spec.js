// typed-fields.spec.js — FE Sprint 13 step 08: the typed-field system
// against the LIVE local backend. Observe-mode only — no route mocking.
//
// Gated: RUN_BACKEND_INTEGRATION=1 (stack per e2e/README.md — auth :8000,
// core :8003, report :8006 with the seeded `anamnesis_intake` template).
// Run: RUN_BACKEND_INTEGRATION=1 npx playwright test e2e/typed-fields.spec.js
//
// Live-capability gates (probed 2026-07-23; each case names its gate):
//   · template options + metadata draft round-trip (BE 01/02) — LIVE ✅
//   · /v1/icd10/search (BE 03)      — 404 on the current stack → auto-skip
//   · extractor proposals (BE 04/05) — not built → E2E_EXTRACTOR=1 gate
//   · finalize codes (BE 06)         — ⚠ live finalize 500s on a typed
//     template today (backend finding, reported) → E2E_S13_FINALIZE=1 gate
//   · backend voice ops (BE 07)      — not built; the voice case drives the
//     REAL FE op path (registry → ctx → model → chips) via the dev-only
//     window.__mdxStudioOps seam — the WS-FIXTURE VARIANT the step-08 spec
//     allows, labeled as such. Spoken-command E2E arrives with BE 07.
//
// Fixture setup goes through the real APIs (patient + draft seeded over
// HTTP with the seed clinician), which is data setup, not stubbing — the
// SPA under test talks only to the live services.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { installConsoleGuard, runId } from "./helpers/pii.js";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1";
test.skip(!GATED, "live suite — set RUN_BACKEND_INTEGRATION=1 (see e2e/README.md)");

const AUTH = "http://localhost:8000";
const CORE = "http://localhost:8003";
const REPORT = "http://localhost:8006";
const RUN = runId();
const PROSE = `скарги на головний біль та запаморочення понад тиждень (E2E-${RUN})`;

const sql = (q) =>
  execSync(
    `docker exec medical-dictation-postgres-1 psql -U postgres -d medical_dictation -t -A -c "${q.replace(/"/g, '\\"')}"`,
    { encoding: "utf8" },
  ).trim();

async function api(base, path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

// Seeded once, shared serially across cases.
const S = { token: null, template: null, patientId: null, reportId: null, icd10Live: false };
const optLabel = (sectionId, value) => {
  const sec = S.template.schema_jsonb.sections.find((s) => s.id === sectionId);
  return sec.options.find((o) => o.value === value).label;
};
const latestSections = async () => {
  const r = await api(REPORT, `/v1/reports/${S.reportId}?include_content=true`, { token: S.token });
  return r.content?.sections || [];
};
const sectionOf = (list, key) => list.find((s) => s.section_key === key);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const login = await api(AUTH, "/auth/login", {
    method: "POST",
    body: { email: "clinician@tenant-a.example", password: "dev-password" },
  });
  S.token = login.access_token;

  const list = await api(REPORT, "/templates?limit=100", { token: S.token });
  const summary = list.find((t) => t.code === "anamnesis_intake");
  if (!summary) throw new Error("seeded anamnesis_intake template missing — see e2e/README.md S13 prerequisites");
  S.template = await api(REPORT, `/templates/${summary.id}`, { token: S.token });

  S.icd10Live = await fetch(`${REPORT}/v1/icd10/search?q=I10`, {
    headers: { Authorization: `Bearer ${S.token}` },
  }).then((r) => r.ok, () => false);

  const patient = await api(CORE, "/patients", {
    method: "POST",
    token: S.token,
    body: { name: { uk: `Тест-S13-${RUN} Поля`, en: `Test-S13-${RUN}` }, dob: "1985-04-20", sex: "F" },
  });
  S.patientId = patient.id;

  const report = await api(REPORT, "/v1/reports", {
    method: "POST",
    token: S.token,
    body: {
      patient_id: S.patientId,
      content: {
        template_id: S.template.id,
        template_schema_version: S.template.schema_version,
        title: `S13-E2E-${RUN}`,
        sections: [{ section_key: "complaints", text: PROSE }],
      },
    },
  });
  S.reportId = report.id;
});

async function loginUI(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("clinician@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15000 });
}

async function openStudio(page) {
  await page.goto(`/#/studio?mode=dictate&report=${S.reportId}`);
  // The typed widgets mount once the template detail + draft rehydrate land.
  await expect(
    page.locator('section[data-section-id="smoking_status"] .field-widget-mount'),
  ).toBeVisible({ timeout: 20000 });
}

test("manual typed flow: live options render as chips; taps confirm; draft persists manual metadata; prose untouched (golden path, manual until the extractor lands)", async ({ page }) => {
  const guard = installConsoleGuard(page);
  await loginUI(page);
  await openStudio(page);

  const smoking = page.locator('section[data-section-id="smoking_status"]');
  const allergies = page.locator('section[data-section-id="allergies"]');

  // Chips come from the LIVE template's options (labels, not slugs).
  await expect(smoking.locator(".rf-chip")).toHaveCount(3);
  await expect(allergies.locator(".rf-chip")).toHaveCount(9);

  // choice: tap «never» → confirmed chip (solid, no proposal chrome).
  await smoking.locator(".rf-chip", { hasText: optLabel("smoking_status", "never") }).click();
  await expect(smoking.locator(".pgm-chip.pgm-confirmed")).toBeVisible();
  await expect(smoking.locator(".pgm-proposal")).toHaveCount(0);

  // multi_choice: two taps → two confirmed chips.
  await allergies.locator(".rf-chip", { hasText: optLabel("allergies", "penicillin") }).click();
  await allergies.locator(".rf-chip", { hasText: optLabel("allergies", "pollen") }).click();
  await expect(allergies.locator(".pgm-chip.pgm-confirmed")).toHaveCount(2);

  // The coalesced autosave persists BOTH as source:"manual" (poll, no sleeps).
  await expect
    .poll(async () => {
      const s = await latestSections();
      return {
        smoking: sectionOf(s, "smoking_status")?.field_specific_metadata,
        allergies: sectionOf(s, "allergies")?.field_specific_metadata,
      };
    }, { timeout: 30000 })
    .toEqual({
      smoking: { source: "manual", selected: "never" },
      allergies: { source: "manual", selected: ["penicillin", "pollen"] },
    });

  // SQL evidence (latest version, scoped by the run's report id).
  const stored = JSON.parse(
    sql(`SELECT content_jsonb::text FROM report_versions WHERE report_id='${S.reportId}' ORDER BY version_number DESC LIMIT 1`),
  );
  const smokingRow = stored.sections.find((s) => s.section_key === "smoking_status");
  expect(smokingRow.field_specific_metadata).toEqual({ source: "manual", selected: "never" });

  // PROSE INVARIANT (browser-level): chip operations never touched the text.
  expect(sectionOf(stored.sections, "complaints").text).toBe(PROSE);
  guard.assertClean();
});

test("free_text regression: the prose section has zero dispatch artifacts and still types/saves like pre-sprint", async ({ page }) => {
  const guard = installConsoleGuard(page);
  await loginUI(page);
  await openStudio(page);

  const complaints = page.locator('section[data-section-id="complaints"]');
  // No widget mount content, no proposal chrome, no chips — plain prose.
  await expect(complaints.locator(".field-widget-mount *")).toHaveCount(0);
  await expect(complaints.locator('[class*="pgm-"], .rf-chip')).toHaveCount(0);
  await expect(complaints).toContainText("головний біль");

  // Typing + S10 autosave still work (the pre-sprint behaviors).
  await complaints.locator("p").first().click();
  await page.keyboard.press("End");
  const SUFFIX = ` Дописано в E2E-${RUN}.`;
  await page.keyboard.type(SUFFIX, { delay: 20 });
  await expect
    .poll(async () => sectionOf(await latestSections(), "complaints")?.text || "", { timeout: 30000 })
    .toContain(SUFFIX.trim());
  guard.assertClean();
});

test("voice op (WS-fixture variant): set_choice updates the chip live, confirmed style, focus unmoved", async ({ page }) => {
  const guard = installConsoleGuard(page);
  await loginUI(page);
  await openStudio(page);

  // Park the caret in the prose — the op must not steal it.
  await page.locator('section[data-section-id="complaints"] p').first().click();
  const focusBefore = await page.evaluate(() => document.activeElement?.className || "");
  expect(focusBefore).toContain("ProseMirror");

  // Drive the REAL op path (applyOperations registry → Studio ctx → model →
  // controlled chips) through the dev seam — the labeled substitute for the
  // WS channel until backend step 07 emits real operations.
  const applied = await page.evaluate(() =>
    typeof window.__mdxStudioOps === "function"
      ? window.__mdxStudioOps([{ op: "set_choice", arg: { section_id: "smoking_status", value: "former" } }])
      : null,
  );
  expect(applied).toEqual({ applied: 1, skipped: 0 });

  const smoking = page.locator('section[data-section-id="smoking_status"]');
  await expect(
    smoking.locator(".pgm-chip.pgm-confirmed", { hasText: optLabel("smoking_status", "former") }),
  ).toBeVisible({ timeout: 5000 });
  await expect(smoking.locator(".pgm-proposal")).toHaveCount(0); // confirmed, NOT proposal

  // NO FOCUS THEFT: the caret is exactly where the clinician left it.
  const focusAfter = await page.evaluate(() => document.activeElement?.className || "");
  expect(focusAfter).toBe(focusBefore);

  // And it persists through the same draft-save path as a tap.
  await expect
    .poll(async () => sectionOf(await latestSections(), "smoking_status")?.field_specific_metadata, { timeout: 30000 })
    .toEqual({ source: "manual", selected: "former" });
  guard.assertClean();
});

test("extractor golden path: dictated utterance → proposals → confirm → finalize", async () => {
  test.skip(!process.env.E2E_EXTRACTOR, "gated: extractor (BE steps 04/05) not in the running stack");
  // Enabled when the nlp extractor lands: dictate «пацієнт не курить» +
  // «гіпертонічна хвороба» via fake media → smoking `never` renders as a
  // PROPOSAL (pgm-proposal) → confirm → manual; diagnosis I10 proposal →
  // confirm → section.icd10; finalize succeeds; SQL-assert both.
});

test("finalize gating: unconfirmed required typed fields block with backend reasons, then proceed", async () => {
  test.skip(!process.env.E2E_S13_FINALIZE,
    "gated: BE step 06 finalize codes not live (probed 2026-07-23: finalize on a typed draft 500s — reported)");
  // Enabled with BE step 06: finalize with smoking unselected → 422 →
  // «Оберіть значення» anchored to smoking_status → «Перейти» lands on the
  // chips → select → finalize proceeds.
});

test("ICD-10 picker: search, leaf-only pick, prose preserved", async () => {
  test.skip(!S.icd10Live, "gated: /v1/icd10/search not in the running stack (probed 404)");
  test.skip(!S.template.schema_jsonb.sections.some((s) => s.field_type === "structured_diagnosis"),
    "gated: the seeded template has no structured_diagnosis section yet");
  // Enabled with BE step 03 + a diagnosis section: type «гіперт» → I10
  // family within the debounce budget; exact code first; pick → chip;
  // remove → saved; prose byte-identical throughout.
});
