// search-expansion.spec.js — FE sprint 15: honest search.
//
// Two promises: the clinician can SEE that «ІМ» quietly became «інфаркт
// міокарда» (and turn it off), and the "how search works" copy comes from the
// server that runs the query — never from strings written in the SPA.
import { test, expect } from "@playwright/test";
import { installBaseMocks, login, newCalls, TEMPLATE_ID } from "./helpers/s15Mocks.js";

const MI_REPORT = {
  id: "44444444-4444-4444-4444-444444444444",
  code: "CARD-001",
  status: "signed",
  title: { uk: "Кардіологічний огляд", en: "Cardiology note" },
  patient_name_redacted: "І. П.",
  template_id: TEMPLATE_ID,
  encounter_date: "2026-07-01",
  updated_at: "2026-07-01T09:30:00Z",
  snippet: "…<mark>інфаркт міокарда</mark> задньої стінки…",
};

const EXPANSIONS = ["інфаркт міокарда", "ГІМ", "гострий інфаркт міокарда", "MI", "myocardial infarction"];

// Fixture tips — deliberately NOT the production wording. The popover must
// render whatever the server says, so changing this text must change the UI.
const TIPS_UK = {
  language: "uk",
  tips: [
    { key: "no_stemming", title: "ФІКСТУРА: точна форма слова", body: "ФІКСТУРА: пошук не відмінює слова." },
    { key: "synonyms", title: "ФІКСТУРА: синоніми", body: "ФІКСТУРА: «ІМ» знайде «інфаркт міокарда»." },
    { key: "filters_and", title: "ФІКСТУРА: фільтри через І", body: "ФІКСТУРА: кожен фільтр звужує список." },
  ],
};

async function installSearch(page, calls, { tips = TIPS_UK } = {}) {
  await page.route("**/v1/search/tips*", async (route) => {
    calls.tips += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tips) });
  });
  await page.route("**/v1/reports/search*", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q");
    const expand = url.searchParams.get("expand");
    calls.search.push({ q, expand, url: url.search });

    // The server expands only when asked to (i.e. not expand=false) and only
    // when the query actually hits a synonym group.
    const expanded = q === "ІМ" && expand !== "false";
    const matches = q ? expanded : true;
    const hits = matches ? [MI_REPORT] : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hits: url.searchParams.get("limit") === "1" ? hits.slice(0, 1) : hits,
        next_cursor: null,
        total_estimated: hits.length,
        total_exact: hits.length,
        expanded_terms: expanded ? EXPANSIONS : [],
      }),
    });
  });
}

async function openReports(page) {
  await login(page);
  await page.goto("/#/dictate/reports");
  await expect(page.getByRole("heading", { name: /Звіти|Reports/ })).toBeVisible({ timeout: 15000 });
}

test("«ІМ» finds the інфаркт міокарда report, with the expansion shown", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls);
  await openReports(page);

  await page.getByPlaceholder(/Пошук пацієнта|Search patient/).fill("ІМ");

  const indicator = page.locator("[data-testid='search-expansion']");
  await expect(indicator).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-testid='search-expansion-terms']")).toContainText("інфаркт міокарда");
  await expect(page.locator("[data-testid='search-expansion-terms']")).toContainText("MI");

  // …and the report the expansion found is on screen.
  await expect(page.locator(".ptable")).toContainText(/Кардіологічний огляд|CARD-001|І. П./);
});

test("the indicator appears ONLY when expansion actually occurred", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls);
  await openReports(page);

  // No query at all → nothing to expand, nothing to claim.
  await expect(page.locator("[data-testid='search-expansion']")).toHaveCount(0);

  // A query the corpus has no synonyms for → expanded_terms: [] → still nothing.
  await page.getByPlaceholder(/Пошук пацієнта|Search patient/).fill("зовсім інше");
  await expect.poll(() => calls.search.filter((s) => s.q === "зовсім інше").length,
    { timeout: 10000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await expect(page.locator("[data-testid='search-expansion']")).toHaveCount(0);
});

test("the toggle round-trips expand=false and says what it did", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls);
  await openReports(page);

  await page.getByPlaceholder(/Пошук пацієнта|Search patient/).fill("ІМ");
  await expect(page.locator("[data-testid='search-expansion']")).toBeVisible({ timeout: 10000 });
  // Default searches never put `expand` on the wire — the server's default is
  // expansion, and a stray expand=true would break pre-S15 backends.
  expect(calls.search.every((s) => s.expand === null)).toBe(true);

  await page.locator("[data-testid='search-exact-toggle']").click();

  await expect.poll(() => calls.search.some((s) => s.expand === "false"), { timeout: 10000 }).toBe(true);
  await expect(page.locator("[data-testid='search-exact-note']")).toBeVisible();
  await expect(page.locator("[data-testid='search-expansion-terms']")).toHaveCount(0);
  await expect(page.locator("[data-testid='search-exact-toggle']")).toHaveAttribute("aria-pressed", "true");

  // Exact search finds nothing, because only the synonym reached the report.
  await expect(page.locator(".ptable")).toContainText(/Звітів не знайдено|No reports found/);

  // …and turning it back on restores both the results and the indicator.
  await page.locator("[data-testid='search-exact-toggle']").click();
  await expect(page.locator("[data-testid='search-expansion-terms']")).toContainText("інфаркт міокарда");
});

test("the tips popover renders the SERVER's copy, not the SPA's", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls);
  await openReports(page);

  // Not fetched until asked for.
  expect(calls.tips).toBe(0);
  await page.locator("[data-testid='search-tips-btn']").click();

  const pop = page.locator("[data-testid='search-tips-pop']");
  await expect(pop).toBeVisible();
  await expect(page.locator("[data-testid='search-tip-no_stemming']")).toContainText("ФІКСТУРА: точна форма слова");
  await expect(page.locator("[data-testid='search-tip-synonyms']")).toContainText("«ІМ» знайде «інфаркт міокарда»");
  await expect(page.locator("[data-testid='search-tip-filters_and']")).toContainText("кожен фільтр звужує список");
  expect(calls.tips).toBe(1);

  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
});

test("change the fixture content and the popover follows it", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls, {
    tips: {
      language: "uk",
      tips: [{ key: "no_stemming", title: "ІНША ФІКСТУРА", body: "Сервер змінив пояснення поведінки пошуку." }],
    },
  });
  await openReports(page);

  await page.locator("[data-testid='search-tips-btn']").click();
  await expect(page.locator("[data-testid='search-tip-no_stemming']")).toContainText("ІНША ФІКСТУРА");
  await expect(page.locator("[data-testid='search-tip-no_stemming']")).toContainText("Сервер змінив пояснення");
  // Nothing from the old fixture survives — the SPA holds no copy of its own.
  await expect(page.locator("[data-testid='search-tips-pop']")).not.toContainText("ФІКСТУРА: точна форма слова");
});

test("an unreachable tips endpoint says so instead of inventing tips", async ({ page }) => {
  const calls = newCalls();
  await installBaseMocks(page, calls);
  await installSearch(page, calls);
  await page.route("**/v1/search/tips*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await openReports(page);

  await page.locator("[data-testid='search-tips-btn']").click();
  await expect(page.locator("[data-testid='search-tips-error']")).toBeVisible();
});
