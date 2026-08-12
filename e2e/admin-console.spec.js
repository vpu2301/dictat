// admin-console.spec.js — sprint 17, slice FE-A: the /admin shell, users and
// audit surfaces, and the MFA grace flow WITH the way back.
//
// Everything runs against route mocks (helpers/adminMocks.js); the roles
// param on the installer is what flips the console between an admin, a
// clinician and an auditor.
import { test, expect } from "@playwright/test";
import {
  ADMIN_EMAIL, ADMIN_SUB, CLINICIAN_EMAIL, CLINICIAN_SUB, OTP,
  defaultUsers, installAdminMocks, login,
} from "./helpers/adminMocks.js";

async function typeOtp(page, code) {
  const boxes = page.getByTestId("otp-input").locator("input");
  for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]);
}

// ── (a) gating ────────────────────────────────────────────────────────────

test("clinician deep-links into /admin → standard forbidden state, and the server 403 renders as an error card", async ({ page }) => {
  const ctl = await installAdminMocks(page, { forbidUsersList: true });
  await login(page, CLINICIAN_EMAIL, /#\/$/);

  // Client gate: both the console root and a surface path stop at Forbidden.
  await page.goto("/#/admin");
  await expect(page.getByText(/Доступ заборонено|Access denied/i).first()).toBeVisible();
  await page.goto("/#/admin/users");
  await expect(page.getByText(/Доступ заборонено|Access denied/i).first()).toBeVisible();
  // No console chrome behind the gate.
  await expect(page.getByTestId("admin-console")).toHaveCount(0);

  // Sidebar: no admin entry for a clinician.
  await expect(page.locator("aside").getByText(/Адмін-консоль|Admin console/)).toHaveCount(0);

  // Server boundary: even for an admin, a 403 from GET /admin/users renders
  // the error card (never a crash, never a silent empty table).
  ctl.sessionOpen = false;   // end the clinician's session…
  await page.reload();       // …so the login screen is reachable again
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/users");
  await expect(page.getByTestId("users-admin")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "403" }).first()).toBeVisible();
});

test("auditor may open the audit surface but not the users surface", async ({ page }) => {
  const users = defaultUsers();
  users.find((u) => u.email === CLINICIAN_EMAIL).roles = ["auditor"];
  await installAdminMocks(page, { users });
  await login(page, CLINICIAN_EMAIL, /#\/audit\/events$/);

  await page.goto("/#/admin/audit");
  await expect(page.getByTestId("audit-admin")).toBeVisible();
  // The rail hides what the auditor cannot open.
  await expect(page.getByTestId("adm-nav-audit")).toBeVisible();
  await expect(page.getByTestId("adm-nav-users")).toHaveCount(0);

  await page.goto("/#/admin/users");
  await expect(page.getByText(/Доступ заборонено|Access denied/i).first()).toBeVisible();
});

// ── (b) the MFA grace flow, there and back ────────────────────────────────

test("non-enrolled admin's mutation routes to MFA enrolment and returns to the roster after", async ({ page }) => {
  await installAdminMocks(page, { graceOn: true });
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/users");
  await expect(page.getByTestId("users-admin")).toBeVisible();

  // Try a role change → the PUT 403s with the grace code → the client routes
  // to enrolment carrying the way back.
  await page.getByTestId(`user-roles-${CLINICIAN_EMAIL}`).click();
  await page.getByTestId("role-auditor").check();
  await page.getByTestId("roles-save").click();

  await expect(page).toHaveURL(/#\/mfa\?required=1&return=%2Fadmin%2Fusers/);
  await expect(page.getByTestId("mfa-required-note")).toBeVisible();

  // Enrol: begin → QR shown → type the code → done.
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();
  await typeOtp(page, OTP);
  await expect(page.getByTestId("mfa-done")).toBeVisible();

  // The way back: the done button names it and lands on the roster.
  await page.getByTestId("mfa-carry-on").click();
  await expect(page).toHaveURL(/#\/admin\/users$/);
  await expect(page.getByTestId("users-admin")).toBeVisible();

  // And the mutation now passes (session counts as MFA-verified in the mock).
  await page.getByTestId(`user-roles-${CLINICIAN_EMAIL}`).click();
  await page.getByTestId("role-auditor").check();
  await page.getByTestId("roles-save").click();
  await expect(page.getByTestId("roles-list")).toHaveCount(0); // dialog closed = success
});

// ── (c)+(d)+(e) users surface ─────────────────────────────────────────────

test("invite flow: the new account lands in the roster as «запрошений»", async ({ page }) => {
  const ctl = await installAdminMocks(page);
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/users");

  await page.getByTestId("open-invite").click();
  await page.getByTestId("invite-email").fill("new.doc@tenant-a.example");
  await page.getByTestId("invite-name").fill("Dr. New");
  await page.getByTestId("invite-submit").click();

  await expect(page.getByTestId("user-row-new.doc@tenant-a.example")).toBeVisible();
  await expect(page.getByTestId("user-row-new.doc@tenant-a.example")).toContainText(/запрошений|invited/);
  expect(ctl.calls.invites).toHaveLength(1);
  expect(ctl.calls.invites[0]).toMatchObject({ email: "new.doc@tenant-a.example", role: "clinician" });

  // 409 on a duplicate email renders the field error, not a crash.
  await page.getByTestId("open-invite").click();
  await page.getByTestId("invite-email").fill(CLINICIAN_EMAIL);
  await page.getByTestId("invite-name").fill("Dupe");
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("invite-email-taken")).toBeVisible();
});

test("last-admin 409 renders as a blocking explanation inside the role editor", async ({ page }) => {
  await installAdminMocks(page); // fixture has exactly one tenant_admin
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/users");

  await page.getByTestId(`user-roles-${ADMIN_EMAIL}`).click();
  await page.getByTestId("role-tenant_admin").uncheck();
  await page.getByTestId("role-clinician").check();
  await page.getByTestId("roles-save").click();

  await expect(page.getByTestId("last-admin-409")).toBeVisible();
  await expect(page.getByTestId("last-admin-409")).toContainText(/останнього адміністратора|last tenant administrator/i);
  // The dialog stays open — the admin reads the explanation where they acted.
  await expect(page.getByTestId("roles-list")).toBeVisible();
});

test("role change round-trips and the target's nav changes on their next login", async ({ page }) => {
  const ctl = await installAdminMocks(page);
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/users");

  // Clinician → auditor-only.
  await page.getByTestId(`user-roles-${CLINICIAN_EMAIL}`).click();
  await page.getByTestId("role-clinician").uncheck();
  await page.getByTestId("role-auditor").check();
  await page.getByTestId("roles-save").click();
  await expect(page.getByTestId("roles-list")).toHaveCount(0);
  expect(ctl.calls.rolePuts).toHaveLength(1);
  expect(ctl.calls.rolePuts[0]).toMatchObject({ sub: CLINICIAN_SUB, roles: ["auditor"] });
  // The roster shows the new collapsed primary after reload.
  await expect(page.getByTestId(`user-row-${CLINICIAN_EMAIL}`)).toContainText("auditor");

  // Their next login: the mock's /auth/me now answers ["auditor"], so the
  // shell boots the auditor workspace — wordmark suffix, no create button.
  ctl.sessionOpen = false;
  await page.reload();
  await login(page, CLINICIAN_EMAIL, /#\/audit\/events$/);
  await expect(page.locator(".sb-wordmark-sfx")).toBeVisible();
  await expect(page.locator("aside").getByText(/Нова консультація|New consultation/)).toHaveCount(0);
});

// ── (f)+(g) audit surface ─────────────────────────────────────────────────

test("audit filters compose into the request; verify renders OK and the tampered detail; no file egress exists", async ({ page }) => {
  const ctl = await installAdminMocks(page);
  await login(page, ADMIN_EMAIL);
  await page.goto("/#/admin/audit");
  await expect(page.getByTestId("audit-table")).toBeVisible();

  // Compose three filters and apply.
  await page.getByTestId("filter-kind").fill("user.role_changed");
  await page.getByTestId("filter-severity").selectOption("sec");
  await page.getByTestId("filter-actor").fill(ADMIN_SUB);
  await page.getByTestId("filter-apply").click();

  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("user.role_changed");
  const q = ctl.auditQueries[ctl.auditQueries.length - 1];
  expect(q).toContain("kind=user.role_changed");
  expect(q).toContain("severity=sec");
  expect(q).toContain(`actor_sub=${ADMIN_SUB}`);

  // Verify: clean chain.
  await page.getByTestId("audit-tab-verify").click();
  await page.getByTestId("verify-run").click();
  await expect(page.getByTestId("verify-result")).toContainText(/Підтверджено|Verified/);

  // Verify: tampered chain names seq + reason.
  ctl.tamperedVerify = true;
  await page.getByTestId("verify-run").click();
  await expect(page.getByTestId("verify-divergence")).toContainText("seq 3");
  await expect(page.getByTestId("verify-divergence")).toContainText(/хеш вмісту|payload hash/i);

  // No export affordance anywhere on the admin audit surface (either tab).
  for (const tab of ["audit-tab-events", "audit-tab-verify"]) {
    await page.getByTestId(tab).click();
    await expect(page.locator(".adm-content").getByText(/експорт|export|csv/i)).toHaveCount(0);
    await expect(page.locator(".adm-content [download]")).toHaveCount(0);
  }
});
