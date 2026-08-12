// csp.test.js — the policy's invariants, as assertions.
//
// A CSP is easy to write and easy to quietly ruin: one `'unsafe-inline'` added
// to unbreak a screen and the whole sprint-02 auth design goes back to resting
// on nothing. These tests are the tripwire on that, and on the two properties
// the emitted deployment configs depend on — that the policy is derived from
// the service map, and that it is byte-stable.

import test from "node:test";
import assert from "node:assert/strict";

import {
  cspDirectives,
  cspModeFrom,
  securityHeaders,
  serializeCsp,
  serviceOrigins,
  socketOrigins,
  PERMISSIONS_POLICY,
} from "./csp.js";
import { resolveServices } from "../api/services.js";
import { infraOrigins } from "../company/infra.js";
import { leadOrigins } from "../api/leads.js";

const DEV = resolveServices({});
const PROD = resolveServices({
  VITE_AUTH_SERVICE_URL: "https://app.klarnote.example",
  VITE_ASR_SERVICE_URL: "https://app.klarnote.example",
  VITE_DICTATION_SERVICE_URL: "https://app.klarnote.example",
  VITE_NLP_SERVICE_URL: "https://app.klarnote.example",
  VITE_REPORT_SERVICE_URL: "https://app.klarnote.example",
  VITE_AUTOCOMPLETE_SERVICE_URL: "https://app.klarnote.example",
  VITE_SIGNING_SERVICE_URL: "https://app.klarnote.example",
  VITE_CORE_SERVICE_URL: "https://app.klarnote.example",
  VITE_NOTIFICATION_SERVICE_URL: "https://app.klarnote.example",
  VITE_GENERATION_SERVICE_URL: "https://app.klarnote.example",
  VITE_EVIDENCE_RETRIEVAL_URL: "https://app.klarnote.example",
  VITE_EVIDENCE_ANSWER_URL: "https://app.klarnote.example",
  VITE_EVIDENCE_WEBSEARCH_URL: "https://app.klarnote.example",
  // marketing-service too. It is unauthenticated and public, which is exactly
  // why it must be listed: left out, `resolveServices` falls back to its
  // localhost default and the "collapses to one origin" assertion below finds
  // http://localhost:8012 in a production policy.
  VITE_MARKETING_SERVICE_URL: "https://app.klarnote.example",
});

// ── the non-negotiables ────────────────────────────────────────────────

test("no directive ever admits unsafe-inline, unsafe-eval or a wildcard", () => {
  for (const services of [DEV, PROD]) {
    const header = serializeCsp(cspDirectives(services));
    for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "*"]) {
      assert.ok(
        !header.includes(forbidden),
        `policy contains ${forbidden}: ${header}`,
      );
    }
  }
});

test("the directives that stop an injected document taking over are all present", () => {
  const d = cspDirectives(DEV);
  assert.deepEqual(d["default-src"], ["'self'"]);
  assert.deepEqual(d["script-src"], ["'self'"]);
  assert.deepEqual(d["style-src"], ["'self'"]);
  assert.deepEqual(d["object-src"], ["'none'"]);
  assert.deepEqual(d["frame-ancestors"], ["'none'"]);
  assert.deepEqual(d["base-uri"], ["'self'"]);
  assert.deepEqual(d["form-action"], ["'self'"]);
  assert.deepEqual(d["worker-src"], ["'none'"]);
});

test("fonts are self-hosted — no third-party origin survives anywhere", () => {
  const header = serializeCsp(cspDirectives(DEV));
  for (const host of ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.", "unpkg", "jsdelivr"]) {
    assert.ok(!header.includes(host), `policy names a third party: ${host}`);
  }
});

// ── derived from the service map, not from a second list ───────────────

test("connect-src covers every service base the fetch clients use", () => {
  const d = cspDirectives(DEV);
  const connect = d["connect-src"].join(" ");
  for (const [name, url] of Object.entries(DEV)) {
    if (!url) continue; // evidenceChat is legitimately blank
    assert.ok(connect.includes(new URL(url).origin), `${name} (${url}) missing from connect-src`);
  }
});

test("the dictation and notification sockets are in connect-src as ws origins", () => {
  const connect = cspDirectives(DEV)["connect-src"];
  assert.ok(connect.includes("ws://localhost:8002"), "dictation socket missing");
  assert.ok(connect.includes("ws://localhost:8004"), "notification socket missing");
});

test("an https deployment gets wss sockets, never a bare ws:", () => {
  const connect = cspDirectives(PROD)["connect-src"].join(" ");
  assert.ok(connect.includes("wss://app.klarnote.example"), connect);
  assert.ok(!/\bws:\/\//.test(connect), `plaintext socket in an https policy: ${connect}`);
});

test("a same-origin gateway collapses the policy to one origin", () => {
  // The production topology puts every service behind one host. The policy
  // must not then list thirteen copies of it.
  assert.deepEqual(serviceOrigins(PROD), ["https://app.klarnote.example"]);
  assert.deepEqual(socketOrigins(PROD), ["wss://app.klarnote.example"]);
});

test("a blank service base contributes nothing", () => {
  // evidenceChat defaults to "" — the module answers from fixtures. An empty
  // string must not become an empty token, which would break the whole header.
  assert.equal(DEV.evidenceChat, "");
  const header = serializeCsp(cspDirectives(DEV));
  assert.ok(!/\s{2}/.test(header), `double space (empty token) in: ${header}`);
  assert.ok(!header.includes("; connect-src 'self';"), "connect-src lost its origins");
});

test("a configured evidence-chat base is admitted", () => {
  const s = resolveServices({ VITE_EVIDENCE_CHAT_URL: "https://chat.evidenz.example/api" });
  assert.ok(cspDirectives(s)["connect-src"].includes("https://chat.evidenz.example"));
});

// ── the origins that are reached but are not services ──────────────────

test("the owner console's infra probe is admitted, from the same registry it links to", () => {
  // The probe is a cross-origin `no-cors` fetch whose ONLY signal is whether
  // the promise resolved. A policy that omits these origins therefore does not
  // just block the probe — it makes the console report healthy containers as
  // dead, which is worse than showing nothing. Regression cover for exactly
  // that: e2e/company-console.spec.js caught it the first time.
  const infra = infraOrigins({});
  const connect = cspDirectives(DEV, { extraConnect: infra })["connect-src"];
  for (const origin of infra) assert.ok(connect.includes(origin), `${origin} missing`);
  assert.ok(connect.includes("http://localhost:3001"), "grafana");
  assert.ok(connect.includes("https://localhost:8443"), "public-edge (self-signed, still probed)");
});

test("the signup form's CRM endpoint is admitted only where it is configured", () => {
  // The lead submission is a cross-origin POST to HubSpot (src/api/leads.js).
  // A policy that omits the origin does not degrade the public signup form —
  // it blocks every lead, with nothing but a console entry to say so. And an
  // origin nothing talks to must not be advertised, hence the empty case.
  assert.deepEqual(leadOrigins({}), [], "no portal configured, no widening");
  const hs = leadOrigins({ VITE_HUBSPOT_PORTAL_ID: "1234567", VITE_HUBSPOT_FORM_GUID: "a1b2" });
  const connect = cspDirectives(DEV, { extraConnect: hs })["connect-src"];
  assert.ok(connect.includes("https://api.hsforms.com"));
});

test("extra connect origins widen ONLY connect-src", () => {
  const evil = "https://elsewhere.example";
  const d = cspDirectives(DEV, { extraConnect: [evil] });
  assert.ok(d["connect-src"].includes(evil));
  // An origin that may be pinged is not an origin that may serve script,
  // style, media or a frame.
  for (const name of ["script-src", "style-src", "img-src", "media-src", "frame-src", "font-src", "default-src"]) {
    assert.ok(!d[name].includes(evil), `${name} was widened`);
  }
});

test("extra origins are deduped, sorted and never empty tokens", () => {
  const d = cspDirectives(DEV, { extraConnect: ["https://b.example", "https://a.example", "https://b.example", "", null] });
  const connect = d["connect-src"];
  assert.equal(connect.filter((s) => s === "https://b.example").length, 1);
  assert.ok(connect.indexOf("https://a.example") < connect.indexOf("https://b.example"));
  assert.ok(!serializeCsp(d).includes("  "), "an empty token would break the header");
});

test("an infra host moved by env moves in the policy", () => {
  const moved = infraOrigins({ VITE_INFRA_GRAFANA: "https://grafana.internal.example" });
  assert.ok(moved.includes("https://grafana.internal.example"));
  assert.ok(!moved.includes("http://localhost:3001"));
});

test("frame-src carries the service origins — ApiDocsPage iframes {base}/docs", () => {
  const d = cspDirectives(DEV);
  assert.ok(d["frame-src"].includes("http://localhost:8000"));
  // …but never a socket: a ws: origin in frame-src is meaningless noise.
  assert.ok(!d["frame-src"].some((s) => s.startsWith("ws")));
});

// ── the resources the product actually needs ───────────────────────────

test("blob: is allowed exactly where the app mints object URLs", () => {
  const d = cspDirectives(DEV);
  // Audio replay fetches clips WITH the bearer and hands <audio> a blob URL.
  assert.ok(d["media-src"].includes("blob:"));
  // Tenant logos arrive the same way; data: covers canvas exports.
  assert.ok(d["img-src"].includes("blob:"));
  assert.ok(d["img-src"].includes("data:"));
  // But nothing else gets to be a blob.
  assert.ok(!d["script-src"].includes("blob:"), "blob: script would be an XSS sink");
  assert.ok(!d["default-src"].includes("blob:"));
});

test("the microphone is granted and every other capability denied", () => {
  assert.ok(PERMISSIONS_POLICY.includes("microphone=(self)"), "dictation needs the mic");
  for (const denied of ["camera=()", "geolocation=()", "payment=()", "usb=()", "display-capture=()"]) {
    assert.ok(PERMISSIONS_POLICY.includes(denied), `${denied} missing`);
  }
});

// ── header assembly ────────────────────────────────────────────────────

test("enforce, report-only and off pick the right header (or none)", () => {
  const enforce = securityHeaders({ services: DEV, mode: "enforce" });
  assert.ok(enforce["Content-Security-Policy"]);
  assert.ok(!enforce["Content-Security-Policy-Report-Only"]);

  const report = securityHeaders({ services: DEV, mode: "report-only" });
  assert.ok(report["Content-Security-Policy-Report-Only"]);
  assert.ok(!report["Content-Security-Policy"]);
  // The rollout must be measuring the SAME policy it will later enforce.
  assert.equal(report["Content-Security-Policy-Report-Only"], enforce["Content-Security-Policy"]);

  const off = securityHeaders({ services: DEV, mode: "off" });
  assert.ok(!off["Content-Security-Policy"]);
  assert.ok(!off["Content-Security-Policy-Report-Only"]);
  // …but the non-CSP headers are not a rollout concern and stay on.
  assert.equal(off["X-Content-Type-Options"], "nosniff");
});

test("the companion headers are all set", () => {
  const h = securityHeaders({ services: DEV });
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
});

test("HSTS is opt-in — never sent by the dev or preview server", () => {
  assert.ok(!securityHeaders({ services: DEV })["Strict-Transport-Security"]);
  assert.match(
    securityHeaders({ services: PROD, hsts: true })["Strict-Transport-Security"],
    /max-age=31536000/,
  );
});

test("report-uri appears only when configured", () => {
  assert.ok(!serializeCsp(cspDirectives(DEV)).includes("report-uri"));
  assert.ok(
    serializeCsp(cspDirectives(DEV, { reportUri: "https://csp.example/r" }))
      .includes("report-uri https://csp.example/r"),
  );
});

test("the mode defaults to enforcement and rejects a typo", () => {
  assert.equal(cspModeFrom({}), "enforce");
  assert.equal(cspModeFrom({ VITE_CSP_MODE: "report-only" }), "report-only");
  assert.equal(cspModeFrom({ VITE_CSP_MODE: "REPORT-ONLY" }), "report-only");
  assert.equal(cspModeFrom({ VITE_CSP_MODE: "off" }), "off");
  // A misspelt flag must fail CLOSED — an operator typing "reportonly" gets
  // enforcement, not an unprotected app.
  assert.equal(cspModeFrom({ VITE_CSP_MODE: "reportonly" }), "enforce");
  assert.equal(cspModeFrom({ VITE_CSP_MODE: "" }), "enforce");
});

test("the header is byte-stable across calls", () => {
  // The emitted _headers / nginx configs are committed to a deployment and
  // diffed by humans; a set-iteration reshuffle would make every build noise.
  assert.equal(serializeCsp(cspDirectives(DEV)), serializeCsp(cspDirectives(DEV)));
});
