// layer-c-completion.spec.js — FE sprint 15: ghost completions.
//
// The three laws under test, in the real SPA against the real editor:
//   1. Ghost text NEVER auto-inserts — Tab (or the touch chip) is the only way
//      in, and any other keystroke kills it WITHOUT being swallowed.
//   2. Stale ghosts die instantly — new input, cursor move, blur, 2 s idle.
//   3. Silence is normal — a finished sentence and a disabled tenant flag both
//      produce ZERO requests, not an error state.
import { test, expect } from "@playwright/test";
import {
  installBaseMocks, openStudio, newCalls, suppressCoachMark, REPORT_ID,
} from "./helpers/s15Mocks.js";

const SENTENCE = "Пацієнт скаржиться на біль у";
const COMPLETION = " плечі, що посилюється при навантаженні";

// generation-service (:8009). Enforces the backend's extra="forbid" body and
// the 1000-char cap, so a wire regression fails here.
async function installGeneration(page, calls, { completion = COMPLETION, status = 200, delayMs = 0 } = {}) {
  await page.route("**/v1/completions/inline", async (route) => {
    const body = route.request().postDataJSON();
    calls.completions.push(body);
    const allowed = new Set(["report_id", "section_key", "text_before_cursor", "language"]);
    const extra = Object.keys(body).filter((k) => !allowed.has(k));
    if (extra.length || typeof body.text_before_cursor !== "string" ||
        body.text_before_cursor.length > 1000 || !["uk", "en"].includes(body.language)) {
      calls.badCompletion.push(body);
      return route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (status !== 200) return route.fulfill({ status, body: "" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        request_id: `gen-${calls.completions.length}`,
        completion, model: "gemma3:1b", latency_ms: 380,
      }),
    });
  });
}

const ghost = (page) => page.locator("[data-testid='layerc-ghost']");

// The report_id the wire contract demands only exists once autosave has minted
// a draft; typing a first sentence and letting autosave land is the honest
// precondition, not a shortcut around one.
async function typeUntilGhost(page, editor, text = SENTENCE) {
  await editor.click();
  await page.keyboard.type(text);
  await expect(ghost(page)).toBeVisible({ timeout: 20000 });
}

test("mid-sentence pause renders a ghost, Tab inserts exactly the completion", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await expect(ghost(page)).toContainText("плечі, що посилюється при навантаженні");

  // The ghost is a decoration: it is NOT in the document yet.
  const beforeAccept = await docText(editor);
  expect(beforeAccept).toBe(SENTENCE);

  await page.keyboard.press("Tab");
  await expect.poll(() => docText(editor)).toBe(SENTENCE + COMPLETION);
  await expect(ghost(page)).toHaveCount(0);
  await expect(editor).toBeFocused();

  // The wire held.
  expect(calls.badCompletion).toHaveLength(0);
  const req = calls.completions[0];
  expect(req.report_id).toBe(REPORT_ID);
  expect(req.section_key).toBe("anamnesis");
  expect(req.language).toBe("uk");
  expect(req.text_before_cursor.endsWith("біль у")).toBe(true);
});

test("typing through the ghost dismisses it AND the keystroke lands — nothing is swallowed", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await page.keyboard.type("к");

  await expect(ghost(page)).toHaveCount(0);
  // The character reached the document, once, in the right place.
  await expect.poll(() => docText(editor)).toBe(SENTENCE + "к");
  expect(await docText(editor)).not.toContain("плечі");
});

test("Escape dismisses; the completion never enters the document", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await page.keyboard.press("Escape");
  await expect(ghost(page)).toHaveCount(0);
  expect(await docText(editor)).toBe(SENTENCE);
  await expect(editor).toBeFocused();
});

test("a cursor move and a blur each dismiss the ghost", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await page.keyboard.press("ArrowLeft");
  await expect(ghost(page)).toHaveCount(0);
  expect(await docText(editor)).toBe(SENTENCE);

  // …and blur, from a fresh ghost.
  await page.keyboard.press("End");
  await expect(ghost(page)).toBeVisible({ timeout: 20000 });
  await editor.evaluate((el) => el.blur());
  await expect(ghost(page)).toHaveCount(0);
  expect(await docText(editor)).toBe(SENTENCE);
});

test("an unclaimed ghost expires on its own — irrelevance is a dismissal", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await expect(ghost(page)).toHaveCount(0, { timeout: 6000 });
  expect(await docText(editor)).toBe(SENTENCE);
});

test("after terminal punctuation NO request fires", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await editor.click();
  // A finished sentence, long enough that only the punctuation gate can stop it.
  await page.keyboard.type("Стан пацієнта задовільний.");
  await page.waitForTimeout(4000); // past autosave + settle + staleness
  expect(calls.completions).toHaveLength(0);
  await expect(ghost(page)).toHaveCount(0);

  // Removing the full stop reopens the sentence — proving the silence above was
  // the gate, not a dead feature.
  await page.keyboard.press("Backspace");
  await expect(ghost(page)).toBeVisible({ timeout: 20000 });
});

test("tenant flag off ⇒ not one completion request ever leaves the browser", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls, { layerCEnabled: false });
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await editor.click();
  await page.keyboard.type(SENTENCE);
  await page.waitForTimeout(4000);

  expect(calls.completions).toHaveLength(0);
  await expect(ghost(page)).toHaveCount(0);
  // …and the clinician sees no error about it: silence is the whole design.
  await expect(page.locator("[role='alert']")).toHaveCount(0);
});

test("204 renders nothing and is not an error state", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls, { status: 204 });
  const editor = await openStudio(page);

  await editor.click();
  await page.keyboard.type(SENTENCE);
  await expect.poll(() => calls.completions.length, { timeout: 20000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  await expect(ghost(page)).toHaveCount(0);
  await expect(page.locator(".toast, [role='alert']")).toHaveCount(0);
});

test("telemetry: shown/accepted ride the batcher with source=layer_c and no corpus ids", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  // Nothing was POSTed synchronously with the impression — the sink batches.
  expect(calls.telemetry).toHaveLength(0);
  await page.keyboard.press("Tab");

  await expect.poll(() => calls.telemetry.map((t) => t.event), { timeout: 10000 })
    .toContain("accepted");
  const layerC = calls.telemetry.filter((t) => t.source === "layer_c");
  expect(layerC.map((t) => t.event)).toContain("shown_only");
  expect(layerC.map((t) => t.event)).toContain("accepted");
  for (const t of layerC) {
    expect(t.phrase_id).toBeUndefined();
    expect(t.snippet_id).toBeUndefined();
  }
  expect(calls.badTelemetry).toHaveLength(0);
});

test("dismissals are reported with their reason", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => calls.telemetry.find((t) => t.source === "layer_c" && t.event === "rejected")?.context?.reason,
      { timeout: 10000 })
    .toBe("key");
});

test("first ghost ever shows the one-time coach-mark, and only once", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls); // coach-mark NOT suppressed
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await typeUntilGhost(page, editor);
  const coach = page.locator("[data-testid='layerc-coach']");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText("Tab");

  await page.keyboard.press("Tab");
  await expect(coach).toHaveCount(0);

  // A second ghost in the same session does not re-explain itself.
  await page.keyboard.type(" та в");
  await expect(ghost(page)).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-testid='layerc-coach']")).toHaveCount(0);
});

test("E2E flow: type mid-sentence → ghost → Tab-accept → finalize", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);

  const finalized = [];
  await page.route("**/v1/reports/*/finalize", async (route) => {
    finalized.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ id: REPORT_ID, version_number: 3, status: "finalized" }),
    });
  });
  const drafts = [];
  await page.route("**/v1/reports/*/draft", async (route) => {
    if (route.request().method() === "PUT") drafts.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ id: REPORT_ID, version_number: 2, status: "draft" }),
    });
  });

  const editor = await openStudio(page);
  await typeUntilGhost(page, editor);
  await page.keyboard.press("Tab");
  await expect.poll(() => docText(editor)).toBe(SENTENCE + COMPLETION);

  await page.getByRole("button", { name: /Завершити диктування|Complete dictation/ }).click();
  await page.getByRole("button", { name: /Інші дії зі звітом|Other report actions/ }).click();
  await page.getByRole("menuitem", { name: /Завершити без підпису|Finalize without signing/ })
    .or(page.getByText(/Завершити без підпису|Finalize without signing/)).first().click();

  await expect.poll(() => finalized.length, { timeout: 20000 }).toBeGreaterThan(0);
  // The accepted continuation is in the persisted draft — after acceptance it
  // is the clinician's text, indistinguishable from what they typed.
  // (the draft PUT wraps the sections in `content`, not `body`)
  const last = drafts[drafts.length - 1];
  expect(JSON.stringify(last.content)).toContain("плечі, що посилюється при навантаженні");
});

// Document text with every ghost decoration stripped: the ONLY honest way to
// ask "what is actually in the report?" while a widget sits at the caret.
function docText(editor) {
  return editor.evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".layerc-ghost, .autocomplete-ghost").forEach((n) => n.remove());
    return clone.textContent;
  });
}
