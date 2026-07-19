// studio-autocomplete.spec.js — FE sprint 10 step 03: inline rendering,
// keyboard protocol, snippet expansion. Mocks auth + services, drives the
// real SPA editor and asserts the §4.3 protocol against the REAL backend
// wire shapes (prefix ≤ 80, extra="forbid", completion/cursor_offset).
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

const PHRASE = "задишка при фізичному навантаженні";

const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: {
    sections: [
      { id: "anamnesis", name: "Anamnesis", order: 0, required: true, field_type: "text", voice_aliases: ["anamnesis"] },
    ],
  },
};
const PATIENT = {
  id: PATIENT_ID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1980-01-01",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function suggestionsFor(prefix) {
  if (prefix.startsWith("/")) {
    return [{
      id: "snip-1", kind: "snippet",
      text: "АТ 120/80 мм рт ст, ЧСС 72 за хвилину.",
      completion: "АТ 120/80 мм рт ст, ЧСС 72 за хвилину.",
      source: "system", confidence: 0.4, cursor_offset: 3,
    }];
  }
  if (PHRASE.startsWith(prefix)) {
    return [
      {
        id: "phr-1", kind: "phrase", text: PHRASE,
        completion: PHRASE.slice(prefix.length),
        source: "system", confidence: 0.26, cursor_offset: null,
      },
      {
        id: "phr-2", kind: "phrase", text: "задишка у спокої",
        completion: "задишка у спокої".slice(prefix.length),
        source: "user", confidence: 0.2, cursor_offset: null,
      },
    ];
  }
  return [];
}

async function installMocks(page, calls) {
  const ctl = { sessionOpen: false };
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
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);
    if (path === "/patients" && method === "GET") return json(200, { items: [PATIENT] });
    if (path === `/patients/${PATIENT_ID}` && method === "GET") return json(200, PATIENT);

    if (path === "/v1/reports" && method === "POST")
      return json(201, { id: "report-1", version_number: 1, patient_id: PATIENT_ID, status: "draft" });
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT")
      return json(200, { id: "report-1", version_number: 2, status: "draft" });

    // ── autocomplete-service (:8007) ──
    if (path === "/autocomplete/suggest" && method === "POST") {
      const body = req.postDataJSON();
      calls.suggest.push(body);
      // Enforce the REAL wire contract in the mock: reject what the
      // backend would reject, so a contract regression fails the test.
      const allowed = new Set(["prefix", "language", "limit", "context"]);
      const extra = Object.keys(body).filter((k) => !allowed.has(k));
      if (extra.length || typeof body.prefix !== "string" || body.prefix.length > 80) {
        calls.badSuggest.push(body);
        return json(422, { title: "Unprocessable Content" });
      }
      // step-02 timeout test: this prefix answers slower than the hook's
      // 300 ms UX budget — with a REAL suggestion, so the late response
      // warms the memo and fires the `timeout` telemetry producer.
      if (body.prefix.startsWith("повіл")) {
        await new Promise((r) => setTimeout(r, 700));
        return json(200, {
          request_id: `slow-${calls.suggest.length}`,
          suggestions: [{
            id: "slow-1", kind: "phrase", text: body.prefix + "ьна відповідь",
            completion: "ьна відповідь", source: "system", confidence: 0.2,
            cursor_offset: null,
          }],
        });
      }
      return json(200, { request_id: `req-${calls.suggest.length}`, suggestions: suggestionsFor(body.prefix) });
    }
    if (path === "/autocomplete/telemetry" && method === "POST") {
      calls.telemetry.push(req.postDataJSON());
      return route.fulfill({ status: 204, body: "" });
    }

    return json(200, { items: [] });
  });
}

async function openStudio(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
  await page.goto("/#/dictate/studio");
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await expect(gateRow).toBeVisible({ timeout: 10000 });
  await gateRow.click();
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  return editor;
}

function newCalls() {
  return { suggest: [], badSuggest: [], telemetry: [] };
}

test("ghost appears for a token prefix and Tab inserts the completion", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  const ghost = page.locator(".autocomplete-ghost");
  await expect(ghost).toBeVisible({ timeout: 5000 });
  await expect(ghost).toContainText("ишка при фізичному навантаженні");

  await page.keyboard.press("Tab");
  await expect(editor).toContainText(PHRASE);
  // the accept cleared the ghost decoration — PHRASE above is document text
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);

  // focus never left the editor
  await expect(editor).toBeFocused();

  // wire contract held: no 422-shaped request ever went out
  expect(calls.badSuggest).toHaveLength(0);
  // telemetry: shown_only then accepted with the phrase id (the sink
  // batches — flush happens within the 2 s interval, so poll)
  await expect.poll(() => calls.telemetry.map((t) => t.event)).toContain("shown_only");
  await expect.poll(() => calls.telemetry.map((t) => t.event)).toContain("accepted");
  const accepted = calls.telemetry.find((t) => t.event === "accepted");
  expect(accepted.phrase_id).toBe("phr-1");
  expect(accepted.context).toEqual({ field: "anamnesis", index: 0 });

  // single undo reverts the whole accept. The ghost may legitimately
  // re-arm for the restored "зад" (memo hit), so assert on DOCUMENT text
  // with the ghost widget excluded — not on innerText.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(editor).toContainText("зад");
  const docText = await editor.evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".autocomplete-ghost").forEach((n) => n.remove());
    return clone.textContent;
  });
  expect(docText).not.toContain(PHRASE);
});

test("Esc dismisses, fires rejected once, and typing re-queries", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });

  await page.keyboard.press("Escape");
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  await expect(editor).toBeFocused();
  await expect.poll(() => calls.telemetry.filter((t) => t.event === "rejected").length).toBe(1);
});

test("plain Enter is a newline, ArrowDown+Enter accepts the selected option", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });

  // Plain Enter → newline (never hijacked for #0). Ghost is cleared by the
  // caret moving to a fresh block.
  await page.keyboard.press("Enter");
  await expect(editor).not.toContainText(PHRASE);
  expect(calls.telemetry.filter((t) => t.event === "accepted")).toHaveLength(0);

  // Retype on the new line, arm explicit selection, accept #2 via Enter.
  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("ArrowDown"); // → index 1 ("задишка у спокої")
  await page.keyboard.press("Enter");
  await expect(editor).toContainText("задишка у спокої");
  await expect
    .poll(() => calls.telemetry.find((t) => t.event === "accepted")?.phrase_id)
    .toBe("phr-2");
  expect(calls.telemetry.find((t) => t.event === "accepted").context.index).toBe(1);
});

test("snippet trigger /vit expands and the caret lands at cursor_offset", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("огляд /vit");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });

  await page.keyboard.press("Tab");
  // trigger token replaced by the expansion
  await expect(editor).toContainText("огляд АТ 120/80 мм рт ст");
  await expect(editor).not.toContainText("/vit");

  // caret at cursor_offset (3 → right after "АТ "): typing lands there
  await page.keyboard.type("X");
  await expect(editor).toContainText("огляд АТ X120/80");

  await expect
    .poll(() => calls.telemetry.find((t) => t.event === "accepted")?.snippet_id)
    .toBe("snip-1");
});

test("popup rows are unreachable by Tab and accept via mouse without stealing focus", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  const pills = page.locator(".autocomplete-pills");
  await expect(pills).toBeVisible({ timeout: 5000 });

  // §4.1: the popup is anchored under the caret, not parked at the bottom.
  const caretBox = await editor.evaluate(() => {
    const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
    return { left: r.left, bottom: r.bottom };
  });
  const pillsBox = await pills.boundingBox();
  expect(pillsBox.y).toBeGreaterThanOrEqual(caretBox.bottom);
  expect(pillsBox.y - caretBox.bottom).toBeLessThan(60);

  // §7: screen readers track the listbox via aria-activedescendant on the
  // editor's element; it follows arrow cycling.
  await expect(editor).toHaveAttribute("aria-activedescendant", "autocomplete-option-0");
  await page.keyboard.press("ArrowDown");
  await expect(editor).toHaveAttribute("aria-activedescendant", "autocomplete-option-1");
  await page.keyboard.press("ArrowDown"); // wraps back to 0
  await expect(editor).toHaveAttribute("aria-activedescendant", "autocomplete-option-0");

  // No element inside the popup is focusable via keyboard: every row and the
  // dismiss button carry tabindex=-1.
  const focusables = await pills.locator("[tabindex]:not([tabindex='-1'])").count();
  expect(focusables).toBe(0);

  // Mouse accept keeps the editor focused (mousedown + preventDefault).
  await pills.locator(".autocomplete-pill").nth(1).dispatchEvent("mousedown");
  await expect(editor).toContainText("задишка у спокої");
  await expect(editor).toBeFocused();
});

test("telemetry batches: no POST per keystroke, events arrive coalesced", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  // Three deliberate pauses → three suggest requests → three queued shows.
  await page.keyboard.type("зад");
  await page.waitForTimeout(300);
  await page.keyboard.type("и");
  await page.waitForTimeout(300);
  await page.keyboard.type("ш");
  await page.waitForTimeout(200);

  // Nothing was POSTed synchronously with typing (the 2 s flush window
  // hasn't elapsed since the last event).
  expect(calls.telemetry.length).toBe(0);

  // …but the batch lands shortly after.
  await expect.poll(() => calls.telemetry.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  for (const t of calls.telemetry) expect(t.event).toBe("shown_only");
});

test("LRU memo: retyping a prefix serves from cache — no second request", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  const ghost = page.locator(".autocomplete-ghost");
  await expect(ghost).toBeVisible({ timeout: 5000 });

  await page.keyboard.type("и"); // → "зади", a fresh query
  await expect(ghost).toContainText("шка при фізичному навантаженні");

  await page.keyboard.press("Backspace"); // back to "зад" — memo hit
  await expect(ghost).toContainText("ишка при фізичному навантаженні");
  await expect(editor).toBeFocused();

  // settle past the debounce window: the memo answered "зад", no re-fetch
  await page.waitForTimeout(400);
  expect(calls.suggest.filter((b) => b.prefix === "зад")).toHaveLength(1);
});

test("degraded: a response slower than 300 ms never renders and reports timeout", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  // Slow suggest override (registered after the base mocks → matched first).
  await page.route("**/autocomplete/suggest", async (route) => {
    const body = route.request().postDataJSON();
    calls.suggest.push(body);
    await new Promise((r) => setTimeout(r, 500));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ request_id: `req-slow-${calls.suggest.length}`, suggestions: suggestionsFor(body.prefix) }),
    });
  });
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  // past the 130 ms debounce + 300 ms budget + the 500 ms mock delay:
  // the late answer must never have rendered
  await page.waitForTimeout(1100);
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  await expect(editor).toBeFocused();

  // …but the degraded case is reported, joinable by request_id
  await expect
    .poll(() => calls.telemetry.filter((t) => t.event === "timeout").length, { timeout: 8000 })
    .toBeGreaterThanOrEqual(1);
  const to = calls.telemetry.find((t) => t.event === "timeout");
  expect(to.request_id).toMatch(/^req-slow-/);
  expect(to.prefix).toBe("зад");
  expect(to.phrase_id).toBeUndefined();
  expect(to.snippet_id).toBeUndefined();
});

test("telemetry endpoint down: typing and suggestions completely unaffected", async ({ page }) => {
  const calls = newCalls();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await installMocks(page, calls);
  // kill the telemetry endpoint AFTER the base mocks (first match wins)
  await page.route("**/autocomplete/telemetry", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("Tab");
  await expect(editor).toContainText(PHRASE);

  // wait past a flush cycle: still no crash, no toast, no page error
  await page.waitForTimeout(2600);
  expect(pageErrors).toHaveLength(0);
  await expect(page.locator(".toast, [role='alert']")).toHaveCount(0);
});

// ── FE step 02: the suggest-hook semantics (coalescing, memo, min-prefix,
//    timeout-degraded) observed through the real editor ──────────────────

test("step-02: rapid typing coalesces to ~1 request, not one per keystroke", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  await page.keyboard.type("задишка"); // 7 keystrokes, natural-fast
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  // trailing-edge 130 ms debounce: the burst collapses; allow 2 for a
  // mid-burst debounce window, never 7.
  expect(calls.suggest.length).toBeLessThanOrEqual(2);
  expect(calls.suggest[calls.suggest.length - 1].prefix).toBe("задишка");
});

test("step-02: back-typing to a seen prefix repaints from the memo — zero network", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(250);
  const afterFirst = calls.suggest.length;

  await page.keyboard.type("и"); // "зади" → new prefix, new request
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(250);
  const afterSecond = calls.suggest.length;
  expect(afterSecond).toBeGreaterThan(afterFirst);

  await page.keyboard.press("Backspace"); // back to "зад" — memo hit
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".autocomplete-ghost")).toContainText("ишка при");
  await page.waitForTimeout(400); // past debounce — still no new request
  expect(calls.suggest.length).toBe(afterSecond);
  await expect(editor).toBeFocused();

  // step-04 joinability: the memo re-show reports the ORIGINAL request_id,
  // and the sink dedups it — telemetry lands exactly ONE shown_only per
  // request_id even though "зад" rendered twice.
  await expect
    .poll(() => calls.telemetry.filter((t) => t.event === "shown_only").length, { timeout: 5000 })
    .toBeGreaterThanOrEqual(2);
  const perRequest = {};
  for (const t of calls.telemetry.filter((t) => t.event === "shown_only")) {
    perRequest[t.request_id] = (perRequest[t.request_id] || 0) + 1;
  }
  for (const [rid, n] of Object.entries(perRequest)) {
    expect(n, `duplicate shown_only for ${rid}`).toBe(1);
  }
});

test("step-02: a too-short prefix never queries", async ({ page }) => {
  // The 2-char lower boundary itself is unit-tested in prefix.test.js
  // (extractPrefix("за") → query; "з" → null); e2e proves the zero-network
  // side. (Typing char-by-char with pauses here races the mocked
  // template-detail setContent — a mock-env artifact, not app behavior.)
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  await page.keyboard.type("з");
  await page.waitForTimeout(500); // well past the 130 ms debounce window
  expect(calls.suggest.length).toBe(0);
});

test("step-02: response slower than the 300 ms budget → no ghost, `timeout` telemetry", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await openStudio(page);

  await page.keyboard.type("повіл"); // the mock answers this in 700 ms
  // ghost never pops in behind the typing rhythm
  await page.waitForTimeout(1200);
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  // ...and the abandonment is reported as a `timeout` event
  await expect
    .poll(() => calls.telemetry.filter((t) => t.event === "timeout").length, { timeout: 5000 })
    .toBeGreaterThan(0);
  const to = calls.telemetry.find((t) => t.event === "timeout");
  expect(to.phrase_id).toBeUndefined(); // timeout carries no ids
  expect(to.snippet_id).toBeUndefined();
});

// ── FE step 05: degraded modes, master toggle, uk copy ───────────────────

test("step-05: suggest endpoint dead — typing untouched, silence, micro-backoff stops the hammering", async ({ page }) => {
  const calls = newCalls();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await installMocks(page, calls);
  // Network-level failure on every suggest (registered after base mocks).
  let suggestAttempts = 0;
  await page.route("**/autocomplete/suggest", (route) => {
    suggestAttempts++;
    return route.abort("failed");
  });
  const editor = await openStudio(page);

  // Three separated keystroke bursts → three failed requests → backoff.
  await page.keyboard.type("зад");
  await page.waitForTimeout(350);
  await page.keyboard.type("и");
  await page.waitForTimeout(350);
  await page.keyboard.type("ш");
  await page.waitForTimeout(350);
  expect(suggestAttempts).toBe(3);

  // Backoff open (15 s): further typing fires ZERO requests.
  await page.keyboard.type("ка при");
  await page.waitForTimeout(600);
  expect(suggestAttempts).toBe(3);

  // The editor is indistinguishable from autocomplete-not-existing.
  await expect(editor).toContainText("задишка при");
  await expect(editor).toBeFocused();
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  await expect(page.locator(".autocomplete-pills")).toHaveCount(0);
  await expect(page.locator(".toast, [role='alert']")).toHaveCount(0);
  expect(pageErrors).toHaveLength(0);
});

test("step-05: master toggle — default ON, OFF kills everything mid-session, persists across reload", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  const editor = await openStudio(page);

  // uk copy from i18n renders in the settings row + help note
  const master = page.getByLabel("Підказки під час набору");
  await expect(master).toBeChecked(); // default ON
  await expect(page.getByText("навчаються з того, що ви приймаєте")).toBeVisible();
  await expect(page.getByText("Tab приймає її")).toBeVisible();

  await page.keyboard.type("зад");
  await expect(page.locator(".autocomplete-ghost")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".autocomplete-pills")).toBeVisible();
  const callsWhenOn = calls.suggest.length;

  // OFF mid-session: ghost + popup disappear immediately…
  await master.uncheck();
  await expect(page.locator(".autocomplete-ghost")).toHaveCount(0);
  await expect(page.locator(".autocomplete-pills")).toHaveCount(0);

  // …and typing fires zero further queries; Tab is not intercepted.
  await editor.click();
  await page.keyboard.type("и");
  await page.waitForTimeout(500);
  expect(calls.suggest.length).toBe(callsWhenOn);
  await page.keyboard.press("Tab"); // no suggestions → never consumed by autocomplete
  expect(calls.telemetry.filter((t) => t.event === "accepted")).toHaveLength(0);

  // Persistence: reload (same auth session), reopen the studio — still OFF,
  // heavy typing at mount produces zero client calls.
  await page.reload();
  const gateRow = page.locator("[data-testid='patient-gate-row']").first();
  await expect(gateRow).toBeVisible({ timeout: 10000 });
  await gateRow.click();
  const editor2 = page.locator(".ProseMirror").first();
  await expect(editor2).toBeVisible({ timeout: 10000 });
  await editor2.click();
  const before = calls.suggest.length;
  await page.keyboard.type("задишка при навантаженні");
  await page.waitForTimeout(600);
  expect(calls.suggest.length).toBe(before);
  await expect(page.getByLabel("Підказки під час набору")).not.toBeChecked();
});
