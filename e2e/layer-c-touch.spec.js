// layer-c-touch.spec.js — FE sprint 15: the touch accept affordance.
//
// Its own file because Playwright cannot switch device emulation inside a
// describe block. A phone has no Tab key, so without the inline "↹" chip the
// accept-only rule would make Layer C unusable on the device clinicians
// actually carry between rooms.
import { test, expect } from "@playwright/test";
import { installBaseMocks, openStudio, newCalls, suppressCoachMark } from "./helpers/s15Mocks.js";

// Touch emulation, desktop viewport. `hasTouch` is what the feature actually
// keys on (navigator.maxTouchPoints / pointer: coarse); a phone viewport would
// only add a login-page layout fight that has nothing to do with Layer C.
test.use({ hasTouch: true });

const SENTENCE = "Пацієнт скаржиться на біль у";
const COMPLETION = " плечі, що посилюється при навантаженні";

async function installGeneration(page, calls) {
  await page.route("**/v1/completions/inline", async (route) => {
    calls.completions.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        request_id: `gen-${calls.completions.length}`,
        completion: COMPLETION, model: "gemma3:1b", latency_ms: 380,
      }),
    });
  });
}

const docText = (editor) => editor.evaluate((el) => {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(".layerc-ghost, .autocomplete-ghost").forEach((n) => n.remove());
  return clone.textContent;
});

test("the inline ↹ chip accepts on tap and reports it as layer_c", async ({ page }) => {
  const calls = newCalls();
  await suppressCoachMark(page);
  await installBaseMocks(page, calls);
  await installGeneration(page, calls);
  const editor = await openStudio(page);

  await editor.click();
  await page.keyboard.type(SENTENCE);
  await expect(page.locator("[data-testid='layerc-ghost']")).toBeVisible({ timeout: 20000 });

  const chip = page.locator("[data-testid='layerc-accept']");
  await expect(chip).toBeVisible();
  // The real gesture: mousedown/touchstart with preventDefault, because a
  // click would blur the editor and the caret would be gone by accept time.
  await chip.dispatchEvent("mousedown");

  await expect.poll(() => docText(editor)).toBe(SENTENCE + COMPLETION);
  await expect(page.locator("[data-testid='layerc-ghost']")).toHaveCount(0);

  await expect
    .poll(() => calls.telemetry.filter((t) => t.source === "layer_c" && t.event === "accepted").length,
      { timeout: 10000 })
    .toBe(1);
});
