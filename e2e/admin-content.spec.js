// admin-content.spec.js — sprint-17 content surfaces: dictionary (abbreviations
// + voice-command reference + sandbox), autocomplete corpus (phrases/snippets
// with the PII gate), and search synonyms (groups + live expansion probe).
import { test, expect } from "@playwright/test";
import { installAdminMocks, login } from "./helpers/adminMocks.js";
import { installContentMocks } from "./helpers/adminContentMocks.js";

async function adminSession(page, contentOpts) {
  await installAdminMocks(page);
  const ctl = await installContentMocks(page, contentOpts);
  await login(page);
  return ctl;
}

test.describe("dictionary — abbreviations + sandbox", () => {
  test("an abbreviation edit becomes visible in the test box", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/dictionary");
    await expect(page.getByTestId("abbrev-table")).toBeVisible();

    // The shipped row is badged as system and offers no delete.
    const sysRow = page.getByTestId("abbrev-table").locator("tbody tr", { hasText: "ЧД" });
    await expect(sysRow.getByText("системне")).toBeVisible();
    await expect(sysRow.getByTestId("abbrev-delete")).toHaveCount(0);

    // Sandbox BEFORE the rule: text passes through unexpanded.
    await page.getByTestId("sandbox-text").fill("чсс 92");
    await page.getByTestId("sandbox-run").click();
    await expect(page.getByTestId("sandbox-out")).toHaveText("чсс 92");

    // Add the clinic rule…
    await page.getByTestId("abbrev-add").click();
    await page.getByTestId("abbrev-short").fill("ЧСС");
    await page.getByTestId("abbrev-full").fill("частота серцевих скорочень");
    await page.getByTestId("abbrev-save").click();
    const newRow = page.getByTestId("abbrev-table").locator("tbody tr", { hasText: "ЧСС" });
    await expect(newRow.getByText("правило клініки")).toBeVisible();

    // …and the SAME sandbox input now reflects it.
    await page.getByTestId("sandbox-run").click();
    await expect(page.getByTestId("sandbox-out")).toHaveText("частота серцевих скорочень 92");

    // Toggling the abbreviation stage off reverts the output (A/B).
    await page.getByText("скорочення", { exact: true }).click();
    await page.getByTestId("sandbox-run").click();
    await expect(page.getByTestId("sandbox-out")).toHaveText("чсс 92");
    await expect(page.getByTestId("sandbox-warnings")).toContainText("stage_disabled");
  });

  test("deleting a clinic rule names the consequence; system rules stay", async ({ page }) => {
    const ctl = await adminSession(page);
    await page.goto("/#/admin/dictionary");
    await page.getByTestId("abbrev-add").click();
    await page.getByTestId("abbrev-short").fill("АТ");
    await page.getByTestId("abbrev-full").fill("артеріальний тиск");
    await page.getByTestId("abbrev-save").click();

    // NB: a string hasText is case-INsensitive, and «Редагувати» contains
    // «ат» — filter with a case-sensitive regex so only the АТ row matches.
    const row = page.getByTestId("abbrev-table").locator("tbody tr", { hasText: /АТ/ });
    await row.getByTestId("abbrev-delete").click();
    await expect(page.getByTestId("abbrev-delete-confirm-consequence"))
      .toContainText("Системне правило");
    await page.getByTestId("abbrev-delete-confirm-confirm").click();
    await expect(page.getByTestId("abbrev-table").locator("tbody tr", { hasText: /АТ/ })).toHaveCount(0);
    expect(ctl.abbreviations.some((a) => a.abbreviated === "АТ")).toBe(false);
  });

  test("voice-command reference renders all three languages, read-only", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/dictionary?tab=commands");
    await expect(page.getByTestId("commands-note")).toContainText("майбутня функція");
    const table = page.getByTestId("commands-table");
    await expect(table.getByText("новий абзац")).toBeVisible();
    await expect(table.getByText("new paragraph")).toBeVisible();
    await expect(table.getByText("neuer absatz")).toBeVisible();
    // Section navigation commands are listed separately.
    await expect(page.getByText("Навігація розділами")).toBeVisible();
    // The one editable voice surface is one click away.
    await page.getByTestId("commands-to-templates").click();
    await expect(page).toHaveURL(/#\/admin\/templates/);
  });
});

test.describe("autocomplete corpus", () => {
  test("acceptance columns render the roll-up counters", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/autocomplete");
    const sysRow = page.getByTestId("phrases-table").locator("tbody tr", { hasText: "аускультація" });
    await expect(sysRow).toContainText("120");
    await expect(sysRow).toContainText("40");
    await expect(sysRow).toContainText("33%");
    await expect(sysRow.getByText("системна")).toBeVisible();
    await expect(sysRow.getByTestId("phrase-delete")).toHaveCount(0);
  });

  test("the PII 422 renders the clear message with the detector chips", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/autocomplete");
    await page.getByTestId("phrase-add").click();
    await page.getByTestId("phrase-text").fill("подзвонити пацієнту 0501234567");
    await page.getByTestId("phrase-save").click();

    const alert = page.getByTestId("pii-alert");
    await expect(alert).toContainText("Ця фраза схожа на персональні дані — не збережено");
    await expect(page.getByTestId("pii-pattern-phone")).toHaveText("телефон");
    await expect(alert).toContainText("хибно спрацювати");

    // The duplicate 409 (Python-repr wire shape) renders distinctly.
    await page.getByTestId("phrase-text").fill("тони серця ритмічні");
    await page.getByTestId("phrase-save").click();
    await expect(page.getByTestId("exists-alert")).toContainText("вже існує");

    // A clean phrase lands in the table with the clinic scope.
    await page.getByTestId("phrase-text").fill("дихання везикулярне");
    await page.getByTestId("phrase-save").click();
    const row = page.getByTestId("phrases-table").locator("tbody tr", { hasText: "дихання везикулярне" });
    await expect(row.getByText("клініка")).toBeVisible();
  });

  test("snippets: trigger format guarded client-side, /trigger shown, delete confirmed", async ({ page }) => {
    const ctl = await adminSession(page);
    await page.goto("/#/admin/autocomplete?tab=snippets");
    await expect(page.getByTestId("snippets-table")).toContainText("/norm");

    await page.getByTestId("snippet-add").click();
    await page.getByTestId("snippet-trigger").fill("/bp");
    await page.getByTestId("snippet-expansion").fill("АТ ___/___ мм рт. ст.");
    await expect(page.getByTestId("snippet-form")).toContainText("без початкового «/»");
    await expect(page.getByTestId("snippet-save")).toBeDisabled();

    await page.getByTestId("snippet-trigger").fill("bp");
    await page.getByTestId("snippet-save").click();
    const row = page.getByTestId("snippets-table").locator("tbody tr", { hasText: "/bp" });
    await expect(row).toBeVisible();

    await row.getByTestId("snippet-delete").click();
    await page.getByTestId("snippet-delete-confirm-confirm").click();
    await expect(page.getByTestId("snippets-table").locator("tbody tr", { hasText: "/bp" })).toHaveCount(0);
    expect(ctl.snippets.some((s) => s.trigger === "bp")).toBe(false);
  });
});

test.describe("search synonyms", () => {
  test("safety note pinned; system groups immutable; a group edit changes the live expansion", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/synonyms");

    await expect(page.getByTestId("syn-safety-note"))
      .toContainText("Пов'язане — не означає взаємозамінне");

    // System group: visible, no controls.
    const sysRow = page.getByTestId("syn-table").locator("tbody tr", { hasText: "інфаркт міокарда" });
    await expect(sysRow.getByText("системна")).toBeVisible();
    await expect(sysRow.getByTestId("syn-edit")).toHaveCount(0);
    await expect(sysRow.getByTestId("syn-delete")).toHaveCount(0);

    // Probe BEFORE the edit: no "едема" in the expansion.
    await page.getByTestId("syn-probe-q").fill("набряк");
    await page.getByTestId("syn-probe-run").click();
    await expect(page.getByTestId("syn-probe-out")).toContainText("набряки");
    await expect(page.getByTestId("syn-probe-out")).not.toContainText("едема");

    // Edit the tenant group: add the missing term.
    const tenantRow = page.getByTestId("syn-table").locator("tbody tr", { hasText: "набряк" });
    await tenantRow.getByTestId("syn-edit").click();
    await page.getByTestId("syn-terms").fill("набряк, набряки, едема");
    await page.getByTestId("syn-save").click();
    await expect(page.getByTestId("syn-table")).toContainText("едема");

    // The SAME probe now returns the added term — the search fixture changed.
    await page.getByTestId("syn-probe-run").click();
    await expect(page.getByTestId("syn-probe-out")).toContainText("едема");
  });

  test("group deletion names the search consequence; client validator bounds terms", async ({ page }) => {
    await adminSession(page);
    await page.goto("/#/admin/synonyms");

    // Too few terms: the client mirror blocks before any round-trip.
    await page.getByTestId("syn-add").click();
    await page.getByTestId("syn-terms").fill("самотній");
    await expect(page.getByTestId("syn-form")).toContainText("щонайменше 2");
    await expect(page.getByTestId("syn-save")).toBeDisabled();
    await page.getByTestId("syn-terms").fill("гіпертензія, гіпертонія");
    await page.getByTestId("syn-save").click();
    await expect(page.getByTestId("syn-table")).toContainText("гіпертонія");

    const row = page.getByTestId("syn-table").locator("tbody tr", { hasText: "гіпертонія" });
    await row.getByTestId("syn-delete").click();
    await expect(page.getByTestId("syn-delete-confirm-consequence"))
      .toContainText("перестане розширювати");
    await page.getByTestId("syn-delete-confirm-confirm").click();
    await expect(page.getByTestId("syn-table").locator("tbody tr", { hasText: "гіпертонія" })).toHaveCount(0);
  });
});
