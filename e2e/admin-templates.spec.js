// admin-templates.spec.js — sprint 17, slice FE-B: the /admin/templates
// surface. The sprint's VERIFY lines, verbatim:
//   · renaming a section shows "cosmetic"; removing one flips the banner to
//     "STRUCTURAL — new version";
//   · saving a structural edit lands a NEW template id in the list with
//     lineage shown;
//   · the re-bind flow moves a fixture draft to the successor;
//   · a colliding voice alias surfaces the (backend) warning;
//   · saved options appear in the PUT body the extraction fixtures consume.
import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, installAdminMocks, login } from "./helpers/adminMocks.js";
import {
  DRAFT_REPORT_ID, SUCCESSOR_TPL_ID, SYS_TPL_ID, TENANT_TPL_ID,
  installTemplateMocks, optionCollision422,
} from "./helpers/adminTemplatesMocks.js";

async function openTemplatesAdmin(page) {
  await page.goto("/#/admin/templates");
  await expect(page.getByTestId("templates-admin")).toBeVisible();
}

async function setup(page, tplOpts = {}) {
  const ctl = await installAdminMocks(page);
  const tctl = await installTemplateMocks(page, tplOpts);
  await login(page, ADMIN_EMAIL);
  return { ctl, tctl };
}

// ── list ──────────────────────────────────────────────────────────────────

test("list shows every lifecycle status, filters compose, lineage links to the ancestor", async ({ page }) => {
  await setup(page);
  await openTemplatesAdmin(page);

  // All three fixtures visible, statuses explicit.
  await expect(page.getByTestId("admt-row-cardiology_outpatient_uk")).toBeVisible();
  const tenantRow = page.getByTestId("admt-row-cardio_clinic_uk");
  await expect(tenantRow).toBeVisible();
  await expect(tenantRow.locator(".chip[data-status=draft]")).toBeVisible();

  // Origin filter: system only. (MenuSelect's accessible name is its aria-label.)
  const originSelect = page.getByRole("button", { name: /Походження|Origin/ });
  await originSelect.click();
  await page.getByRole("option", { name: /Системні|System/ }).click();
  await expect(page.getByTestId("admt-row-cardiology_outpatient_uk")).toBeVisible();
  await expect(page.getByTestId("admt-row-cardio_clinic_uk")).toHaveCount(0);
  await originSelect.click();
  await page.getByRole("option", { name: /^(Всі|All)$/ }).click();

  // Lineage chip on the tenant row → ancestor detail.
  await page.getByTestId("admt-lineage-cardio_clinic_uk").click();
  await expect(page.getByTestId("template-admin-detail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Кардіологічний огляд" })).toBeVisible();
});

// ── live banner + structural save ─────────────────────────────────────────

test("live banner: rename → cosmetic; remove a section → STRUCTURAL with the reason; structural save lands a new id with lineage", async ({ page }) => {
  const { tctl } = await setup(page);
  await page.goto(`/#/admin/templates/${TENANT_TPL_ID}`);
  await page.getByTestId("admt-edit").click();

  // Rename a section — the banner settles on «косметична».
  const nameInput = page.locator(".tpl-edit-section-head input").first();
  await nameInput.fill("Скарги пацієнта");
  const banner = page.getByTestId("edit-kind-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-kind", "cosmetic");
  await expect(banner).toContainText(/Косметична зміна/);

  // Remove the second section — the banner flips to «СТРУКТУРНА» and names it.
  await page.locator(".tpl-edit-section .iconbtn.danger[aria-label=Remove]").nth(1).click();
  await expect(banner).toHaveAttribute("data-kind", "structural");
  await expect(banner).toContainText(/СТРУКТУРНА зміна — буде створено нову версію/);
  await expect(banner).toContainText(/Вилучено секції: «smoking»/);

  // Save → the structural confirm (unchanged save-time gate) → NEW id.
  await page.getByRole("button", { name: /Зберегти|Save/ }).click();
  await page.getByRole("button", { name: /Створити нову версію|Create new version/ }).click();

  // The detail we land on is the NEW template, lineage pointing at the old id.
  await expect(page.getByTestId("template-admin-detail")).toBeVisible();
  await expect(page.getByTestId("admt-parent-link")).toContainText(TENANT_TPL_ID.slice(0, 8));
  const put = tctl.calls.puts.at(-1);
  expect(put.id).toBe(TENANT_TPL_ID);
  expect(put.body.sections.map((s) => s.id)).toEqual(["skarhy"]);

  // And the list shows the new row with its lineage chip.
  await page.getByTestId("admt-back").click();
  const newRow = page.getByTestId("admt-row-cardio_clinic_uk").filter({
    has: page.locator(".chip[data-status=draft]"),
  });
  await expect(newRow.first()).toBeVisible();
  await expect(page.getByTestId("admt-lineage-cardio_clinic_uk").last()).toBeVisible();
});

// ── clone ─────────────────────────────────────────────────────────────────

test("clone-from-system lands a tenant draft with lineage", async ({ page }) => {
  const { tctl } = await setup(page);
  await page.goto(`/#/admin/templates/${SYS_TPL_ID}`);
  await page.getByTestId("admt-clone").click();
  await page.getByPlaceholder("cardiology_outpatient_uk_custom").fill("cardio_clinic_uk_b");
  await page.getByRole("button", { name: /^(Клонувати|Clone)$/ }).last().click();

  await expect(page.getByTestId("template-admin-detail")).toBeVisible();
  await expect(page.getByTestId("admt-parent-link")).toContainText(SYS_TPL_ID.slice(0, 8));
  await expect(page.locator(".tpl-badge.custom")).toBeVisible();
  expect(tctl.calls.clones.at(-1)).toMatchObject({
    system_template_id: SYS_TPL_ID, new_code: "cardio_clinic_uk_b",
  });
});

// ── deprecate → re-bind → deprecate ───────────────────────────────────────

test("deprecate names its consequence; a draft-bound template 409s into the re-bind flow; re-bind frees it", async ({ page }) => {
  const { tctl } = await setup(page);
  await page.goto(`/#/admin/templates/${TENANT_TPL_ID}`);

  // The bound panel is already on the page: one draft, one finalized kept.
  await expect(page.getByTestId("rebind-panel")).toBeVisible();
  await expect(page.getByTestId("rebind-row")).toHaveCount(1);
  await expect(page.getByTestId("rebind-kept")).toContainText(/зберігають цей шаблон/);

  // Deprecate → consequence named → 409 → the notice points at the panel.
  await page.getByTestId("admt-deprecate").click();
  await expect(page.getByTestId("deprecate-dialog-consequence"))
    .toContainText(/зникає з вибору для нових звітів; наявні звіти зберігають його/);
  await page.getByTestId("deprecate-dialog-confirm").click();
  await expect(page.getByTestId("admt-rebind-notice")).toBeVisible();

  // Re-bind is disabled until a successor is chosen.
  const action = page.getByTestId(`rebind-action-${DRAFT_REPORT_ID.slice(0, 8)}`);
  await expect(action).toBeDisabled();
  await page.getByRole("button", { name: /Шаблон-наступник|Successor template/ }).click();
  await page.getByRole("option", { name: /Кардіо наступник/ }).click();
  await expect(action).toBeEnabled();

  // Per-draft confirm → the POST carries exactly the two ids.
  await action.click();
  await expect(page.getByTestId("rebind-dialog-consequence")).toContainText(/Кардіо наступник/);
  await page.getByTestId("rebind-dialog-confirm").click();
  await expect(page.getByTestId("rebind-row")).toHaveCount(0);
  expect(tctl.calls.rebinds.at(-1)).toMatchObject({
    template_id: TENANT_TPL_ID,
    report_id: DRAFT_REPORT_ID,
    to_template_id: SUCCESSOR_TPL_ID,
  });
  // The draft now sits on the successor — it opens correctly from there.
  expect(tctl.bound[SUCCESSOR_TPL_ID].map((r) => r.report_id)).toContain(DRAFT_REPORT_ID);

  // No drafts remain → retry succeeds → the status chip flips.
  await page.getByTestId("rebind-retry-deprecate").click();
  await expect(page.locator(".admt-detail-meta .chip[data-status=deprecated]")).toBeVisible();
});

// ── option lists: collisions + the saved definition ───────────────────────

test("option alias collisions: the live mirror blocks in place, the backend 422 renders its message, a clean save carries the option", async ({ page }) => {
  const { tctl } = await setup(page);
  await page.goto(`/#/admin/templates/${TENANT_TPL_ID}`);
  await page.getByTestId("admt-edit").click();

  // Add an option whose alias collides with an existing option's alias —
  // the client mirror of the backend validator warns inline, save disables.
  const smoking = page.locator(".tpl-edit-section").nth(1);
  await smoking.getByRole("button", { name: /Додати варіант|Add option/ }).click();
  const newRow = smoking.locator(".tpl-opt-row").last();
  await newRow.getByPlaceholder(/значення|value/).fill("former");
  await newRow.getByPlaceholder(/Підпис|Label/).fill("Кинув палити");
  await newRow.getByPlaceholder(/голосові псевдоніми|voice aliases/).fill("не палить");
  await expect(smoking.locator(".tpl-inline-err"))
    .toContainText(/вже використано іншим варіантом|already used by another option/);
  await expect(page.getByRole("button", { name: /Зберегти|Save/ })).toBeDisabled();

  // Fix the alias; arm a backend-only 422 — its message must surface.
  await newRow.getByPlaceholder(/голосові псевдоніми|voice aliases/).fill("кинув палити");
  tctl.put422 = optionCollision422();
  await page.getByRole("button", { name: /Зберегти|Save/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /duplicated across options/ }))
    .toBeVisible();

  // Disarmed, the save goes through — and the PUT body carries the new option
  // with its aliases (what a dictation session's extraction will consume).
  await page.getByRole("button", { name: /Зберегти|Save/ }).click();
  const put = tctl.calls.puts.at(-1);
  const options = put.body.sections.find((s) => s.id === "smoking").options;
  expect(options.map((o) => o.value)).toEqual(["never", "current", "former"]);
  expect(options.at(-1)).toMatchObject({
    value: "former", label: "Кинув палити", voice_aliases: ["кинув палити"],
  });
});

// ── the clinician library is untouched ────────────────────────────────────

test("the /library templates tab still renders and lists the same fixtures", async ({ page }) => {
  await setup(page);
  await page.goto("/#/library/reports");
  await expect(page.getByText("Кардіологічний огляд").first()).toBeVisible();
  await expect(page.getByText("Кардіо (клініка)").first()).toBeVisible();
});
