// report-replay.spec.js — FE sprint 15: tap-to-hear replay in report review.
//
// What must be true: any reviewed sentence is ONE tap from its source audio,
// the speaker is named when the recording knows it, the player never starts on
// its own, and when the audio is gone the screen says so — in the words the
// backend's own 410 taxonomy uses, not a generic apology.
import { test, expect } from "@playwright/test";
import { installBaseMocks, login, newCalls, REPORT_ID, TEMPLATE_ID } from "./helpers/s15Mocks.js";

const SECTION = "anamnesis";
const S1 = "Скарги на біль у грудях протягом трьох днів.";
const S2 = "Біль посилюється при навантаженні.";

const REPORT = {
  id: REPORT_ID,
  code: "GEN-001",
  status: "signed",
  title: { uk: "Загальний огляд", en: "General note" },
  patient_name_redacted: "І. П.",
  encounter_date: "2026-07-01",
  created_at: "2026-07-01T09:00:00Z",
  updated_at: "2026-07-01T09:30:00Z",
  signed_at: "2026-07-01T10:00:00Z",
  current_version_number: 1,
  content: { template_id: TEMPLATE_ID, sections: [{ section_key: SECTION, text: `${S1} ${S2}` }] },
  section_labels: [{ section_key: SECTION, name: { uk: "Анамнез", en: "Anamnesis" } }],
};

// Two sentences, two segments ⇒ the exact 1:1 conversation mapping.
const CONVERSATION_SEGMENTS = [
  { segment_id: "aaaaaaaa-0000-0000-0000-000000000001", index: 0, start_ms: 2000, end_ms: 4500, speaker: "SPEAKER_01", speaker_role: "patient" },
  { segment_id: "aaaaaaaa-0000-0000-0000-000000000002", index: 1, start_ms: 4600, end_ms: 7000, speaker: "SPEAKER_00", speaker_role: "doctor" },
];

// A tiny valid Ogg header is enough: the test asserts the element exists and
// is not autoplaying, never that Chromium decodes a real Opus stream.
const OGG_BYTES = Buffer.from("T2dnUwACAAAAAAAAAAA=", "base64");

async function installReport(page, calls, { segments = CONVERSATION_SEGMENTS, clip = { status: 200 } } = {}) {
  await page.route(`**/v1/reports/${REPORT_ID}/sections/*/audio-clips*`, async (route) => {
    calls.segments.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(segments) });
  });
  await page.route("**/v1/audio-clips", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    calls.clips.push(body);
    if (clip.status !== 200) {
      return route.fulfill({
        status: clip.status,
        contentType: "application/json",
        body: JSON.stringify(clip.body || {}),
        headers: clip.headers || {},
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clip_id: "cccccccc-0000-0000-0000-00000000000c",
        clip_url: "/v1/audio-clips/cccccccc-0000-0000-0000-00000000000c?t=tok",
        expires_at_unix: 4102444800,
      }),
    });
  });
  await page.route("**/v1/audio-clips/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, contentType: "audio/ogg", body: OGG_BYTES });
  });
  await page.route(`**/v1/reports/${REPORT_ID}/versions*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  // Trailing * so the ?include_content=true the envelope GET always sends is
  // matched too.
  await page.route(`**/v1/reports/${REPORT_ID}?*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REPORT) }));
}

async function openReport(page) {
  await login(page);
  await page.goto(`/#/dictate/reports/${REPORT_ID}`);
  await expect(page.locator(`[data-testid='replay-section-${SECTION}']`)).toBeVisible({ timeout: 15000 });
}

test("a reviewed sentence is one tap from its recording, with the speaker named", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls);
  await openReport(page);

  // The report still reads as a report: the text is intact.
  const section = page.locator(`[data-testid='replay-section-${SECTION}']`);
  await expect(section).toContainText(S1);
  await expect(section).toContainText(S2);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  const player = page.locator("[data-testid='replay-player']");
  await expect(player).toBeVisible();

  // The conversation fixture maps 1:1, so the clip is the patient's own turn.
  await expect(page.locator("[data-testid='replay-speaker']")).toHaveText(/Пацієнт|Patient/);
  await expect(page.locator("[data-testid='replay-approx']")).toHaveCount(0);
  await expect(page.locator("[data-testid='replay-audio']")).toBeVisible();

  // …and it asked for exactly that moment. (Asserted as a set, not by index:
  // React StrictMode double-invokes effects in the dev server the E2E drives.)
  expect(calls.clips).toContainEqual({ report_id: REPORT_ID, start_ms: 2000, end_ms: 4500 });

  // The second sentence is the clinician's turn.
  await page.locator(`[data-testid='replay-glyph-${SECTION}-1']`).click();
  await expect(page.locator("[data-testid='replay-speaker']")).toHaveText(/Лікар|Doctor/);
  await expect
    .poll(() => calls.clips.some((c) => c.start_ms === 4600 && c.end_ms === 7000))
    .toBe(true);
});

test("the player never autoplays", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls);
  await openReport(page);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  const audio = page.locator("[data-testid='replay-audio']");
  await expect(audio).toBeVisible();
  expect(await audio.evaluate((el) => el.autoplay)).toBe(false);
  expect(await audio.evaluate((el) => el.hasAttribute("autoplay"))).toBe(false);
  await page.waitForTimeout(600);
  expect(await audio.evaluate((el) => el.paused)).toBe(true);
});

test("a non-conversation section aligns by timing and says so", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  // One whole-session segment for two sentences — the sprint-08 fallback.
  await installReport(page, calls, {
    segments: [{ segment_id: null, index: 0, start_ms: 0, end_ms: 8000, speaker: null, speaker_role: null }],
  });
  await openReport(page);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  await expect(page.locator("[data-testid='replay-approx']")).toBeVisible();
  await expect(page.locator("[data-testid='replay-speaker']")).toHaveCount(0);
});

test("410 audio_not_retained renders the honest note, not an error", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls, {
    clip: {
      status: 410,
      body: {
        detail: {
          type: "urn:mdx:report:audio:audio_not_retained",
          code: "audio_not_retained",
          detail: "retention window passed",
        },
      },
    },
  });
  await openReport(page);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  const note = page.locator("[data-testid='replay-degraded']");
  await expect(note).toBeVisible();
  await expect(note).toContainText(/термін зберігання/);
  await expect(page.locator("[data-testid='replay-audio']")).toHaveCount(0);
});

test("410 audio_erased says deleted — a different fact, a different sentence", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls, {
    clip: { status: 410, body: { detail: { code: "audio_erased", detail: "object deleted" } } },
  });
  await openReport(page);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  await expect(page.locator("[data-testid='replay-degraded']")).toContainText(/видалено/);
});

test("429 renders a gentle limit message with the server's own window", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls, {
    clip: {
      status: 429,
      body: { detail: "clip rate limit reached", retry_after: 900 },
      headers: { "Retry-After": "900" },
    },
  });
  await openReport(page);

  await page.locator(`[data-testid='replay-glyph-${SECTION}-0']`).click();
  const note = page.locator("[data-testid='replay-degraded']");
  await expect(note).toBeVisible();
  await expect(note).toContainText(/ліміт/);
  await expect(note).toContainText(/15 хв/);
});

test("no segments ⇒ no affordance at all (nothing to fabricate)", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installReport(page, calls, { segments: [] });
  await openReport(page);

  await expect(page.locator(`[data-testid='replay-section-${SECTION}']`)).toContainText(S1);
  await expect(page.locator("[data-testid^='replay-glyph-']")).toHaveCount(0);
  expect(calls.clips).toHaveLength(0);
});
