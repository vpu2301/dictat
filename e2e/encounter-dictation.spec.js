// encounter-dictation.spec.js — FE sprint 11 step 04: Почати прийом →
// dictation studio with {patient, encounter} context; encounter validation
// (invalid / closed) recovery; retro-logging; report linkage (patient_id on
// the create payload); ad-hoc dictation regression; context-bar hygiene.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const DEAD_PID = "99999999-9999-4999-8999-999999999999";
const CLOSED_ENC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GHOST_ENC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: false,
};
const DEAD_PATIENT = { ...PATIENT, id: DEAD_PID, name: { uk: "Покійний Пацієнт", en: "Deceased Patient" }, status: "deceased" };

const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: {
    sections: [{ id: "anamnesis", name: "Anamnesis", order: 0, required: true, field_type: "text", voice_aliases: ["anamnesis"] }],
  },
};

async function installMocks(page, calls) {
  const ctl = { sessionOpen: false };
  // encounters the GET /encounters/{id} endpoint knows about
  const encounters = {
    [CLOSED_ENC]: { id: CLOSED_ENC, patient_id: PID, kind: "visit", reason: "завершений візит", occurred_at: "2026-07-15T10:00:00Z", status: "completed", created_at: "2026-07-15T10:00:00Z" },
  };
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

    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    // templates (report-service)
    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);

    // reports
    if (path === "/v1/reports" && method === "POST") {
      calls.reportCreate.push(req.postDataJSON());
      return json(201, { id: "report-1", code: "R-1", version_id: "v1", version_number: 1, status: "draft" });
    }
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT")
      return json(200, { id: "report-1", version_number: 2, status: "draft" });

    // patients + encounters (core)
    if (path === `/patients/${PID}` && method === "GET") return json(200, PATIENT);
    if (path === `/patients/${DEAD_PID}` && method === "GET") return json(200, DEAD_PATIENT);
    if (/^\/patients\/[0-9a-f-]{36}\/(timeline)$/.test(path)) return json(200, { items: [] });
    if (/^\/patients\/[0-9a-f-]{36}\/(encounters)$/.test(path) && method === "GET") return json(200, []);
    if (/^\/patients\/[0-9a-f-]{36}\/(consents)$/.test(path) && method === "GET") return json(200, []);
    if (/^\/patients\/[0-9a-f-]{36}\/(anamnesis)$/.test(path)) return json(200, { patient_id: PID, record: {}, updated_at: null });
    if (path === "/notes" && method === "GET") return json(200, { items: [] });
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT], next_cursor: null });

    if (/^\/patients\/[0-9a-f-]{36}\/encounters$/.test(path) && method === "POST") {
      const body = req.postDataJSON();
      calls.encounterCreate.push(body);
      const id = `dddddddd-dddd-4ddd-8ddd-${String(calls.encounterCreate.length).padStart(12, "0")}`;
      const enc = { id, patient_id: PID, kind: body.kind, reason: body.reason || "", occurred_at: new Date().toISOString(), status: body.status || "completed", created_at: new Date().toISOString() };
      encounters[id] = enc;
      return json(201, enc);
    }
    const encGet = path.match(/^\/encounters\/([0-9a-f-]{36})$/);
    if (encGet && method === "GET") {
      const enc = encounters[encGet[1]];
      if (!enc) return json(404, { type: "about:blank", title: "Not Found", status: 404, detail: "encounter not found" });
      return json(200, enc);
    }

    return json(200, { items: [] });
  });
  return ctl;
}

function newCalls() { return { encounterCreate: [], reportCreate: [] }; }

async function login(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
}

test("golden path: Почати прийом → in_progress encounter → studio with context bar", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await login(page);

  await page.goto(`/#/patients/${PID}`);
  await expect(page.locator(".ph-card")).toBeVisible();
  await page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом|Start encounter/ }).click();

  const sheet = page.locator(".modal");
  await sheet.locator("textarea").fill("плановий огляд");
  await sheet.getByRole("button", { name: /Почати диктування|Start dictating/ }).click();

  // encounter created live: explicit in_progress, datetime omitted (= now)
  expect(calls.encounterCreate[0]).toEqual({ kind: "visit", reason: "плановий огляд", status: "in_progress" });

  // studio route carries BOTH uuids and nothing else identifying
  await expect(page).toHaveURL(/#\/studio\?mode=dictate&patient=[0-9a-f-]{36}&encounter=[0-9a-f-]{36}(&|$)/);

  // context bar: name + year of birth + reason — never full DOB or MRN
  const bar = page.getByTestId("studio-context-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Іван Петренко");
  await expect(bar).toContainText("нар. 1984");
  await expect(bar).toContainText("плановий огляд");
  const barText = await bar.innerText();
  expect(barText).not.toContain("1984-03-12");
  expect(barText).not.toContain("MRN-001");

  // wrong-patient escape is one click pre-recording → roster
  await bar.getByRole("button", { name: /Неправильний пацієнт|Wrong patient/ }).click();
  await expect(page).toHaveURL(/#\/patients$/);
});

test("report create carries patient_id (timeline linkage), typing removes the escape", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await login(page);

  await page.goto(`/#/patients/${PID}`);
  await page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом|Start encounter/ }).click();
  await page.locator(".modal").getByRole("button", { name: /Почати диктування|Start dictating/ }).click();

  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type("Скарги на задишку при навантаженні.");

  // autosave (1200 ms debounce) creates the report AGAINST the patient
  await expect.poll(() => calls.reportCreate.length, { timeout: 8000 }).toBeGreaterThan(0);
  expect(calls.reportCreate[0].patient_id).toBe(PID);

  // once content exists the mis-selection escape is gone
  await expect(page.getByTestId("studio-context-bar")
    .getByRole("button", { name: /Неправильний пацієнт|Wrong patient/ })).toHaveCount(0);
});

test("encounter_closed: specific copy + 'створити новий прийом' swaps the context in place", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await login(page);

  await page.goto(`/#/studio?mode=dictate&patient=${PID}&encounter=${CLOSED_ENC}`);
  await expect(page.getByText(/Прийом уже завершено|This encounter is closed/)).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: /Створити новий прийом|Start a new encounter/ }).click();
  // the fresh encounter inherits kind/reason and is created in_progress
  await expect.poll(() => calls.encounterCreate.length).toBe(1);
  expect(calls.encounterCreate[0]).toEqual({ kind: "visit", reason: "завершений візит", status: "in_progress" });

  // context swapped: URL now carries the new encounter, editor renders
  // (`&t=…` may follow: the Studio carries the open-tab id in the URL.)
  await expect(page).toHaveURL(/encounter=dddddddd-dddd-4ddd-8ddd-000000000001(&|$)/);
  await expect(page.getByTestId("studio-context-bar")).toContainText("завершений візит");
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
});

test("encounter_invalid: not-found copy + return to the patient", async ({ page }) => {
  await installMocks(page, newCalls());
  await login(page);

  await page.goto(`/#/studio?mode=dictate&patient=${PID}&encounter=${GHOST_ENC}`);
  await expect(page.getByText(/Прийом не знайдено|Encounter not found/)).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /Повернутися до пацієнта|Back to the patient/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/patients/${PID}$`));
});

test("retro-logging: completed + chosen datetime, never routes to the studio", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await login(page);

  await page.goto(`/#/patients/${PID}`);
  await page.locator(".tabs .tab", { hasText: /Прийоми|Encounters/ }).click();
  await page.getByRole("button", { name: /Додати без диктування|Log without dictation/ }).click();

  const modal = page.locator(".modal");
  await modal.locator('input[type="datetime-local"]').fill("2026-07-10T09:30");
  await modal.locator("textarea").fill("паперовий візит");
  await modal.getByRole("button", { name: /Зберегти|Save/ }).click();

  await expect.poll(() => calls.encounterCreate.length).toBe(1);
  expect(calls.encounterCreate[0]).toEqual({
    kind: "visit", datetime: "2026-07-10T09:30", reason: "паперовий візит", status: "completed",
  });
  await expect(page).toHaveURL(new RegExp(`#/patients/${PID}$`)); // stayed put
});

test("ad-hoc dictation without a patient is unchanged (gate, no context bar)", async ({ page }) => {
  await installMocks(page, newCalls());
  await login(page);

  await page.goto("/#/studio?mode=dictate");
  await expect(page.locator("[data-testid='patient-gate-row']").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("studio-context-bar")).toHaveCount(0);
});

test("deceased patient: Почати прийом disabled with explanation", async ({ page }) => {
  await installMocks(page, newCalls());
  await login(page);

  await page.goto(`/#/patients/${DEAD_PID}`);
  const btn = page.locator(".ph-actions .btn.accent", { hasText: /Почати прийом|Start encounter/ });
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("title", /помер|deceased/i);
});
