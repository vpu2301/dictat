// patients-directory.spec.js — FE sprint 11 step 02: roster search
// (debounce + stale-cancel), the separate ІПН field, cursor pagination,
// create 409 → existing-record flow, edit/archive, and the sprint's
// PII-hygiene rules as explicit assertions.
//
// Hermetic: all backend calls are route-mocked with the REAL wire shapes
// (PatientOut incl. has_ipn, {items,next_cursor} pages, RFC 9457 problems).
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const EXISTING_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const mk = (n, over = {}) => ({
  id: `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`,
  name: { uk: `Пацієнт Номер${n}`, en: `Patient Number${n}` },
  dob: "1984-03-12", sex: "F", mrn: `MRN-00${n}`,
  // Contact details (migration 0060) — the server default for a patient
  // registered without them: "" per field, and an address object whose five
  // components are all blank (never null, never a string).
  phone: "", email: "",
  address: { street: "", house: "", zip: "", city: "", country: "" },
  summary: { uk: "", en: "" }, tags: n === 1 ? ["діабет", "гіпертонія", "астма"] : [],
  status: "active", last_visit: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  has_ipn: false, ...over,
});

const P1 = mk(1);
const P2 = mk(2, {
  name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1980-06-15", sex: "M",
  phone: "+380441234567", email: "ivan@example.com",
  address: {
    street: "вул. Шевченка", house: "12, кв. 7",
    zip: "01001", city: "Київ", country: "Україна",
  },
});
const P3 = mk(3, { has_ipn: true }); // the ІПН-holder: query "1759013776" finds exactly this one
const P4 = mk(4, { status: "inactive", dob: null });
const P5 = mk(5);
const EXISTING = mk(6, { id: EXISTING_ID, name: { uk: "Наявний Пацієнт", en: "Existing Patient" }, has_ipn: true });

const PAGE1 = [P1, P2, P3];
const PAGE2 = [P4, P5];

// 60 hits in one server page — enough to exercise the numbered pager
// (25/25/10) and the per-page selector without any cursor involvement.
const BULK_QUERY = "Багато";
const BULK = Array.from({ length: 60 }, (_, i) => ({
  ...mk(1),
  id: `bbbbbbbb-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name: { uk: `Багато Пацієнт ${String(i + 1).padStart(2, "0")}`, en: `Bulk Patient ${i + 1}` },
  mrn: `MRN-B${String(i + 1).padStart(3, "0")}`,
  tags: [],
}));

const SLOW_QUERY = "Перший";
const FAST_QUERY = "Другий";
const VALID_IPN = "1759013776";
const DUP_IPN = "2874309631"; // valid checksum; POST answers 409 patient_ipn_exists

async function installMocks(page, calls) {
  const ctl = { sessionOpen: false, statusOverride: {} };
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
    const withStatus = (p) => (ctl.statusOverride[p.id] ? { ...p, status: ctl.statusOverride[p.id] } : p);

    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    // ── core-service: roster ──
    if (path === "/patients" && method === "GET") {
      const query = url.searchParams.get("query");
      const cursor = url.searchParams.get("cursor");
      calls.list.push({ query, cursor });
      if (query === SLOW_QUERY) {
        await new Promise((r) => setTimeout(r, 600));
        // the client aborts this one (stale) — fulfilling then may throw
        try { return await json(200, { items: [P1], next_cursor: null }); } catch { return; }
      }
      if (query === FAST_QUERY) return json(200, { items: [P2], next_cursor: null });
      if (query === VALID_IPN) return json(200, { items: [P3], next_cursor: null });
      if (query === BULK_QUERY) return json(200, { items: BULK, next_cursor: null });
      if (query) {
        const hit = PAGE1.concat(PAGE2).filter((p) => p.name.uk.includes(query));
        return json(200, { items: hit.map(withStatus), next_cursor: null });
      }
      if (cursor === "c2") return json(200, { items: PAGE2.map(withStatus), next_cursor: null });
      return json(200, { items: PAGE1.map(withStatus), next_cursor: "c2" });
    }
    if (path === "/patients" && method === "POST") {
      const body = req.postDataJSON();
      calls.create.push(body);
      if (body.ipn === DUP_IPN) {
        return json(409, {
          type: "about:blank", title: "Conflict", status: 409,
          detail: "a patient with this ІПН already exists in this tenant",
          instance: "urn:uuid:00000000-0000-4000-8000-000000000409",
          code: "patient_ipn_exists", existing_patient_id: EXISTING_ID,
        });
      }
      return json(201, mk(9, { name: body.name, has_ipn: !!body.ipn }));
    }
    const putMatch = path.match(/^\/patients\/([0-9a-f-]{36})$/);
    if (putMatch && method === "PUT") {
      const body = req.postDataJSON();
      calls.update.push({ id: putMatch[1], body });
      if (body.status) ctl.statusOverride[putMatch[1]] = body.status;
      const base = PAGE1.concat(PAGE2, [EXISTING]).find((p) => p.id === putMatch[1]) || P1;
      return json(200, { ...base, ...body, name: body.name || base.name });
    }
    if (putMatch && method === "GET") {
      const base = PAGE1.concat(PAGE2, [EXISTING]).find((p) => p.id === putMatch[1]);
      return json(base ? 200 : 404, base ? withStatus(base) : { title: "Not Found", status: 404 });
    }

    // ── patient-page satellites (visited during navigation checks) ──
    if (/\/patients\/[0-9a-f-]{36}\/timeline$/.test(path)) return json(200, { items: [] });
    if (/\/patients\/[0-9a-f-]{36}\/encounters$/.test(path)) return json(200, []);
    if (/\/patients\/[0-9a-f-]{36}\/consents$/.test(path)) return json(200, []);
    if (/\/patients\/[0-9a-f-]{36}\/anamnesis$/.test(path)) return json(200, { patient_id: putMatch?.[1], record: {}, updated_at: null });
    if (path === "/notes" && method === "GET") return json(200, { items: [] });

    return json(200, { items: [] });
  });
  return ctl;
}

function newCalls() { return { list: [], create: [], update: [] }; }

async function openRoster(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto("/#/patients"); // the sprint-11 canonical alias
  await expect(page.locator(".ptable-row").first()).toBeVisible({ timeout: 10000 });
}

// Requests that carry a search string (page top-ups fetch cursor pages in the
// background — those carry `cursor`, never `query`).
const queries = (calls) => calls.list.filter((c) => c.query).map((c) => c.query);

test("search debounces to one request, min length 2, '/' focuses the box", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);
  await expect(page.locator(".ptable-row")).toHaveCount(5); // both pages auto-loaded

  // one char → below minLength → no request, previous results stay
  const box = page.locator(".pdir-toolbar .search-input input").first();
  await box.fill("І");
  await page.waitForTimeout(450);
  expect(queries(calls).length).toBe(0);
  await expect(page.locator(".ptable-row")).toHaveCount(5);

  // fast typing coalesces into exactly ONE request for the final text
  await box.pressSequentially("ва", { delay: 60 }); // "І" + "ва" → "Іва"
  await page.waitForTimeout(500);
  expect(queries(calls)).toEqual(["Іва"]);
  await expect(page.locator(".ptable-row")).toHaveCount(1);
  await expect(page.locator(".pname").first()).toContainText("Іван Петренко");

  // "/" focuses search when not typing elsewhere
  await page.locator("h1").click();
  await page.keyboard.press("/");
  await expect(box).toBeFocused();
});

test("stale responses never paint: a slow earlier search loses to a fast later one", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  const box = page.locator(".pdir-toolbar .search-input input").first();
  await box.fill(SLOW_QUERY);          // answers in 600 ms with Пацієнт Номер1
  await page.waitForTimeout(300);      // debounce fired, request in flight
  await box.fill(FAST_QUERY);          // answers immediately with Іван Петренко
  await page.waitForTimeout(900);      // let the slow response arrive late

  await expect(page.locator(".ptable-row")).toHaveCount(1);
  await expect(page.locator(".pname").first()).toContainText("Іван Петренко");
});

test("ІПН field: separators normalize, fires only on 10 valid digits, checksum typo errors inline", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  const ipnBox = page.locator(".pdir-ipn-search input");

  // checksum typo: inline error, NO request ever fires
  await ipnBox.fill("1759013775");
  await page.waitForTimeout(450);
  await expect(page.locator(".pdir-ipn-search .pdir-ipn-hint.err")).toBeVisible();
  expect(queries(calls).length).toBe(0);

  // pasted with spaces → normalized exact query, exactly one result
  await ipnBox.fill("175 901 37 76");
  await page.waitForTimeout(500);
  expect(queries(calls)).toEqual([VALID_IPN]);
  await expect(page.locator(".ptable-row")).toHaveCount(1);
  await expect(page.locator(".pdir-ipn-chip").first()).toBeVisible(); // has_ipn renders as a chip
});

test("PII hygiene: nothing patient-derived in URL or storage; lists show year of birth, never full DOB", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  const storageSnapshot = () =>
    page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  const before = await storageSnapshot();

  // search by name and by ІПН, then open a record
  await page.locator(".pdir-toolbar .search-input input").first().fill("Іван");
  await page.waitForTimeout(400);
  expect(page.url()).not.toContain("Іван");
  expect(decodeURIComponent(page.url())).not.toContain("Іван");

  await page.locator(".pdir-ipn-search input").fill(VALID_IPN);
  await page.waitForTimeout(400);
  expect(page.url()).not.toContain(VALID_IPN);

  // roster rows: year of birth only — the full ISO DOB never renders
  const bodyText = await page.locator(".ptable").innerText();
  expect(bodyText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(bodyText).toContain("нар. 1984");

  // navigation carries the opaque UUID only
  await page.locator(".ptable-row").first().click();
  await expect(page).toHaveURL(/#\/scribe\/patients\/[0-9a-f-]{36}$/);

  // storage untouched by the whole flow
  const after = await storageSnapshot();
  expect(after).toBe(before);
  for (const leak of ["Іван", "Петренко", VALID_IPN, "MRN-00", "1984"]) {
    expect(after).not.toContain(leak);
  }
});

test("pagination: the cursor page appends automatically without duplicates", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  // page 1 of the pager is 25 rows wide but the server cursor page holds 3, so
  // the roster tops itself up from cursor c2 rather than showing a short page
  // under a live Next button
  await expect(page.locator(".ptable-row")).toHaveCount(5);

  const cursored = calls.list.find((c) => c.cursor === "c2");
  expect(cursored).toBeTruthy();

  const ids = await page.locator(".ptable-row .pname").allInnerTexts();
  expect(new Set(ids).size).toBe(ids.length); // no dup rows

  // archived patient from page 2 renders dimmed with a badge, and the status
  // filter cuts the roster down to each status in turn
  await expect(page.locator(".ptable-row.pdir-dimmed")).toHaveCount(1);
  await expect(page.locator(".pdir-badge.inactive")).toBeVisible();

  const statusFilter = page.locator(".pdir-status-filter");
  await statusFilter.locator(".menu-select-trigger").click();
  await statusFilter.locator(".spec-menu-item", { hasText: "Активні" }).click();
  await expect(page.locator(".ptable-row")).toHaveCount(4);
  await expect(page.locator(".ptable-row.pdir-dimmed")).toHaveCount(0);

  await statusFilter.locator(".menu-select-trigger").click();
  await statusFilter.locator(".spec-menu-item", { hasText: "Архівні" }).click();
  await expect(page.locator(".ptable-row")).toHaveCount(1);
  await expect(page.locator(".pdir-badge.inactive")).toBeVisible();

  // no deceased rows in the fixture → the filter-specific empty state
  await statusFilter.locator(".menu-select-trigger").click();
  await statusFilter.locator(".spec-menu-item", { hasText: "Померлі" }).click();
  await expect(page.locator(".ptable-row")).toHaveCount(0);
  await expect(page.getByText("Померлих пацієнтів немає")).toBeVisible();
});

test("sort: the order dropdown re-orders the loaded roster", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  await expect(page.locator(".ptable-row")).toHaveCount(5);
  // .pname carries the status badge too ("архів") — strip it off the name
  const names = async () =>
    (await page.locator(".ptable-row .pname").allInnerTexts())
      .map((s) => s.replace(/\s*(архів|помер\(ла\))\s*$/i, "").trim());

  const sortMenu = page.locator(".pdir-sort");
  await sortMenu.locator(".menu-select-trigger").click();
  await sortMenu.locator(".spec-menu-item", { hasText: "Ім'я А→Я" }).click();
  const asc = await names();
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, "uk")));

  await sortMenu.locator(".menu-select-trigger").click();
  await sortMenu.locator(".spec-menu-item", { hasText: "Ім'я Я→А" }).click();
  expect(await names()).toEqual([...asc].reverse());
});

test("pagination: numbered pager slices the roster, per-page resizes it", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  await page.locator(".pdir-toolbar .search-input input").first().fill(BULK_QUERY);
  await expect(page.locator(".ptable-row")).toHaveCount(25); // 60 hits → page 1 of 3

  const pager = page.locator(".pager");
  await expect(pager.locator(".pager-num").last()).toHaveText("3");
  await expect(pager.locator(".pager-num.on")).toHaveText("1");
  await expect(pager.locator(".pager-range")).toContainText("1–25");
  await expect(page.locator(".ptable-row .pname").first()).toContainText("Пацієнт 01");

  // Next walks forward; the tail page is the remainder, not a padded 25
  await pager.getByRole("button", { name: /Далі|Next/ }).click();
  await expect(page.locator(".ptable-row .pname").first()).toContainText("Пацієнт 26");
  await pager.getByRole("button", { name: /Далі|Next/ }).click();
  await expect(page.locator(".ptable-row")).toHaveCount(10);
  await expect(pager.getByRole("button", { name: /Далі|Next/ })).toBeDisabled();

  // a page number jumps directly; Prev is live again
  await pager.locator(".pager-num", { hasText: /^1$/ }).click();
  await expect(page.locator(".ptable-row .pname").first()).toContainText("Пацієнт 01");
  await expect(pager.getByRole("button", { name: /Назад|Prev/ })).toBeDisabled();

  // per-page resize re-slices and returns to page 1 — all client-side, the
  // roster is never refetched for a page change
  // (the per-page picker is the platform MenuSelect, not a native <select>)
  const listCallsBefore = calls.list.length;
  await pager.locator(".pager-size .menu-select-trigger").click();
  await pager.locator(".pager-size .spec-menu button", { hasText: /^50$/ }).click();
  await expect(page.locator(".ptable-row")).toHaveCount(50);
  await expect(pager.locator(".pager-num").last()).toHaveText("2");
  await expect(pager.locator(".pager-num.on")).toHaveText("1");
  expect(calls.list.length).toBe(listCallsBefore);
});

test("create: duplicate ІПН 409 lands on the existing record in one click", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  await page.getByRole("button", { name: /Новий пацієнт|Add patient/ }).click();
  const modal = page.locator(".modal");
  await modal.locator("input").first().fill("Тест Дублікат");
  await modal.locator('input[inputmode="numeric"]').fill(DUP_IPN);
  await expect(modal.locator(".pdir-ipn-hint.ok")).toBeVisible(); // local checksum passed
  await modal.getByRole("button", { name: /Додати пацієнта|Add patient/ }).click();

  await expect(modal.locator(".pdir-conflict")).toBeVisible();
  expect(calls.create[0].ipn).toBe(DUP_IPN);
  await modal.getByRole("button", { name: /Відкрити наявну|Open the existing/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/scribe/patients/${EXISTING_ID}$`));
});

// Contact details: captured on registration, shown on the record card. The
// roster list stays name + year of birth — see the PII-hygiene test above.
test("create: telephone / e-mail / address reach the wire; a typo in either blocks the save", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  await page.getByRole("button", { name: /Новий пацієнт|Add patient/ }).click();
  const modal = page.locator(".modal");
  await modal.locator("input").first().fill("Тест Контакти");

  const phone = modal.locator('input[type="tel"]');
  const email = modal.locator('input[type="email"]');
  const save = modal.getByRole("button", { name: /Додати пацієнта|Add patient/ });

  // Address components, each its own field — nothing here is parsed out of a
  // free-text line.
  await modal.getByPlaceholder(/вул\. Шевченка|Shevchenka St/).fill("вул. Шевченка");
  await modal.getByPlaceholder(/12, кв\. 5|12, apt\. 5/).fill("12, кв. 7");
  await modal.getByPlaceholder("01001").fill("01001");
  await modal.getByPlaceholder(/^(Київ|Kyiv)$/).fill("Київ");
  await modal.getByPlaceholder(/Україна|Ukraine/).fill("Україна");

  // A number the server would 422 (code=phone_invalid) is caught here instead.
  await phone.fill("+380 44 ABC");
  await expect(save).toBeDisabled();
  await expect(modal.locator(".pdir-ipn-hint.err")).toBeVisible();
  await phone.fill("+380 44 123 45 67");
  await expect(modal.locator(".pdir-ipn-hint.err")).toHaveCount(0);

  // Same for a malformed e-mail (code=email_invalid).
  await email.fill("ivan@example");
  await expect(save).toBeDisabled();
  await expect(modal.locator(".pdir-ipn-hint.err")).toBeVisible();

  await email.fill("  Ivan@Example.COM ");
  await expect(save).toBeEnabled();
  await save.click();

  await expect(modal).toHaveCount(0);
  expect(calls.create).toHaveLength(1);
  // Normalized client-side, exactly as the server stores it — one number must
  // not become two records because of spacing.
  expect(calls.create[0].phone).toBe("+380441234567");
  expect(calls.create[0].email).toBe("ivan@example.com");   // trimmed + lower-cased
  expect(calls.create[0].address).toEqual({
    street: "вул. Шевченка", house: "12, кв. 7",
    zip: "01001", city: "Київ", country: "Україна",
  });
});

test("patient card: contact details render and are reachable; emptying a field clears it", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  // P1 has nothing on file → the card offers to add rather than showing a
  // blank row; P2 carries all three.
  await page.goto(`/#/scribe/patients/${P1.id}`);
  await expect(page.locator(".ph-contact-empty")).toBeVisible();
  await expect(page.locator(".ph-contact-item")).toHaveCount(0);

  await page.goto(`/#/scribe/patients/${P2.id}`);
  const contact = page.locator(".ph-contact");
  await expect(contact).toContainText("+380441234567");
  await expect(contact).toContainText("ivan@example.com");
  // The components render as one line, in postal order.
  await expect(contact).toContainText("вул. Шевченка, 12, кв. 7, 01001 Київ, Україна");
  await expect(contact.locator('a[href="tel:+380441234567"]')).toBeVisible();
  await expect(contact.locator('a[href="mailto:ivan@example.com"]')).toBeVisible();

  // Emptying a field is how a detail is removed: "" on the wire = clear. The
  // address components load back into their own inputs, not one line.
  await page.getByRole("button", { name: /Редагувати|Edit/ }).first().click();
  const modal = page.locator(".modal");
  await expect(modal.locator('input[type="tel"]')).toHaveValue("+380441234567");
  await expect(modal.getByPlaceholder(/вул\. Шевченка|Shevchenka St/)).toHaveValue("вул. Шевченка");
  await expect(modal.getByPlaceholder("01001")).toHaveValue("01001");
  await modal.locator('input[type="tel"]').fill("");
  await modal.getByPlaceholder(/12, кв\. 5|12, apt\. 5/).fill("");
  await modal.getByRole("button", { name: /Зберегти|Save/ }).click();

  await expect(modal).toHaveCount(0);
  expect(calls.update[0].body.phone).toBe("");
  expect(calls.update[0].body.email).toBe("ivan@example.com");   // untouched, still sent
  // A blanked component clears just that column; the rest survive.
  expect(calls.update[0].body.address).toEqual({
    street: "вул. Шевченка", house: "",
    zip: "01001", city: "Київ", country: "Україна",
  });
});

test("edit: archive via status, deceased needs confirmation, erased never offered", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openRoster(page);

  await page.locator(".ptable-row").first().hover();
  await page.locator(".pdir-row-actions .icon-btn").first().click();
  const modal = page.locator(".modal");
  await expect(modal).toBeVisible();

  // status options: active / inactive / deceased — and no erased anywhere
  const statusButtons = modal.locator(".pdir-status-toggle button");
  await expect(statusButtons).toHaveCount(3);
  await expect(modal.locator(".pdir-status-toggle")).not.toContainText(/erased|видален/i);

  // deceased requires the explicit confirmation checkbox
  await statusButtons.nth(2).click();
  const save = modal.getByRole("button", { name: /Зберегти|Save/ });
  await expect(save).toBeDisabled();
  await modal.locator(".pdir-deceased-confirm input").check();
  await expect(save).toBeEnabled();

  // archive instead: PUT carries status=inactive, roster reloads with the badge
  await statusButtons.nth(1).click();
  await save.click();
  await expect(modal).toHaveCount(0);
  expect(calls.update[0].body.status).toBe("inactive");
  await expect(page.locator(".pdir-badge.inactive").first()).toBeVisible();
});
