// autocomplete-live.spec.js — FE sprint 10 step 06: the WHOLE loop against
// the REAL backend. No mocks anywhere (page.route is never used; network is
// observed via page.on("request") only). Gated: needs the full local dev
// stack → `npm run e2e:live` (RUN_BACKEND_INTEGRATION=1). The chaos case
// additionally needs E2E_CHAOS=1 (`npm run e2e:live:chaos`) — it docker-stops
// autocomplete-service mid-test.
//
// Telemetry is asserted via direct SQL against the dockerized postgres
// (the backend buffers inserts ~5 s/100 rows, so SQL polls with a deadline).
// The coupling to the backend schema is isolated to sqlRows() below.
//
// Deterministic data: starter-corpus prefixes only — "зад" (migration 0026)
// and the seeded snippet trigger "/vitals". Assertions are scoped to rows
// created after each test's own start marker.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const LIVE = process.env.RUN_BACKEND_INTEGRATION === "1";
const CHAOS = process.env.E2E_CHAOS === "1";
const AUTH = process.env.VITE_AUTH_SERVICE_URL || "http://localhost:8000";
const AC = process.env.VITE_AUTOCOMPLETE_SERVICE_URL || "http://localhost:8007";
const AC_CONTAINER = "medical-dictation-autocomplete-service-1";
const PG =
  "docker exec medical-dictation-postgres-1 psql -U postgres -d medical_dictation -t -A -F '|' -c";

test.skip(!LIVE, "needs the live backend dev stack — run via `npm run e2e:live`");
// One shared real service + a chaos case that stops it: strictly serial.
test.describe.configure({ mode: "serial" });

function sqlRows(where) {
  const q =
    "SELECT event_type, request_id::text, coalesce(phrase_id::text,''), " +
    `coalesce(snippet_id::text,''), prefix_scrubbed FROM autocomplete_telemetry WHERE ${where} ORDER BY created_at`;
  // execSync BLOCKS the worker's event loop — without a child timeout a
  // stalled docker daemon freezes the whole test past Playwright's own
  // timeout. Bound it and let expect.poll retry on failure.
  let out;
  try {
    out = execSync(`${PG} "${q}"`, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch {
    return [];
  }
  if (!out) return [];
  return out.split("\n").map((l) => {
    const [event, rid, pid, sid, prefix] = l.split("|");
    return { event, rid, pid: pid || null, sid: sid || null, prefix };
  });
}

async function warmBackend() {
  // First suggest after a service (re)start builds the tenant trie — warm it
  // so the 300 ms render budget isn't eaten by cold start in test 1.
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "clinician@tenant-a.example", password: "dev-password" }),
  });
  const { access_token } = await r.json();
  for (const prefix of ["зад", "зад", "/vitals"]) {
    await fetch(`${AC}/autocomplete/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({ prefix, language: "uk" }),
    });
  }
}

// Real UI login + Studio + patient gate. Console/page errors are collected
// AFTER login (the pre-auth bootstrap legitimately logs one 401 refresh).
async function openLiveStudio(page, errors) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("clinician@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15000 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const src = m.location()?.url || "";
    const txt = m.text();
    // Pre-existing dev-stack noise, unrelated to autocomplete (named in the
    // sprint sign-off): the Studio probes each service's /readyz on mount —
    // dictation-service (:8002) has no CORS headers in this stack and
    // another probe answers 503, which Chromium logs as console errors.
    // Everything else (including any :8007 autocomplete failure) counts.
    if (src.includes("/readyz") || txt.includes("/readyz") || txt.includes(":8002")) return;
    errors.push(`console: ${txt}`);
  });
  await page.goto("/#/studio?mode=dictate");
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await expect(gateRow).toBeVisible({ timeout: 15000 });
  await gateRow.click();
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 15000 });
  await editor.click();
  return editor;
}

const docText = (editor) =>
  editor.evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(".autocomplete-ghost").forEach((n) => n.remove());
    return c.textContent;
  });

test.beforeAll(async () => {
  if (LIVE) await warmBackend();
});

test("live 1 — happy path: зад → ghost → Tab inserts → shown_only+accepted joined by request_id", async ({ page }) => {
  const errors = [];
  const t0 = new Date().toISOString();
  const editor = await openLiveStudio(page, errors);

  await page.keyboard.type("зад", { delay: 80 });
  const ghost = page.locator(".autocomplete-ghost");
  await expect(ghost).toBeVisible({ timeout: 3000 });
  const completion = await ghost.textContent();
  const accepted = "зад" + completion;

  await page.keyboard.press("Tab");
  await expect.poll(() => docText(editor)).toContain(accepted);
  await expect(editor).toBeFocused();

  // Telemetry lands via the backend's ~5 s buffered insert — SQL poll.
  await expect
    .poll(
      () => {
        const rows = sqlRows(`created_at > '${t0}' AND prefix_scrubbed = 'зад'`);
        const shown = rows.find((r) => r.event === "shown_only");
        const acc = rows.find((r) => r.event === "accepted");
        return shown && acc && shown.rid === acc.rid && !!acc.pid ? "joined" : rows.map((r) => r.event).join(",");
      },
      { timeout: 20000, intervals: [2000] },
    )
    .toBe("joined");
  expect(errors).toEqual([]);
});

test("live 2 — snippet: /vitals expands, caret lands at cursor_offset, accepted carries snippet_id", async ({ page }) => {
  const errors = [];
  const t0 = new Date().toISOString();
  const editor = await openLiveStudio(page, errors);

  await page.keyboard.type("/vitals", { delay: 80 });
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 3000 });

  await page.keyboard.press("Tab");
  await expect.poll(() => docText(editor)).toContain("Температура {");
  await expect.poll(() => docText(editor)).not.toContain("/vitals");
  // cursor_offset = 13 → caret right after "Температура {": typing lands there
  await page.keyboard.type("X");
  await expect.poll(() => docText(editor)).toContain("Температура {X");

  await expect
    .poll(
      () => {
        const rows = sqlRows(`created_at > '${t0}' AND prefix_scrubbed = '/vitals'`);
        const acc = rows.find((r) => r.event === "accepted");
        return acc && !!acc.sid && !acc.pid ? "snippet-accepted" : rows.map((r) => r.event).join(",");
      },
      { timeout: 20000, intervals: [2000] },
    )
    .toBe("snippet-accepted");
  expect(errors).toEqual([]);
});

test("live 3 — reject: Esc dismisses, text unchanged, rejected row lands", async ({ page }) => {
  const errors = [];
  const t0 = new Date().toISOString();
  const editor = await openLiveStudio(page, errors);

  await page.keyboard.type("зад", { delay: 80 });
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  expect((await docText(editor)).trim()).toContain("зад");
  expect((await docText(editor)).includes("задишка")).toBe(false); // nothing inserted

  await expect
    .poll(
      () => {
        const rows = sqlRows(`created_at > '${t0}' AND prefix_scrubbed = 'зад' AND event_type = 'rejected'`);
        return rows.length;
      },
      { timeout: 20000, intervals: [2000] },
    )
    .toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("live 4 — chaos: service stopped mid-flight → typing verbatim, silent; recovery after restart", async ({ page }) => {
  test.skip(!CHAOS, "chaos case is env-gated — run via `npm run e2e:live:chaos` (docker-stops autocomplete-service)");
  // stop → type → docker start → healthz poll (≤30 s) → re-login → recovery:
  // the default 30 s test budget is not enough for the restart cycle alone.
  test.setTimeout(120_000);
  const errors = [];
  const editor = await openLiveStudio(page, errors);
  execSync(`docker stop ${AC_CONTAINER}`, { timeout: 60_000 });
  try {
    for (const chunk of ["пацієнт ", "скаржиться ", "на ", "задишку ", "при ", "навантаженні"]) {
      await page.keyboard.type(chunk, { delay: 30 });
      await page.waitForTimeout(250);
    }
    await expect
      .poll(() => docText(editor))
      .toContain("пацієнт скаржиться на задишку при навантаженні");
    await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
    await expect(page.locator(".toast, [role='alert']")).toHaveCount(0);
    expect(errors.filter((e) => e.startsWith("pageerror"))).toEqual([]);
  } finally {
    execSync(`docker start ${AC_CONTAINER}`, { timeout: 60_000 });
  }
  await expect
    .poll(async () => (await fetch(`${AC}/healthz`).then((r) => r.ok).catch(() => false)) ? "up" : "down", {
      timeout: 30000,
    })
    .toBe("up");
  await warmBackend();

  // Recovery: reload gives a fresh page (no micro-backoff state). Whether
  // the session survives the reload is nondeterministic in the harness
  // (dev refresh cookie is cross-origin): handle BOTH the login form and
  // the already-authed shell, then reach the editor via gate or auto-
  // resolved draft.
  await page.reload();
  const emailInput = page.locator('input[type="email"]');
  const authedShell = page.getByRole("button", { name: "Dictate" });
  await expect(emailInput.or(authedShell).first()).toBeVisible({ timeout: 20000 });
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill("clinician@tenant-a.example");
    await page.locator('input[type="password"]').fill("dev-password");
    await page.locator('button[type="submit"]').click();
  }
  await page.goto("/#/studio?mode=dictate");
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  const editor2 = page.locator(".ProseMirror").first();
  await expect(editor2.or(gateRow).first()).toBeVisible({ timeout: 20000 });
  if (await gateRow.isVisible().catch(() => false)) await gateRow.click();
  await expect(editor2).toBeVisible({ timeout: 15000 });
  await editor2.click();
  // "." ends the sentence stem, so restored draft text can't pollute the
  // fresh "зад" prefix.
  await page.keyboard.press("End");
  await page.keyboard.type(". зад", { delay: 80 });
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
});

test("live 5 — toggle OFF: zero suggest requests observed on the wire; ON restores", async ({ page }) => {
  const errors = [];
  const editor = await openLiveStudio(page, errors);
  let suggestRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/autocomplete/suggest")) suggestRequests++;
  });

  const master = page.getByLabel("Підказки під час набору");
  await expect(master).toBeChecked();
  await master.uncheck();
  // Multi-section live template: target a specific section's paragraph so
  // the caret lands where we type (a blind editor click hits mid-document).
  await page.locator(".ProseMirror p").last().click();
  await page.keyboard.type("зад", { delay: 80 });
  await page.waitForTimeout(600); // past debounce — deliberate settle, then assert zero
  expect(suggestRequests).toBe(0);
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  await expect(page.locator(".autocomplete-pills")).toHaveCount(0);

  await master.check();
  await page.locator(".ProseMirror p").first().click(); // clean, empty section
  await page.keyboard.type("зад", { delay: 80 });
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 3000 });
  expect(suggestRequests).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
