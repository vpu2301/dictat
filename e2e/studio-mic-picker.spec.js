// studio-mic-picker.spec.js — choosing a system microphone in the Studio.
//
// Scenario under test is the real one: an iPhone paired as a macOS Continuity
// Microphone. `navigator.mediaDevices` is stubbed so the device list is
// deterministic (a headless browser has no mics), but everything above it —
// enumeration, the picker, the OS-default warning, the deviceId actually
// pinned on getUserMedia, and persistence across reloads — is the real SPA.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

const TEMPLATE_SUMMARY = {
  id: TEMPLATE_ID, code: "MRI-BRAIN", name: "MRI Brain", specialty: "radiology",
  is_system: true, status: "active", language: "en", schema_version: 1,
};
const TEMPLATE_DETAIL = {
  ...TEMPLATE_SUMMARY,
  schema_jsonb: {
    sections: [
      { id: "findings", name: "Findings", order: 0, required: true, field_type: "text", voice_aliases: ["findings"] },
    ],
  },
};
const PATIENT = {
  id: PATIENT_ID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1980-01-01",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

async function installMocks(page) {
  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8005", "8006", "8007", "8008"].includes(url.port);
  let sessionOpen = false;

  await page.route(isApi, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/auth/login") && method === "POST") {
      sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST")
      return sessionOpen ? json(200, { access_token: "tok" }) : json(401, { title: "refresh_failed" });
    if (path.endsWith("/auth/me")) {
      if (!sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });
    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_SUMMARY] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT] });
    if (path === `/patients/${PATIENT_ID}` && method === "GET") return json(200, PATIENT);
    // The consent gate fails closed — grant AI-scribe consent so the mic can start.
    if (/^\/patients\/[^/]+\/consents$/.test(path) && method === "GET")
      return json(200, [{ id: "c1", patient_id: PATIENT_ID, type: "ai_scribe", status: "granted", method: "verbal", encounter_id: null }]);
    if (path === "/v1/reports" && method === "POST")
      return json(201, { id: "report-1", version_number: 1, patient_id: PATIENT_ID, status: "draft" });
    return json(200, { items: [] });
  });
}

// A Chrome/macOS device list where the OS default input IS the iPhone.
// Chrome's "default" alias carries the groupId of whatever it points at.
const MACOS_WITH_IPHONE = [
  { deviceId: "default", kind: "audioinput", label: "Default - iPhone Microphone", groupId: "g-phone" },
  { deviceId: "aaa", kind: "audioinput", label: "MacBook Pro Microphone", groupId: "g-built-in" },
  { deviceId: "bbb", kind: "audioinput", label: "iPhone Microphone", groupId: "g-phone" },
  { deviceId: "out", kind: "audiooutput", label: "MacBook Pro Speakers", groupId: "g-out" },
];

// Stub the media layer + a Web Speech recogniser (headless Chromium has
// neither) and record the constraints every getUserMedia call receives.
async function installFakeMedia(page, devices = MACOS_WITH_IPHONE) {
  await page.addInitScript((devs) => {
    window.__gumCalls = [];
    const md = navigator.mediaDevices || (navigator.mediaDevices = new EventTarget());
    Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true });
    md.enumerateDevices = async () => devs.map((d) => ({ ...d, toJSON: () => d }));
    md.getUserMedia = async (constraints) => {
      window.__gumCalls.push(constraints);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx.createMediaStreamDestination().stream;
    };
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      window.webkitSpeechRecognition = class {
        start() { this.onstart?.(); }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      };
    }
  }, devices);
}

async function loginAndOpenStudio(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto("/#/studio?mode=dictate");
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await expect(gateRow).toBeVisible({ timeout: 10000 });
  await gateRow.click();
  await expect(page.locator(".mic-device")).toBeVisible({ timeout: 10000 });
}

const picker = (page) => page.locator(".mic-device .menu-select-trigger");
const openPicker = async (page) => { await picker(page).click(); };

test.describe("Studio microphone picker", () => {
  test.beforeEach(async ({ page }) => {
    await installFakeMedia(page);
    await installMocks(page);
  });

  test("lists every system input and remembers the choice", async ({ page }) => {
    await loginAndOpenStudio(page);

    await openPicker(page);
    const options = page.locator(".mic-device .spec-menu-item");
    await expect(options).toHaveCount(3); // System default + 2 mics
    await expect(options.nth(1)).toContainText("MacBook Pro Microphone");
    await expect(options.nth(2)).toContainText("iPhone Microphone");

    await options.nth(2).click();
    await expect(picker(page)).toContainText("iPhone Microphone");

    // Survives a reload — the choice is persisted, not per-session state.
    await page.reload();
    const gateRow = page.locator("[data-testid='patient-gate-row']").first();
    if (await gateRow.isVisible().catch(() => false)) await gateRow.click();
    await expect(picker(page)).toContainText("iPhone Microphone", { timeout: 10000 });
  });

  test("warns when the chosen mic is not the OS default input", async ({ page }) => {
    await loginAndOpenStudio(page);
    const warn = page.locator(".mic-device-note.warn");

    // OS default here IS the iPhone → picking it is silent.
    await openPicker(page);
    await page.locator(".mic-device .spec-menu-item").nth(2).click();
    await expect(warn).toHaveCount(0);

    // Picking the built-in mic instead diverges from the OS default, which is
    // the only thing Web Speech will listen to — say so.
    await openPicker(page);
    await page.locator(".mic-device .spec-menu-item").nth(1).click();
    await expect(warn).toBeVisible();
    await expect(warn).toContainText("iPhone Microphone");        // what the OS default is
    await expect(warn).toContainText("MacBook Pro Microphone");   // what was picked
    await expect(warn).toContainText("Звук → Вхід");              // how to fix it (UI defaults to uk)
  });

  test("dictation captures from the chosen device", async ({ page }) => {
    await loginAndOpenStudio(page);

    await openPicker(page);
    await page.locator(".mic-device .spec-menu-item").nth(2).click(); // iPhone → "bbb"

    await page.getByTestId("studio-mic").click();
    await expect.poll(async () => (await page.evaluate(() => window.__gumCalls)).length).toBeGreaterThan(0);

    const calls = await page.evaluate(() => window.__gumCalls);
    const last = calls[calls.length - 1];
    expect(last.audio.deviceId).toEqual({ exact: "bbb" });
    expect(last.audio.channelCount).toBe(1);
  });

  test("falls back to the OS default when the chosen mic has gone away", async ({ page }) => {
    // Pick the iPhone, then take it away (phone locked / out of range).
    await loginAndOpenStudio(page);
    await openPicker(page);
    await page.locator(".mic-device .spec-menu-item").nth(2).click();

    await page.evaluate(() => {
      navigator.mediaDevices.enumerateDevices = async () => ([
        { deviceId: "default", kind: "audioinput", label: "Default - MacBook Pro Microphone", groupId: "g-built-in" },
        { deviceId: "aaa", kind: "audioinput", label: "MacBook Pro Microphone", groupId: "g-built-in" },
      ]);
      // getUserMedia now rejects the pinned id, exactly as Chrome would.
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        if (c?.audio?.deviceId?.exact === "bbb") {
          window.__gumCalls.push(c);
          const err = new Error("device not found");
          err.name = "OverconstrainedError";
          throw err;
        }
        return real(c);
      };
      navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    });

    await expect(page.locator(".mic-device-note.warn")).toContainText("iPhone Microphone");

    // Dictation still starts — on the system mic rather than failing outright.
    await page.getByTestId("studio-mic").click();
    await expect.poll(async () => {
      const calls = await page.evaluate(() => window.__gumCalls);
      return calls.some((c) => !c?.audio?.deviceId);
    }).toBe(true);
  });
});
