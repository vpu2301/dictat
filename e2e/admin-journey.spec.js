// admin-journey.spec.js — sprint 17, the full journey (VERIFY item 7):
//
//   admin logs in → MFA → clones a system template → edits an option list →
//   a clinician session uses it → admin sees the audit trail of their own
//   actions.
//
// One stateful mock world threads the whole story: the clone made in step 3
// is what the clinician opens in step 5, and the audit screen in step 6 is
// DERIVED from the recorded actions (adminJourneyMocks), not a canned list.
// Suite-level guards: zero console errors (network-level "Failed to load
// resource" noise from the deliberate 403 excluded), and no file-egress
// affordance on the audit surface.
import { test, expect } from "@playwright/test";
import {
  ADMIN_EMAIL, ADMIN_SUB, CLINICIAN_EMAIL, OTP,
  installAdminMocks, login,
} from "./helpers/adminMocks.js";
import { SYS_TPL_ID, installTemplateMocks } from "./helpers/adminTemplatesMocks.js";
import { installJourneyAudit } from "./helpers/adminJourneyMocks.js";

const CLONE_NAME = "Кардіо огляд (клініка)";
const CLONE_CODE = "cardio_journey_uk";

async function typeOtp(page, code) {
  const boxes = page.getByTestId("otp-input").locator("input");
  for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]);
}

test("the sprint journey: login → MFA → clone → option edit → clinician uses it → own audit trail", async ({ page }) => {
  test.setTimeout(120_000);

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const txt = m.text();
    if (/Failed to load resource/.test(txt)) return; // the deliberate 403/409s
    // page.route cannot intercept WebSockets, so the notifications socket
    // always fails against mocks — environment noise, not an app error.
    if (/WebSocket connection .* failed/.test(txt)) return;
    consoleErrors.push(txt);
  });

  // The world: MFA required, admin not yet enrolled; template fixtures.
  const ctl = await installAdminMocks(page, { graceOn: true });
  const tctl = await installTemplateMocks(page);
  const jctl = await installJourneyAudit(page, ctl, tctl);

  await test.step("1 · admin logs in, /admin lands on templates", async () => {
    await login(page, ADMIN_EMAIL);
    await page.goto("/#/admin");
    await expect(page).toHaveURL(/#\/admin\/templates$/);
    await expect(page.getByTestId("templates-admin")).toBeVisible();
  });

  await test.step("2 · a gated mutation routes to MFA enrolment and back", async () => {
    await page.getByTestId("adm-nav-users").click();
    await expect(page.getByTestId("users-admin")).toBeVisible();

    // Invite → 403 mfa_enrolment_required → enrolment carrying the way back.
    await page.getByTestId("open-invite").click();
    await page.getByTestId("invite-email").fill("dr.journey@tenant-a.example");
    await page.getByTestId("invite-name").fill("Dr. Journey");
    await page.getByTestId("invite-submit").click();

    await expect(page).toHaveURL(/#\/mfa\?required=1&return=%2Fadmin%2Fusers/);
    await expect(page.getByTestId("mfa-required-note")).toBeVisible();
    await page.getByTestId("mfa-begin").click();
    await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();
    await typeOtp(page, OTP);
    await expect(page.getByTestId("mfa-done")).toBeVisible();
    await page.getByTestId("mfa-carry-on").click();
    await expect(page).toHaveURL(/#\/admin\/users$/);

    // The interrupted intent, redone — now it lands.
    await page.getByTestId("open-invite").click();
    await page.getByTestId("invite-email").fill("dr.journey@tenant-a.example");
    await page.getByTestId("invite-name").fill("Dr. Journey");
    await page.getByTestId("invite-submit").click();
    await expect(page.getByTestId("user-row-dr.journey@tenant-a.example")).toBeVisible();
  });

  await test.step("3 · clone a system template", async () => {
    await page.getByTestId("adm-nav-templates").click();
    await page.getByTestId("admt-row-cardiology_outpatient_uk").click();
    await expect(page.getByTestId("template-admin-detail")).toBeVisible();
    await page.getByTestId("admt-clone").click();
    await page.getByPlaceholder("Кардіологічний огляд").fill(CLONE_NAME);
    await page.getByPlaceholder("cardiology_outpatient_uk_custom").fill(CLONE_CODE);
    await page.getByRole("button", { name: /^(Клонувати|Clone)$/ }).last().click();

    // Landed on the clone: a tenant draft with lineage to the system source.
    await expect(page.getByTestId("template-admin-detail")).toBeVisible();
    await expect(page.getByRole("heading", { name: CLONE_NAME })).toBeVisible();
    await expect(page.getByTestId("admt-parent-link")).toContainText(SYS_TPL_ID.slice(0, 8));
    expect(tctl.calls.clones.at(-1)).toMatchObject({
      system_template_id: SYS_TPL_ID, new_code: CLONE_CODE,
    });
  });

  await test.step("4 · option-list edit: live banner says cosmetic, save carries the option", async () => {
    await page.getByTestId("admt-edit").click();
    const smoking = page.locator(".tpl-edit-section").nth(1);
    await smoking.getByRole("button", { name: /Додати варіант|Add option/ }).click();
    const row = smoking.locator(".tpl-opt-row").last();
    await row.getByPlaceholder(/значення|value/).fill("former");
    await row.getByPlaceholder(/Підпис|Label/).fill("Кинув палити");
    await row.getByPlaceholder(/голосові псевдоніми|voice aliases/).fill("кинув палити");

    const banner = page.getByTestId("edit-kind-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-kind", "cosmetic");
    await expect(banner).toContainText(/Косметична зміна/);

    await page.getByRole("button", { name: /Зберегти|Save/ }).click();
    await expect(page.locator(".tpl-edit-section")).toHaveCount(0); // editor closed
    const put = tctl.calls.puts.at(-1);
    const options = put.body.sections.find((s) => s.id === "smoking").options;
    expect(options.at(-1)).toMatchObject({
      value: "former", label: "Кинув палити", voice_aliases: ["кинув палити"],
    });
  });

  await test.step("5 · a clinician session sees the clone with the new option", async () => {
    ctl.sessionOpen = false;
    await page.reload();
    await login(page, CLINICIAN_EMAIL, /#\/$/);

    await page.goto("/#/library/reports");
    await page.getByText(CLONE_NAME).first().click();
    // The detail modal renders the clone's sections — including the fresh option.
    await expect(page.getByText("Кинув палити").first()).toBeVisible();
    await expect(page.getByText(CLONE_CODE).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("6 · back as admin: the audit trail shows their own actions", async () => {
    ctl.sessionOpen = false;
    await page.reload();
    await login(page, ADMIN_EMAIL);
    await page.goto("/#/admin/audit");
    await expect(page.getByTestId("audit-table")).toBeVisible();

    // The derived trail: enrolment, invite, clone, option edit — in order.
    const body = page.locator("tbody");
    await expect(body).toContainText("auth.mfa.enrolled");
    await expect(body).toContainText("user.invited");
    await expect(body).toContainText("template.cloned");
    await expect(body).toContainText("template.updated");

    // Filters compose on the same trail.
    await page.getByTestId("filter-kind").fill("template.cloned");
    await page.getByTestId("filter-apply").click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(body).toContainText(SYS_TPL_ID.slice(0, 8));
    expect(jctl.auditQueries.at(-1)).toContain("kind=template.cloned");

    // The chain verifies over everything the journey wrote.
    await page.getByTestId("audit-tab-verify").click();
    await page.getByTestId("verify-run").click();
    await expect(page.getByTestId("verify-result")).toContainText(/Підтверджено|Verified/);
    await expect(page.getByTestId("verify-result")).toContainText(String(tctl.calls.puts.length + tctl.calls.clones.length + 3));

    // No file egress on either audit tab.
    for (const tab of ["audit-tab-events", "audit-tab-verify"]) {
      await page.getByTestId(tab).click();
      await expect(page.locator(".adm-content").getByText(/експорт|export|csv/i)).toHaveCount(0);
      await expect(page.locator(".adm-content [download]")).toHaveCount(0);
    }
  });

  expect(consoleErrors).toEqual([]);
});
