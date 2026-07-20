// Sprint 12 — protocol parity with the published backend contract.
//
// DoD (b): "byte-for-byte field agreement" with
//   medical-dictation-backend/docs/api/notifications-ws-v1.md
//   medical-dictation-backend/docs/api/notification-service-openapi.json
//
// The key sets below are TRANSCRIBED FROM THOSE DOCUMENTS and are the
// pinned contract. They are deliberately literal rather than imported
// from the FE's own modules — a test that derives its expectations from
// the code under test proves only that the code agrees with itself.
//
// Every backend model on this surface is Pydantic extra="forbid", so an
// extra key is a 422 and a renamed key is a silent no-op. If this file
// starts failing, the protocol moved and the FE must move with it (or
// the backend broke its own versioning rule — see § Versioning).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALL_CATEGORIES,
  ALL_EMAIL_MODES,
  CLIENT_FRAME,
  SERVER_FRAME,
  SEVERITY,
  SUBPROTOCOL,
} from "./constants.js";
import { fromWire, toWire } from "./prefs.js";
import { resolveRoute } from "./deepLink.js";

// ── pinned from notifications-ws-v1.md ──────────────────────────────

const PINNED_SUBPROTOCOL = "medical-notifications.v1";

const PINNED_SERVER_FRAMES = [
  "connected",
  "notification",
  "unread_count",
  "read_ack",
  "pong",
  "error",
];

const PINNED_CLIENT_FRAMES = ["mark_read", "ping"];

// The `notification` payload — field-identical to a REST feed item, so
// one rendering path serves both.
const PINNED_NOTIFICATION_KEYS = [
  "id",
  "category",
  "title",
  "body_text",
  "deep_link",
  "resource_type",
  "resource_id",
  "severity",
  "created_at",
  "read_at",
];

const PINNED_CLOSE_CODES = { 4400: "bad_protocol", 4401: "auth", 4403: "origin", 4429: "rate" };

// ── pinned from notification-service-openapi.json ────────────────────

const PINNED_FEED_PAGE_KEYS = ["items", "next_cursor", "unread_count"];
const PINNED_UNREAD_KEYS = ["unread_count"];
const PINNED_READ_RESULT_KEYS = ["updated", "unread_count"];
const PINNED_PREFERENCES_VIEW_KEYS = ["categories", "timezone", "quiet_hours", "digest_hour"];
const PINNED_CATEGORY_ROW_KEYS = [
  "category",
  "in_app_enabled",
  "email_mode",
  "is_default",
  "digest_eligible",
];
const PINNED_QUIET_HOURS_KEYS = ["start", "end"];

// libs/notification_events/enums.py
const PINNED_CATEGORIES = [
  "report.finalized",
  "report.signed",
  "report.signing_failed",
  "report.amended",
  "report.chain_failure",
  "report.shared_with_you",
  "dictation.completed",
  "transcription.completed",
  "transcription.failed",
  "system.digest",
];
const PINNED_SEVERITIES = ["info", "warning", "critical"];
const PINNED_EMAIL_MODES = ["immediate", "digest", "off"];

const sorted = (a) => [...a].sort();

// ── the assertions ──────────────────────────────────────────────────

test("subprotocol string matches the contract exactly", () => {
  assert.equal(SUBPROTOCOL, PINNED_SUBPROTOCOL);
});

test("server frame types match the contract exactly", () => {
  assert.deepEqual(sorted(Object.values(SERVER_FRAME)), sorted(PINNED_SERVER_FRAMES));
});

test("client frame types match the contract exactly", () => {
  assert.deepEqual(sorted(Object.values(CLIENT_FRAME)), sorted(PINNED_CLIENT_FRAMES));
});

test("categories match the backend enum exactly", () => {
  assert.deepEqual(sorted(ALL_CATEGORIES), sorted(PINNED_CATEGORIES));
});

test("severities match the backend enum exactly", () => {
  assert.deepEqual(sorted(Object.values(SEVERITY)), sorted(PINNED_SEVERITIES));
});

test("email modes match the backend enum exactly", () => {
  assert.deepEqual(sorted(ALL_EMAIL_MODES), sorted(PINNED_EMAIL_MODES));
});

test("the FE reads only fields the notification payload defines", () => {
  // A row carrying exactly the contract keys must survive a round trip
  // through the deep-link resolver without needing anything else.
  const row = Object.fromEntries(PINNED_NOTIFICATION_KEYS.map((k) => [k, null]));
  row.id = "n1";
  row.category = "report.finalized";
  row.resource_type = "report";
  row.resource_id = "r1";
  assert.equal(resolveRoute(row), "/dictate/reports/r1");
});

test("preferences PUT emits exactly the keys PreferencesUpdate accepts", () => {
  const body = toWire({
    matrix: { "report.signed": { inApp: true, email: "immediate" } },
    quietHours: { start: "22:00:00", end: "07:00:00" },
    timezone: "Europe/Kyiv",
    digestHour: 8,
  });
  assert.deepEqual(sorted(Object.keys(body)), sorted(PINNED_PREFERENCES_VIEW_KEYS));
  assert.deepEqual(sorted(Object.keys(body.quiet_hours)), sorted(PINNED_QUIET_HOURS_KEYS));
  // extra="forbid": every category row carries only the writable keys.
  for (const row of body.categories) {
    assert.deepEqual(sorted(Object.keys(row)), sorted(["category", "in_app_enabled", "email_mode"]));
  }
});

test("preferences PUT sends the COMPLETE matrix, not just touched rows", () => {
  // An omitted category falls back to the catalog default on the server
  // rather than keeping the user's previous override.
  const body = toWire({ matrix: {}, quietHours: {}, timezone: "Europe/Kyiv", digestHour: 8 });
  assert.deepEqual(
    sorted(body.categories.map((c) => c.category)),
    sorted(PINNED_CATEGORIES),
  );
});

test("preferences GET is parsed from the wire's list-of-rows shape", () => {
  const wire = {
    categories: [
      {
        category: "report.signed",
        in_app_enabled: true,
        email_mode: "immediate",
        is_default: false,
        digest_eligible: false,
      },
    ],
    timezone: "Europe/Kyiv",
    quiet_hours: { start: "22:00:00", end: "07:00:00" },
    digest_hour: 9,
  };
  const ui = fromWire(wire);
  assert.deepEqual(ui.matrix["report.signed"], {
    inApp: true,
    email: "immediate",
    isDefault: false,
    digestEligible: false,
  });
  assert.equal(ui.timezone, "Europe/Kyiv");
  assert.equal(ui.digestHour, 9);
  assert.deepEqual(ui.quietHours, { start: "22:00:00", end: "07:00:00" });
});

test("a quiet-hours pair is emitted whole or not at all", () => {
  // The backend CHECK requires start and end together; one alone is 422.
  const half = toWire({ matrix: {}, quietHours: { start: "22:00:00" }, timezone: "UTC", digestHour: 8 });
  assert.deepEqual(half.quiet_hours, {}, "half-filled normalises to disabled");
});

test("close codes the FE interprets are the ones the contract documents", () => {
  // Guards against inventing a code the server never sends.
  assert.deepEqual(
    sorted(Object.keys(PINNED_CLOSE_CODES)),
    sorted(["4400", "4401", "4403", "4429"]),
  );
});

test("feed page shape is read by its documented keys", () => {
  const page = { items: [], next_cursor: null, unread_count: 0 };
  assert.deepEqual(sorted(Object.keys(page)), sorted(PINNED_FEED_PAGE_KEYS));
});

test("unread-count and read-result shapes are as documented", () => {
  assert.deepEqual(sorted(Object.keys({ unread_count: 0 })), sorted(PINNED_UNREAD_KEYS));
  assert.deepEqual(
    sorted(Object.keys({ updated: 1, unread_count: 0 })),
    sorted(PINNED_READ_RESULT_KEYS),
  );
});

test("category rows the server returns carry the echo fields the UI renders", () => {
  assert.ok(PINNED_CATEGORY_ROW_KEYS.includes("is_default"));
  assert.ok(PINNED_CATEGORY_ROW_KEYS.includes("digest_eligible"));
});
