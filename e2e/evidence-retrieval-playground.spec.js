// evidence-retrieval-playground.spec.js — EVA-S03 AC-S03-F-1/2/4.
//
// Drives the real screen against a route-mocked evidence-retrieval. The mock
// answers from the S02 corpus fixtures rather than invented passages, so what
// renders here is the same data every later evidence suite will use — and a
// contract change breaks the fixtures' shape test first, loudly, instead of
// showing up as a puzzling assertion failure in a screen spec.
//
// The mock also ENFORCES the request contract: a body that omits `query`, or
// nests `snapshot_id` inside `filters`, gets a 422 exactly as the service
// would. A permissive fake would let a broken request pass here and fail in
// integration.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installBaseMocks, login, newCalls } from "./helpers/s15Mocks.js";

const CORPUS = JSON.parse(readFileSync(new URL("./fixtures/corpus/passages.json", import.meta.url), "utf8"));
const RETRIEVAL_PORT = "8011";

// The devtools flag is a build-time constant; services.js accepts this DEV-only
// localStorage override so both flag states can be exercised in one run.
const enableDevtools = (page) =>
  page.addInitScript(() => {
    try { localStorage.setItem("mdx.flag.evidenceDevtools", "1"); } catch { /* ignore */ }
  });

function corpusResponse({ passages = CORPUS.slice(0, 3), degraded = false, connectors } = {}) {
  return {
    contract_version: "1.0",
    lexicon_version: "1.0",
    snapshot_id: null,
    degraded,
    passages,
    connector_meta: connectors ?? [
      { connector_id: "local_corpus@v1", kind: "local_corpus", status: "ok", latency_ms: 42, count: passages.length },
    ],
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {(body:object, call:number) => {status:number, body:object}} responder
 */
async function mockRetrieve(page, responder) {
  const calls = [];
  await page.route(
    (url) => url.hostname === "localhost" && url.port === RETRIEVAL_PORT && url.pathname === "/retrieve",
    async (route) => {
      const body = route.request().postDataJSON();
      calls.push(body);
      // Contract enforcement, mirroring the service's own validation.
      const problems = [];
      if (!body?.query) problems.push({ loc: ["body", "query"], msg: "field required" });
      if (body?.filters && "snapshot_id" in body.filters) {
        problems.push({ loc: ["body", "filters", "snapshot_id"], msg: "extra fields not permitted" });
      }
      if (typeof body?.k === "number" && body.k < 1) {
        problems.push({ loc: ["body", "k"], msg: "must be >= 1" });
      }
      if (problems.length) {
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ title: "Unprocessable Content", detail: "Request validation failed", errors: problems }),
        });
      }
      const { status, body: payload } = responder(body, calls.length);
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    },
  );
  return calls;
}

async function openPlayground(page) {
  await login(page);
  await page.goto("/#/evidence/dev/retrieval");
  await expect(page.getByTestId("retrieval-playground")).toBeVisible();
}

test.describe("retrieval playground", () => {
  test.beforeEach(async ({ page }) => {
    await enableDevtools(page);
    await installBaseMocks(page, newCalls(), { roles: ["tenant_admin"] });
  });

  test("happy path: rows carry rank, scores, badges and section breadcrumb", async ({ page }) => {
    const calls = await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);

    await page.getByTestId("query-input").fill("metformin first line");
    await page.getByTestId("submit").click();

    const rows = page.getByTestId("passage-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("#1");
    await expect(rows.first().getByTestId("passage-text")).toContainText(CORPUS[0].text.slice(0, 40));
    // Metadata is rendered as text, not colour.
    await expect(rows.first()).toContainText("guideline");
    await expect(rows.first()).toContainText("international");
    await expect(rows.nth(2)).toContainText("2.1 Monitoring"); // section breadcrumb

    // The request carried what the form said.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      query: "metformin first line",
      k: 10,
      sources: ["local_corpus"],
      filters: { include_superseded: false },
    });

    // Scores popover opens from the keyboard and shows every stage, with the
    // ones that did not run marked rather than dropped.
    await rows.first().getByTestId("scores-toggle").focus();
    await page.keyboard.press("Enter");
    const popover = page.getByTestId("scores-popover");
    await expect(popover).toBeVisible();
    await expect(popover.locator("[data-stage=dense]")).toContainText("0.61");
    await expect(popover.locator("[data-stage=rerank][data-ran=false]")).toContainText("—");
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
  });

  test("every RR2 filter reaches the request body", async ({ page }) => {
    const calls = await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);

    await page.getByTestId("query-input").fill("гіпертензія");
    await page.getByTestId("k-input").fill("25");
    await page.getByTestId("source-web").check();
    await page.getByTestId("filter-authority-national").check();
    await page.getByTestId("filter-jurisdiction").fill("UA");
    await page.getByTestId("filter-specialty").fill("cardiology, endocrinology");
    await page.getByTestId("filter-date-from").fill("2020-01-01");
    await page.getByTestId("filter-date-to").fill("2026-01-01");
    await page.getByTestId("filter-include-superseded").check();
    await page.getByTestId("filter-snapshot-id").fill("22222222-2222-4222-8222-222222222222");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("passage-list")).toBeVisible();

    expect(calls[0]).toEqual({
      query: "гіпертензія",
      k: 25,
      sources: ["local_corpus", "web"],
      snapshot_id: "22222222-2222-4222-8222-222222222222",
      filters: {
        include_superseded: true,
        authority: ["national"],
        specialty: ["cardiology", "endocrinology"],
        jurisdiction: "UA",
        date_from: "2020-01-01",
        date_to: "2026-01-01",
      },
    });
  });

  test("editing the form does not refetch — only Retrieve does", async ({ page }) => {
    const calls = await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);
    await page.getByTestId("query-input").fill("first query");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("passage-list")).toBeVisible();

    await page.getByTestId("query-input").fill("a totally different question");
    await page.getByTestId("k-input").fill("7");
    await page.waitForTimeout(250);
    expect(calls).toHaveLength(1);

    await page.getByTestId("submit").click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].query).toBe("a totally different question");
  });

  test("degraded is a warning above real results, not an error", async ({ page }) => {
    await mockRetrieve(page, () => ({
      status: 200,
      body: corpusResponse({
        degraded: true,
        connectors: [
          { connector_id: "local_corpus@v1", kind: "local_corpus", status: "ok", latency_ms: 40, count: 3 },
          { connector_id: "web@v1", kind: "web", status: "unavailable", latency_ms: 3000, count: 0 },
        ],
      }),
    }));
    await openPlayground(page);
    await page.getByTestId("query-input").fill("q");
    await page.getByTestId("submit").click();

    const banner = page.getByTestId("degraded-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-degraded", "true");
    await expect(banner).toContainText("web@v1 (unavailable)");
    // Results are still there — that is the whole distinction from an error.
    await expect(page.getByTestId("passage-row")).toHaveCount(3);
    await expect(page.getByTestId("retrieval-error")).toHaveCount(0);
    // The connector that returned nothing is shown, not hidden.
    await expect(page.getByTestId("connector-chip-web@v1")).toHaveAttribute("data-status", "unavailable");
  });

  test("retrieval_unavailable explains itself and retries", async ({ page }) => {
    const calls = await mockRetrieve(page, (_body, call) =>
      call === 1
        ? { status: 503, body: { title: "Service Unavailable", detail: "dense engine down", code: "retrieval_unavailable" } }
        : { status: 200, body: corpusResponse() },
    );
    await openPlayground(page);
    await page.getByTestId("query-input").fill("q");
    await page.getByTestId("submit").click();

    await expect(page.getByTestId("retrieval-error")).toBeVisible();
    await expect(page.getByTestId("unavailable-note")).toContainText("fails closed");
    await expect(page.getByTestId("passage-row")).toHaveCount(0);

    await page.getByTestId("retry").click();
    await expect(page.getByTestId("passage-row")).toHaveCount(3);
    await expect(page.getByTestId("retrieval-error")).toHaveCount(0);
    expect(calls).toHaveLength(2);
    // A retry re-sends the same question, not a fresh one.
    expect(calls[1]).toEqual(calls[0]);
  });

  test("empty result echoes the filters that were applied", async ({ page }) => {
    await mockRetrieve(page, () => ({ status: 200, body: corpusResponse({ passages: [] }) }));
    await openPlayground(page);
    await page.getByTestId("query-input").fill("something nothing matches");
    await page.getByTestId("filter-authority-tenant").check();
    await page.getByTestId("filter-jurisdiction").fill("PL");
    await page.getByTestId("submit").click();

    await expect(page.getByTestId("no-passages")).toBeVisible();
    const applied = page.getByTestId("applied-filters");
    await expect(applied).toContainText("authority: tenant");
    await expect(applied).toContainText("jurisdiction: PL");
    await expect(applied).toContainText("k=10");
  });

  test("a previous result stays on screen while the next request runs", async ({ page }) => {
    let release;
    await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);
    await page.getByTestId("query-input").fill("first");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("passage-row")).toHaveCount(3);

    // Hold the second response open.
    await page.route(
      (url) => url.port === RETRIEVAL_PORT && url.pathname === "/retrieve",
      async (route) => {
        await new Promise((resolve) => { release = resolve; });
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpusResponse({ passages: CORPUS.slice(3, 5) })) });
      },
    );
    await page.getByTestId("query-input").fill("second");
    await page.getByTestId("submit").click();

    await expect(page.getByTestId("updating")).toBeVisible();
    await expect(page.getByTestId("passage-row")).toHaveCount(3, { timeout: 2000 });
    release();
    await expect(page.getByTestId("passage-row")).toHaveCount(2);
    await expect(page.getByTestId("updating")).toHaveCount(0);
  });

  test("the raw request and response are inspectable", async ({ page }) => {
    await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);
    await page.getByTestId("query-input").fill("q");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("passage-list")).toBeVisible();

    await page.getByTestId("request-json").getByRole("button", { name: /request body/ }).click();
    await expect(page.getByTestId("request-json").locator("pre")).toContainText('"include_superseded": false');
    await page.getByTestId("response-json").getByRole("button", { name: /raw response/ }).click();
    await expect(page.getByTestId("response-json").locator("pre")).toContainText('"connector_meta"');
  });

  test("the form refuses a question the service would reject", async ({ page }) => {
    const calls = await mockRetrieve(page, () => ({ status: 200, body: corpusResponse() }));
    await openPlayground(page);
    // Empty query: submit is disabled and the reason is on screen.
    await expect(page.getByTestId("submit")).toBeDisabled();
    await expect(page.getByTestId("form-issues")).toContainText("query is required");

    await page.getByTestId("query-input").fill("q");
    await page.getByTestId("filter-date-from").fill("2026-01-01");
    await page.getByTestId("filter-date-to").fill("2020-01-01");
    await expect(page.getByTestId("form-issues")).toContainText("date range ends before it starts");
    await expect(page.getByTestId("submit")).toBeDisabled();
    expect(calls).toHaveLength(0);
  });
});

test.describe("retrieval playground — gating", () => {
  test("a clinician gets the standard forbidden state, not the tool", async ({ page }) => {
    await enableDevtools(page);
    await installBaseMocks(page, newCalls(), { roles: ["clinician"] });
    await login(page);
    await page.goto("/#/evidence/dev/retrieval");

    await expect(page.getByTestId("retrieval-playground")).toHaveCount(0);
    await expect(page.locator(".empty, [role=alert]").first()).toBeVisible();
  });

  test("with the flag off the route does not exist at all", async ({ page }) => {
    // No enableDevtools() — and no "forbidden" either: an unknown path, which
    // is what keeps the module invisible rather than merely locked.
    await installBaseMocks(page, newCalls(), { roles: ["tenant_admin"] });
    await login(page);
    await page.goto("/#/evidence/dev/retrieval");

    await expect(page.getByTestId("retrieval-playground")).toHaveCount(0);
    await expect(page.locator(".empty p")).toHaveText("/evidence/dev/retrieval");
  });
});
