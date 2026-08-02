// searchExpand.test.js — sprint 15 (ADR-0038): synonym expansion is the
// server's default, so the FE must keep `expand` OFF the wire unless the
// clinician explicitly asked for exact terms. A stray `expand=true` would
// break every pre-S15 backend for no benefit at all.
//   npm run test:unit
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { listReports, expandedTerms, getSearchTips } from "./reports.js";

const realFetch = globalThis.fetch;
let urls = [];

function stub(body = { hits: [], next_cursor: null, total_estimated: 0 }) {
  urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => body,
    };
  };
}

const qs = (i = 0) => new URL(urls[i]).searchParams;

beforeEach(() => stub());
afterEach(() => { globalThis.fetch = realFetch; });

test("the default search never mentions expand", async () => {
  await listReports({ query: "ІМ" });
  assert.equal(qs().get("q"), "ІМ");
  assert.equal(qs().has("expand"), false);
});

test("exact search round-trips expand=false", async () => {
  await listReports({ query: "ІМ", expand: false });
  assert.equal(qs().get("expand"), "false");
});

test("expand:true is still not serialised — it is the server's default", async () => {
  await listReports({ query: "ІМ", expand: true });
  assert.equal(qs().has("expand"), false);
});

test("expanded_terms is read only when the server actually reports one", () => {
  assert.deepEqual(expandedTerms({ expanded_terms: ["інфаркт міокарда", "MI"] }),
    ["інфаркт міокарда", "MI"]);
  assert.deepEqual(expandedTerms({ expanded_terms: [] }), []);
  assert.deepEqual(expandedTerms({}), []);
  assert.deepEqual(expandedTerms(null), []);
  assert.deepEqual(expandedTerms({ expanded_terms: "інфаркт" }), [], "a non-array is not a claim");
});

test("tips are fetched per language, collapsed to the backend's uk|en enum", async () => {
  stub({ language: "uk", tips: [] });
  await getSearchTips("uk");
  assert.equal(qs().get("language"), "uk");
  stub({ language: "en", tips: [] });
  await getSearchTips("de");
  assert.equal(qs().get("language"), "en");
});
