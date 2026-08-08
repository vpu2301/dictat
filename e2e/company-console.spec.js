// company-console.spec.js — the Klarnote platform-owner console (#/company).
//
// The backend is mocked at the HTTP boundary so the *shapes* under test are the
// real ones (TenantListOut / TenantOut / MemberListOut / UserSummary / audit
// events), but the whole SPA above them — the owner gate, the path→hash bridge,
// the portfolio aggregation, the cross-tenant drill-in — is the real code.
//
// The two things worth pinning here are the ones that are easy to get wrong:
//   1. the gate admits ONLY the allowlisted email, whatever roles you carry;
//   2. the portfolio really is cross-tenant, i.e. it renders tenants other than
//      the one the token is scoped to.
import { test, expect } from "@playwright/test";
import { installMocks, login, staffLogin, staffLoginTo, OWNER_EMAIL } from "./helpers/companyMocks.js";
import { FEATURES } from "../src/api/services.js";

test.describe("Klarnote owner console", () => {
  test("the plain /company path reaches the console", async ({ page }) => {
    await installMocks(page);
    await login(page);

    // The URL the console is shared as — no '#'. main.jsx bridges it.
    await page.goto("/company");
    await expect(page.locator(".co-rail-brand")).toContainText(/Platform console|Консоль платформи/);
    await expect(page).toHaveURL(/#\/company/);
  });

  test("the portfolio is cross-tenant and drills into a non-active tenant", async ({ page }) => {
    await installMocks(page);
    await login(page);
    await page.goto("/#/company/tenants");

    const rows = page.locator(".co-table tbody tr.co-row");
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    // Dev Hospital B is NOT the token's tenant — the whole point of the trio.
    const rowB = rows.filter({ hasText: "Dev Hospital B" });
    await expect(rowB).toHaveCount(1);
    await rowB.click();

    const detail = page.locator(".co-detail");
    await expect(detail).toContainText("Dev Hospital B LLC");
    await expect(detail).toContainText(OWNER_EMAIL);
    // A non-active tenant must say plainly why its usage is unreachable.
    await expect(detail.locator(".co-detail-note")).toBeVisible();
  });

  test("search narrows the portfolio by member email", async ({ page }) => {
    await installMocks(page);
    await login(page);
    await page.goto("/#/company/tenants");
    await expect(page.locator(".co-table tbody tr.co-row")).toHaveCount(3, { timeout: 10000 });

    await page.locator(".co-search input").fill("clinician@tenant-a.example");
    await expect(page.locator(".co-table tbody tr.co-row")).toHaveCount(1);
    await expect(page.locator(".co-table tbody tr.co-row")).toContainText("Dev Hospital A");
  });

  test("overview rolls up tenants, people and service health", async ({ page }) => {
    await installMocks(page);
    await login(page);
    await page.goto("/#/company");

    const kpis = page.locator(".co-kpis .stat-card");
    await expect(kpis.first()).toContainText("3", { timeout: 10000 });      // 3 tenants
    // Health probes every configured service and none is down under the mock.
    await expect(page.locator(".co-health-mini li.s-down")).toHaveCount(0);
  });

  test("telemetry verifies the audit chain on demand", async ({ page }) => {
    await installMocks(page);
    await login(page);
    await page.goto("/#/company/telemetry");

    await expect(page.locator(".co-chainverify")).toBeVisible({ timeout: 10000 });
    await page.locator(".co-chainverify button").click();
    await expect(page.locator(".co-chainverify .status-badge")).toContainText(/intact|цілий/);
  });

  test("subscriptions never claims to be billing data", async ({ page }) => {
    await installMocks(page);
    await login(page);
    await page.goto("/#/company/subscriptions");

    await expect(page.locator(".co-note-warn")).toContainText(/not billing data|не платіжні дані/i);
    // Two clinical seats (clinician + nurse) ⇒ the Pro tier, indicatively.
    await expect(page.locator(".co-kpis")).toContainText("Pro", { timeout: 10000 });
  });

  test("the owner gets a Klarnote nav entry that reaches the console", async ({ page }) => {
    await installMocks(page);
    await login(page);

    await page.locator(".sb-user").click();
    const menu = page.locator(".sb-user-menu");
    // The Klarnote group is a hover flyout (SubMenu) that closes ~140 ms after
    // the pointer leaves it, so hover the trigger and click the item rather
    // than click-then-click — the latter races the close timer.
    // The SPA boots in Ukrainian, so match either localisation.
    await menu.getByText("Klarnote", { exact: true }).hover();
    const item = menu.getByRole("menuitem").filter({ hasText: /^(Компанія|Company)$/ });
    await expect(item).toBeVisible();
    await item.click();

    await expect(page).toHaveURL(/#\/company/);
    await expect(page.locator(".co-rail-brand")).toBeVisible();
  });

  test("the ASR quota reads 'within limit' when no quota event exists", async ({ page }) => {
    // Guards against the mock (and the real endpoint) being read unfiltered:
    // asrQuotaStatus() asks for kind=asr.quota_exceeded, and any other event
    // coming back would be misreported as a trip.
    await installMocks(page);
    await login(page);
    await page.goto("/#/company/subscriptions");

    await expect(page.locator(".co-kpis")).toContainText(/within|у межах/, { timeout: 10000 });
  });

  test("a tenant_admin who is not the owner is refused", async ({ page }) => {
    await installMocks(page, { email: "admin@tenant-a.example", roles: ["tenant_admin", "clinician"] });
    await login(page, "admin@tenant-a.example");

    // …the nav never offered the console in the first place. Assert on the
    // section header, which is the same string in every language, so this
    // cannot pass for the wrong reason the way a localised "Company" would.
    await page.locator(".sb-user").click();
    await expect(page.locator(".sb-user-menu").getByText("Klarnote", { exact: true })).toHaveCount(0);

    // …and forcing the route gives an honest refusal, not the console.
    await page.goto("/#/company");
    await expect(page.locator(".co-forbidden-card")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".co-forbidden-card")).toContainText("admin@tenant-a.example");
  });
});

// The staff door is the point of this whole surface: Klarnote's team must never
// be sent to a clinic's front desk, and a clinic account must never get in here.
test.describe("Klarnote staff sign-in", () => {
  test("an unauthenticated /company goes to the STAFF door, not /login", async ({ page }) => {
    await installMocks(page);
    await page.goto("/#/company");

    await expect(page).toHaveURL(/#\/company\/login/, { timeout: 10000 });
    await expect(page.locator(".colog-card")).toBeVisible();
    // The clinic login is a different page and must not be what rendered.
    await expect(page.locator(".mk-auth")).toHaveCount(0);
  });

  test("the plain /company path also lands on the staff door when signed out", async ({ page }) => {
    await installMocks(page);
    await page.goto("/company");

    await expect(page).toHaveURL(/#\/company\/login/, { timeout: 10000 });
    await expect(page.locator(".colog-card")).toBeVisible();
  });

  test("the staff door signs the owner straight into the console", async ({ page }) => {
    await installMocks(page);
    await staffLogin(page);

    await expect(page).toHaveURL(/#\/company$/, { timeout: 10000 });
    await expect(page.locator(".co-rail-brand")).toBeVisible();
    // Full-bleed: no clinician sidebar framing the vendor's console.
    await expect(page.locator(".sb-brand")).toHaveCount(0);
  });

  test("a valid clinic account is refused AND signed back out", async ({ page }) => {
    await installMocks(page, { email: "clinician@tenant-a.example", roles: ["clinician"] });
    await staffLogin(page, "clinician@tenant-a.example");

    const refused = page.locator(".colog-refused");
    await expect(refused).toBeVisible({ timeout: 10000 });
    await expect(refused).toContainText("clinician@tenant-a.example");

    // The session must be GONE, not merely un-navigated: a staff login that
    // leaves a live clinic token behind is a back door into the tenant app.
    await page.goto("/#/scribe");
    await expect(page).toHaveURL(/#\/login/, { timeout: 10000 });
  });

  test("signing out of the console returns to the staff door", async ({ page }) => {
    await installMocks(page);
    await staffLogin(page);
    await expect(page.locator(".co-rail-brand")).toBeVisible({ timeout: 10000 });

    await page.locator(".co-signout").click();
    await expect(page).toHaveURL(/#\/company\/login/, { timeout: 10000 });
    await expect(page.locator(".colog-card")).toBeVisible();
  });

  test("an already-signed-in owner skips the door", async ({ page }) => {
    await installMocks(page);
    await login(page);              // in through the clinic front desk
    await page.goto("/#/company/login");

    await expect(page).toHaveURL(/#\/company$/, { timeout: 10000 });
    await expect(page.locator(".co-rail-brand")).toBeVisible();
  });
});

// The Business tab shows figures Klarnote does not measure. That is only
// acceptable while every one of them is unmistakably marked, so the marking is
// tested as hard as the numbers.
test.describe("Business tab honesty", () => {
  test("every mocked figure is badged and the banner is loud", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "business");

    await expect(page.locator(".co-note-mock")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".co-note-mock")).toContainText(/Placeholder|заповнювач/i);

    // The legend names all three provenance kinds…
    await expect(page.locator(".prov-legend .prov-live")).toBeVisible();
    await expect(page.locator(".prov-legend .prov-derived")).toBeVisible();
    await expect(page.locator(".prov-legend .prov-mock")).toBeVisible();

    // …and mock badges outnumber a token few — this tab is mostly placeholder,
    // and if that ever stops being obvious the test should fail.
    expect(await page.locator(".prov-mock").count()).toBeGreaterThan(10);
  });

  test("the live half really is live — tenants come from the API", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "business");

    const tenantCard = page.locator(".stat-card").filter({ hasText: /Active tenants|Активні тенанти/ });
    await expect(tenantCard).toContainText("3", { timeout: 10000 });
    await expect(tenantCard.locator(".prov-live")).toBeVisible();
  });
});

test.describe("Management surfaces", () => {
  test("templates list splits system from tenant-owned and offers the right action", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "templates");

    const rows = page.locator(".co-table tbody tr");
    await expect(rows).toHaveCount(3, { timeout: 10000 });   // deprecated hidden by default

    // A system template can only be cloned; a tenant one can be deprecated.
    await expect(rows.filter({ hasText: "MRI Brain" })).toContainText(/Clone|Клонувати/);
    await expect(rows.filter({ hasText: "Discharge summary" })).toContainText(/Deprecate|Вивести/);
  });

  test("deprecated templates appear only when asked for", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "templates");
    await expect(page.locator(".co-table tbody tr")).toHaveCount(3, { timeout: 10000 });

    await page.locator(".co-check input[type='checkbox']").check();
    await expect(page.locator(".co-table tbody tr")).toHaveCount(4);
    await expect(page.locator(".co-table tbody")).toContainText("Legacy intake");
  });

  test("creating a template validates the code slug before allowing submit", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "templates");
    await page.locator(".co-toolbar .colog-btn.primary").click();

    const dialog = page.locator(".co-modal");
    await expect(dialog).toBeVisible();
    await dialog.locator(".colog-field input").first().fill("Trauma CT");

    // A code that is not a slug must be refused, inline, before any round-trip.
    await dialog.locator(".colog-field input").nth(1).fill("Trauma CT!");
    await expect(dialog.locator(".co-field-err")).toBeVisible();
    await expect(dialog.locator("button[type='submit']")).toBeDisabled();

    await dialog.locator(".colog-field input").nth(1).fill("trauma_ct");
    await expect(dialog.locator(".co-field-err")).toHaveCount(0);
    await expect(dialog.locator("button[type='submit']")).toBeEnabled();
  });

  test("tenant management is editable for the active tenant only", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "tenants");
    const rows = page.locator(".co-table tbody tr.co-row");
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    // Active tenant → a real profile form with a Save control.
    await rows.filter({ hasText: "Dev Hospital A" }).click();
    await page.locator(".co-detail-tabs button").nth(1).click();
    await expect(page.locator(".co-admin-block").first()).toBeVisible();
    await expect(page.locator(".co-addmember")).toBeVisible();

    // Non-active tenant → an explanation, and no write controls at all.
    await rows.filter({ hasText: "Dev Hospital A" }).click();   // collapse
    await rows.filter({ hasText: "Dev Hospital B" }).click();
    await page.locator(".co-detail-tabs button").nth(1).click();
    await expect(page.locator(".co-admin-locked")).toBeVisible();
    await expect(page.locator(".co-addmember")).toHaveCount(0);
  });
});

test.describe("Technical & Roadmap", () => {
  test("the technical inventory reports services and names its sources", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "technical");

    await expect(page.locator(".co-table tbody tr")).toHaveCount(9, { timeout: 10000 });
    await expect(page.locator(".co-posture")).toContainText("RLS");
    // Honest about what is NOT done, not just what is.
    await expect(page.locator(".co-posture li.s-off")).toHaveCount(1);
    await expect(page.locator(".co-posture li.s-off")).toContainText(/MFA/);
  });

  test("the roadmap leads with the highest-leverage item and keeps the gap register", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "roadmap");

    await expect(page.locator(".co-prio").first()).toHaveText("P0", { timeout: 10000 });
    await expect(page.locator(".co-gap").first()).toBeVisible();
    await expect(page.locator(".co-worklist")).toContainText("GET /tenants");
  });
});

// The console outgrew a tab strip; the rail is now the primary navigation, so
// its structure is worth pinning — a nav that silently loses a group is a
// section nobody can reach.
test.describe("Console navigation", () => {
  test("the rail groups every section under Company / Customers / Platform", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "overview");

    const groups = page.locator(".co-rail-group");
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0)).toContainText(/Company|Компанія/);
    await expect(groups.nth(1)).toContainText(/Customers|Клієнти/);
    await expect(groups.nth(2)).toContainText(/Platform|Платформа/);

    // Every section is reachable from the rail — no orphaned routes. Update
    // this number when a section is added; it failing on a new tab is the
    // point, not an inconvenience.
    await expect(page.locator(".co-rail-group button")).toHaveCount(14);
  });

  test("clicking a rail item navigates and marks itself current", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "overview");

    await page.locator(".co-rail-group button").filter({ hasText: /^(Безпека|Security)$/ }).click();
    await expect(page).toHaveURL(/#\/company\/security/);
    await expect(page.locator(".co-rail-group button.on")).toContainText(/Безпека|Security/);
  });
});

test.describe("Operations, errors and security", () => {
  test("security reads entirely from the audit trail, with nothing mocked", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "security");

    // The mock audit set contains one user.roles_changed at severity sec.
    await expect(page.locator(".co-kpis")).toContainText("1", { timeout: 10000 });
    await expect(page.locator(".co-watchlist li")).toHaveCount(8);
    // Not one placeholder on this page — that is the claim the banner makes.
    await expect(page.locator(".prov-mock")).toHaveCount(0);
  });

  test("a refresh replay raises an alarm rather than becoming a table row", async ({ page }) => {
    await installMocks(page, {
      auditEvents: [{
        seq: 99, kind: "auth.refresh_replay_detected", actor_sub: "0c000000-0000-0000-0000-00000000000a",
        actor_role: "clinician", target_kind: "user", severity: "sec",
        created_at: new Date().toISOString(),
      }],
    });
    await staffLoginTo(page, "security");

    await expect(page.locator(".co-alarm")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".co-alarm")).toContainText(/replay|повторне/i);
  });

  test("errors separates measured signals from placeholder reliability", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "errors");

    // All services ready under the mock → the reassuring state, not an alarm.
    await expect(page.locator(".co-note-ok")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".co-alarm")).toHaveCount(0);
    // …and the reliability half is explicitly flagged.
    await expect(page.locator(".co-note-mock")).toBeVisible();
    await expect(page.locator(".prov-live").first()).toBeVisible();
  });

  test("operations reports real feature flags from the build config", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "operations");

    const flags = page.locator(".co-flaglist li");
    await expect(flags.first()).toBeVisible({ timeout: 10000 });
    // Derived from FEATURES rather than a literal: the assertion is "the
    // console reports every flag the build has", and a magic number turns
    // that into "the console reports the flags it had in sprint 13" — which
    // fails on the next sprint that adds one, for no reason a reader can see.
    await expect(flags).toHaveCount(Object.keys(FEATURES).length);
    await expect(page.locator(".co-flaglist")).toContainText("notifications");
  });

  test("support is honest that the entire queue is invented", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "support");

    await expect(page.locator(".co-note-mock")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".co-note-mock")).toContainText(/no helpdesk|не має служби підтримки/i);
    // Every ticket KPI is badged mock; the real ASR signals beside them are live.
    expect(await page.locator(".prov-mock").count()).toBeGreaterThan(4);
    await expect(page.locator(".prov-live").first()).toBeVisible();
  });
});

test.describe("Infrastructure links", () => {
  test("every tool is listed with an openable link", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "infrastructure");

    const rows = page.locator(".co-infra").first().locator("li");
    await expect(rows).toHaveCount(9, { timeout: 10000 });

    // The tools an owner actually reaches for, each with a real href.
    for (const [name, url] of [
      ["Grafana", "http://localhost:3001"],
      ["Prometheus", "http://localhost:9090"],
      ["Jaeger", "http://localhost:16686"],
      ["Keycloak", "http://localhost:8088/admin/master/console/"],
      ["MinIO", "http://localhost:9001"],
      ["Mailpit", "http://localhost:8025"],
    ]) {
      // Match the heading, not the row text: the Loki row's note mentions
      // "Grafana", so a plain hasText filter picks up two rows.
      const row = rows.filter({ has: page.locator(`strong:text-is("${name}")`) });
      await expect(row).toHaveCount(1);
      await expect(row.locator("a")).toHaveAttribute("href", url);
      // Opening an admin console must not navigate the console away from itself.
      await expect(row.locator("a")).toHaveAttribute("target", "_blank");
    }
  });

  test("datastores are listed as connection strings, not broken links", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "infrastructure");

    const stores = page.locator(".co-infra-plain li");
    await expect(stores).toHaveCount(3, { timeout: 10000 });
    await expect(stores).toContainText(["PostgreSQL", "Redis", "Kafka"]);
    // No anchor: a link to a TCP service would be a link that cannot work.
    await expect(page.locator(".co-infra-plain a")).toHaveCount(0);
  });

  test("reachability is reported as 'answered', never as 'healthy'", async ({ page }) => {
    await installMocks(page);
    await staffLoginTo(page, "infrastructure");

    // The distinction the no-cors probe can actually support.
    // Case-insensitive: the badge is capitalised by CSS, so textContent is not.
    await expect(page.locator(".co-infra").first()).toContainText(/answered|відповів/i, { timeout: 10000 });
    await expect(page.locator(".co-infra").first()).not.toContainText(/healthy|справн/i);
  });
});
