// Sprint 12 — deep-link resolution and the unknown-type degrade.
//
// FE spec §5: "each category routes to the correct view; unknown
// resource type degrades without crashing". A notification for a
// resource a FUTURE backend adds must not break an older client's panel.
//
// The routes asserted here are checked against App.jsx's router by the
// last test in this file — a route the router does not know sends the
// user to the 404 page, which is the bug these tests exist to prevent.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isResolvable, resolveRoute } from "./deepLink.js";
import { CATEGORY } from "./constants.js";

const N = (over) => ({
  id: "n1",
  category: CATEGORY.REPORT_FINALIZED,
  resource_type: "report",
  resource_id: "r-1",
  ...over,
});

test("a finalized report routes to the report view", () => {
  assert.equal(resolveRoute(N()), "/dictate/reports/r-1");
});

test("signing outcomes route to the report — this SPA signs in a modal", () => {
  assert.equal(
    resolveRoute(N({ category: CATEGORY.REPORT_SIGNED })),
    "/dictate/reports/r-1",
  );
  assert.equal(
    resolveRoute(N({ category: CATEGORY.REPORT_SIGNING_FAILED })),
    "/dictate/reports/r-1",
  );
});

test("an amendment routes to the report", () => {
  assert.equal(resolveRoute(N({ category: CATEGORY.REPORT_AMENDED })), "/dictate/reports/r-1");
});

test("a chain failure routes to the report it concerns", () => {
  assert.equal(
    resolveRoute(N({ category: CATEGORY.REPORT_CHAIN_FAILURE })),
    "/dictate/reports/r-1",
  );
});

test("the digest routes to the feed itself, not a resource", () => {
  assert.equal(
    resolveRoute(N({ category: CATEGORY.SYSTEM_DIGEST, resource_type: "", resource_id: null })),
    "/notifications",
  );
});

test("a completed dictation routes to the dictate landing", () => {
  // The session id addresses a dictation_sessions row, not a view. The
  // backend's own deep_link says /dictations/{id}, which this SPA has no
  // route for — resolving locally is what keeps that from being a 404.
  assert.equal(
    resolveRoute(
      N({ category: CATEGORY.DICTATION_COMPLETED, resource_type: "dictation_session", resource_id: "s-1" }),
    ),
    "/dictate",
  );
});

test("a finished ASR job routes to the jobs list", () => {
  assert.equal(
    resolveRoute(
      N({ category: CATEGORY.TRANSCRIPTION_COMPLETED, resource_type: "transcription_job", resource_id: "j-1" }),
    ),
    "/asr/jobs",
  );
  assert.equal(
    resolveRoute(
      N({ category: CATEGORY.TRANSCRIPTION_FAILED, resource_type: "transcription_job", resource_id: "j-1" }),
    ),
    "/asr/jobs",
  );
});

test("an unknown resource type degrades to null rather than guessing", () => {
  const route = resolveRoute(N({ resource_type: "spaceship", resource_id: "x" }));
  assert.equal(route, null);
  assert.equal(isResolvable(N({ resource_type: "spaceship" })), false);
});

test("an encounter degrades: it is only viewable inside its patient's record", () => {
  // The notification carries no patient id, so there is nothing to route
  // to. A visible "cannot open" beats a 404.
  assert.equal(resolveRoute(N({ resource_type: "encounter", resource_id: "e-1" })), null);
});

test("a missing resource id degrades to null", () => {
  assert.equal(resolveRoute(N({ resource_id: null })), null);
});

test("a null notification does not throw", () => {
  assert.equal(resolveRoute(null), null);
  assert.equal(resolveRoute(undefined), null);
});

test("resource ids are URL-encoded into the route", () => {
  const route = resolveRoute(N({ resource_id: "a/b?c" }));
  assert.equal(route, "/dictate/reports/a%2Fb%3Fc");
  assert.ok(!route.includes("?c"), "an unescaped id would corrupt the hash route");
});

test("we resolve locally rather than following the server's absolute deep_link", () => {
  // deep_link is built from the backend's MDX_APP_BASE_URL, which can
  // point at a different origin than the running SPA.
  const item = N({ deep_link: "https://staging.example/reports/r-1" });
  assert.equal(resolveRoute(item), "/dictate/reports/r-1", "stays inside this SPA");
});

test("every route we hand out is one the router actually handles", () => {
  // The original bug: resolveRoute returned /reports/{id}, which no branch
  // of App.jsx matches, so every notification click landed on Page not
  // found. Assert the prefixes exist rather than trusting a comment.
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const routes = [
    resolveRoute(N()),
    resolveRoute(N({ resource_type: "patient" })),
    resolveRoute(N({ category: CATEGORY.SYSTEM_DIGEST, resource_id: null })),
  ];
  for (const route of routes) {
    // e.g. "/dictate/reports/r-1" → the router matches on "/dictate/reports/"
    const prefix = route.replace(/[^/]+$/, "");
    const handled =
      app.includes(`startsWith("${prefix}")`) ||
      app.includes(`r === "${route}"`) ||
      app.includes(`=== "${route}"`);
    assert.ok(handled, `App.jsx has no branch for ${route}`);
  }
});
