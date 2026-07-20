// Sprint 12 — preferences wire↔UI conversion and quiet-hours validation.
//
// The wire sends a LIST of category rows with top-level timezone; the UI
// wants a keyed map. This is the only place that conversion happens, so
// this is the only place it has to be right.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  browserTimezone,
  fromTimeInput,
  fromWire,
  toTimeInput,
  toWire,
  validateQuietHours,
} from "./prefs.js";
import { ALL_CATEGORIES, EMAIL_MODE } from "./constants.js";

test("a round trip preserves what the user set", () => {
  const wire = {
    categories: ALL_CATEGORIES.map((category) => ({
      category,
      in_app_enabled: category !== "report.amended",
      email_mode: category === "report.signed" ? "immediate" : "off",
      is_default: false,
      digest_eligible: true,
    })),
    timezone: "Europe/Kyiv",
    quiet_hours: { start: "22:00:00", end: "07:00:00" },
    digest_hour: 9,
  };

  const ui = fromWire(wire);
  const back = toWire(ui);

  assert.equal(back.timezone, "Europe/Kyiv");
  assert.equal(back.digest_hour, 9);
  assert.deepEqual(back.quiet_hours, { start: "22:00:00", end: "07:00:00" });

  const signed = back.categories.find((c) => c.category === "report.signed");
  assert.equal(signed.email_mode, "immediate");
  const amended = back.categories.find((c) => c.category === "report.amended");
  assert.equal(amended.in_app_enabled, false, "an explicit false must survive the trip");
});

test("an absent category defaults to in-app on, email off", () => {
  const ui = fromWire({ categories: [], timezone: "UTC", quiet_hours: {}, digest_hour: 8 });
  const back = toWire(ui);
  for (const row of back.categories) {
    assert.equal(row.in_app_enabled, true);
    assert.equal(row.email_mode, EMAIL_MODE.OFF);
  }
});

test("a malformed or empty view does not throw", () => {
  const ui = fromWire(null);
  assert.deepEqual(ui.matrix, {});
  assert.ok(ui.timezone, "falls back to a browser guess");
  assert.equal(ui.digestHour, 8);
});

test("is_default and digest_eligible are carried through for the UI to render", () => {
  const ui = fromWire({
    categories: [
      {
        category: "report.signed",
        in_app_enabled: true,
        email_mode: "immediate",
        is_default: true,
        digest_eligible: false,
      },
    ],
    timezone: "UTC",
    quiet_hours: {},
    digest_hour: 8,
  });
  assert.equal(ui.matrix["report.signed"].isDefault, true);
  assert.equal(ui.matrix["report.signed"].digestEligible, false);
});

// ── time normalisation ──────────────────────────────────────────────

test("HH:MM:SS from the wire renders in an HH:MM time input", () => {
  assert.equal(toTimeInput("22:00:00"), "22:00");
  assert.equal(toTimeInput(null), "");
  assert.equal(toTimeInput(""), "");
});

test("an HH:MM input is sent back as HH:MM:SS", () => {
  assert.equal(fromTimeInput("07:30"), "07:30:00");
  assert.equal(fromTimeInput(""), null);
});

test("a time round trip is stable", () => {
  assert.equal(fromTimeInput(toTimeInput("22:15:00")), "22:15:00");
});

// ── quiet-hours validation ──────────────────────────────────────────

test("no quiet hours at all is valid — the feature is optional", () => {
  assert.equal(validateQuietHours({ start: null, end: null }), null);
});

test("a half-filled window is rejected before it can 422", () => {
  // The backend CHECK requires the pair; catching it here gives a
  // field-level message instead of a generic server error.
  assert.equal(validateQuietHours({ start: "22:00:00", end: null }), "incomplete");
  assert.equal(validateQuietHours({ start: null, end: "07:00:00" }), "incomplete");
});

test("a zero-width window is rejected", () => {
  // The backend treats start === end as "never quiet", so saving it
  // would look set but do nothing — a silent no-op the user cannot see.
  assert.equal(validateQuietHours({ start: "09:00:00", end: "09:00:00" }), "zero_width");
});

test("a normal overnight window is valid", () => {
  assert.equal(validateQuietHours({ start: "22:00:00", end: "07:00:00" }), null);
});

test("a half-filled window is normalised to disabled on the wire", () => {
  const body = toWire({
    matrix: {},
    quietHours: { start: "22:00:00", end: null },
    timezone: "UTC",
    digestHour: 8,
  });
  assert.deepEqual(body.quiet_hours, {});
});

test("browserTimezone always returns something usable", () => {
  const tz = browserTimezone();
  assert.equal(typeof tz, "string");
  assert.ok(tz.length > 0);
});
