// evidence-flag-off.spec.js — EVA-S00/S01 AC-S01-F-4: with the evidence module
// switched off, the app must look exactly as it did before evidence work began.
//
// S01 ships plumbing only — generated types, permission rows, a lint rule — and
// none of it may leak a route or a nav entry. This spec is the proof, and it is
// re-run after every S01 change for the same reason a regression test exists at
// all: "we didn't add any UI" is a claim about code nobody re-reads, while a
// route probe and a nav snapshot are a claim about the running app.
//
// Two halves:
//   · route probe    every evidence path renders the 404, not the module
//   · nav snapshot   the sidebar's group list is exactly the pre-evidence one
//
// …plus a control that flips the flag ON and watches both change. Without it an
// invisibility test passes just as happily against a module that is broken,
// unrouted, or deleted — which is not what is being asserted.
import { test, expect } from "@playwright/test";
import { installBaseMocks, login, newCalls } from "./helpers/s15Mocks.js";

// The module gate: `chat:settings:<tenantId>` → { moduleEnabled }. It defaults
// to OFF (src/chat/data/useSettings.js), so the flag-off case sets nothing —
// asserting the default, which is what a fresh clinic actually gets.
const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const setModuleFlag = (page, moduleEnabled) =>
  page.addInitScript(
    ([tid, on]) => {
      try {
        localStorage.setItem(`chat:settings:${tid}`, JSON.stringify({ moduleEnabled: on }));
      } catch { /* ignore */ }
    },
    [TENANT_A, moduleEnabled],
  );

// Every path the evidence module owns, including deep links a bookmark could
// hold from a session where the flag was on.
const EVIDENCE_ROUTES = [
  "/chat",
  "/chat/history",
  "/chat/agents",
  "/chat/s/session-1",
  "/chat/anything-else",
  // EVA-S03: the devtools live behind their own flag (VITE_FEAT_EVIDENCE_DEVTOOLS)
  // and must be invisible the same way — an unknown path, not a locked door.
  // "Forbidden" would confirm the route exists; only the 404 does not.
  "/evidence",
  "/evidence/dev",
  "/evidence/dev/retrieval",
  // EVA-S04: the clinician surface, behind VITE_FEAT_EVIDENCE. Same rule, and
  // the answer deep link matters most — it is the one a bookmark or a pasted
  // link would carry into a build where the module was switched off.
  "/evidence/history",
  "/evidence/answers/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
];

// The sidebar as it stands for a clinician with evidence off. A snapshot, not
// a "does not contain 'Evidence'" check: the failure this guards against is an
// evidence entry appearing under some other label. Titles are in the default UI
// language (uk) because the language is React state seeded from TWEAK_DEFAULTS,
// not storage — there is nothing a spec can set before mount.
const NAV_SNAPSHOT_OFF = ["Scribe"];
const NAV_SNAPSHOT_ON = ["Scribe", "Доказова база"];

const groupTitles = (page) => page.locator(".sb-group-title").allTextContents();

test.describe("evidence module — flag off", () => {
  test.beforeEach(async ({ page }) => {
    await installBaseMocks(page, newCalls());
  });

  test("every evidence route falls through to the 404", async ({ page }) => {
    await login(page);
    for (const route of EVIDENCE_ROUTES) {
      await page.goto(`/#${route}`);
      // The 404 prints the unmatched path as its body — asserted instead of the
      // heading so the probe does not depend on the UI language.
      await expect(
        page.locator(".empty p"),
        `${route} must not render the module while the flag is off`,
      ).toHaveText(route, { timeout: 10000 });
      // The module's own root never mounts.
      await expect(page.locator(".ec-root")).toHaveCount(0);
    }
  });

  test("the sidebar carries no evidence entry", async ({ page }) => {
    await login(page);
    await page.locator(".sb-brand").waitFor({ state: "visible" });
    expect(await groupTitles(page)).toEqual(NAV_SNAPSHOT_OFF);
    // Nothing anywhere in the nav links into either module.
    await expect(page.locator('.sb-nav a[href*="/chat"], .sb-item[data-path^="/chat"]')).toHaveCount(0);
    await expect(page.locator('[href*="/evidence"], [data-path^="/evidence"]')).toHaveCount(0);
  });

  test("control: flipping the flag on makes both surfaces appear", async ({ page }) => {
    await setModuleFlag(page, true);
    await login(page);
    await page.locator(".sb-brand").waitFor({ state: "visible" });
    expect(await groupTitles(page)).toEqual(NAV_SNAPSHOT_ON);

    await page.goto("/#/chat");
    await expect(page.locator(".ec-root")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".empty p")).toHaveCount(0);
  });
});
