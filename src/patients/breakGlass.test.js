// breakGlass.test.js — privileged patient access is deliberate, and stays
// visibly so.
//
//   node --test src/patients/breakGlass.test.js
//
// Defect 2 of the 2026-08-09 clinical-governance hotfix. The S14/S15 flow
// already stopped the render on a 403 and demanded a reason before minting a
// grant. What it did not do is keep saying so afterwards: once the grant
// existed, the record rendered exactly like one the viewer was entitled to.
//
// Three things are pinned here:
//   · the session memory of an episode (pure — breakGlass.js);
//   · the standing banner, RENDERED, naming the reason;
//   · the compliance view, which must offer no way to take the log out.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  rememberBreakGlass, activeBreakGlass, activeBreakGlassList, forgetBreakGlass,
  clearBreakGlass, minutesLeft, bgKey, BG_KEY, DEFAULT_TTL_MINUTES,
} from "./breakGlass.js";
import { ROLES, renderAs, h } from "../testing/renderRole.mjs";

const { BreakGlassBanner } = await import("./BreakGlassBanner.jsx");

// A sessionStorage stand-in. Also used to prove the module survives a storage
// that throws, which is a real browser state (private mode, quota).
const memStore = (seed) => {
  const map = new Map(seed ? [[BG_KEY, seed]] : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    raw: () => map.get(BG_KEY),
  };
};
const brokenStore = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};

const T0 = Date.UTC(2026, 7, 9, 12, 0, 0);
// Who broke the glass. Two accounts, because sessionStorage is scoped to the
// TAB and both of them sign in through it over a working day.
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const DOCTOR = "00000000-0000-4000-8000-0000000000d0";
const EPISODE = {
  subject: ADMIN,
  kind: "patient", id: "pat-1",
  reasonCode: "care_continuity",
  reasonLabel: "Безперервність надання допомоги",
  note: "Підміняю д-ра К. на час відпустки",
  ttlMinutes: 60,
};
// The reader's half of the same fixture.
const asAdmin = (now) => ({ now, subject: ADMIN });

// ── the session memory ─────────────────────────────────────────────────

test("an episode is remembered against the resource it was opened on", () => {
  const st = memStore();
  const entry = rememberBreakGlass(st, { ...EPISODE, now: T0 });
  assert.equal(entry.reasonCode, "care_continuity");
  assert.equal(entry.expiresAt, T0 + 60 * 60_000);

  const live = activeBreakGlass(st, "patient", "pat-1", asAdmin(T0 + 60_000));
  assert.equal(live.reasonLabel, EPISODE.reasonLabel);
  assert.equal(live.note, EPISODE.note);
});

test("a grant on one patient says nothing about another", () => {
  // The banner must not follow the viewer around the roster.
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  assert.equal(activeBreakGlass(st, "patient", "pat-2", asAdmin(T0)), null);
  assert.equal(activeBreakGlass(st, "report", "pat-1", asAdmin(T0)), null);
});

test("an expired episode stops claiming to be one", () => {
  // The server has already stopped honouring the grant; a banner still saying
  // "you are inside on an exception" would describe a door that closed.
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  assert.ok(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0 + 59 * 60_000)));
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0 + 60 * 60_000)), null);
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0 + 61 * 60_000)), null);
});

// ── an episode belongs to the account that opened it ───────────────────

test("one account's episode is never another's banner", () => {
  // THE defect (2026-08-09). sessionStorage is scoped to the tab, not to the
  // session: an administrator broke glass on a patient, signed out, and the
  // clinician who signed in next was told — on their own patient, which they
  // hold standing access to — that they were inside on an exception being
  // counted. A false statement about an audit control is worse than none: it
  // teaches people that the banner means nothing.
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  assert.ok(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0)), "the admin sees their own");
  assert.equal(
    activeBreakGlass(st, "patient", "pat-1", { now: T0, subject: DOCTOR }), null,
    "the next account inherits nothing");
  assert.deepEqual(activeBreakGlassList(st, { now: T0, subject: DOCTOR }), []);
});

test("an unidentified reader is not an owner", () => {
  // No claims yet, or claims without a `sub`: there is nobody to be the owner
  // of an episode, so there is no episode to show.
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  for (const subject of [undefined, null, "", 0]) {
    assert.equal(activeBreakGlass(st, "patient", "pat-1", { now: T0, subject }), null, String(subject));
  }
  assert.equal(activeBreakGlass(st, "patient", "pat-1"), null, "no options at all");
});

test("an episode nobody can be named for is not recorded", () => {
  const st = memStore();
  assert.equal(rememberBreakGlass(st, { ...EPISODE, subject: undefined, now: T0 }), null);
  assert.equal(st.raw(), undefined, "nothing was written");
});

test("a new owner starts a clean sheet rather than joining the old one", () => {
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, id: "pat-1", now: T0 });
  rememberBreakGlass(st, { ...EPISODE, subject: DOCTOR, id: "pat-9", now: T0 });
  const mine = activeBreakGlassList(st, { now: T0, subject: DOCTOR });
  assert.deepEqual(mine.map((e) => e.id), ["pat-9"], "only the new owner's own");
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0)), null,
    "and the previous owner's episodes are gone, not hidden");
});

test("signing out takes the episode with it", () => {
  // Owner-scoping already means the next account sees nothing; this is the
  // second lock. An episode names a patient and a stated reason, and a shared
  // clinic workstation is exactly where it must not be left lying.
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  clearBreakGlass(st);
  assert.equal(st.raw(), undefined);
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0)), null);
  assert.doesNotThrow(() => clearBreakGlass(brokenStore));
  assert.doesNotThrow(() => clearBreakGlass(null));
});

test("a missing or absurd TTL falls back rather than granting forever", () => {
  const st = memStore();
  for (const ttlMinutes of [undefined, null, 0, -5, NaN, "60"]) {
    const e = rememberBreakGlass(st, { ...EPISODE, ttlMinutes, now: T0 });
    assert.equal(e.expiresAt, T0 + DEFAULT_TTL_MINUTES * 60_000, String(ttlMinutes));
  }
});

test("an episode without a reason is not an episode", () => {
  const st = memStore();
  assert.equal(rememberBreakGlass(st, { subject: ADMIN, kind: "patient", id: "p", now: T0 }), null);
  assert.equal(rememberBreakGlass(st, { ...EPISODE, kind: null, now: T0 }), null);
  assert.equal(rememberBreakGlass(st, { ...EPISODE, id: null, now: T0 }), null);
  assert.equal(st.raw(), undefined, "nothing was written");
});

test("a revoked grant can be forgotten", () => {
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, now: T0 });
  forgetBreakGlass(st, "patient", "pat-1");
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0)), null);
});

test("the live list is every open episode, newest first", () => {
  const st = memStore();
  rememberBreakGlass(st, { ...EPISODE, id: "pat-1", now: T0 });
  rememberBreakGlass(st, { ...EPISODE, id: "pat-2", now: T0 + 1000 });
  rememberBreakGlass(st, { ...EPISODE, id: "pat-3", ttlMinutes: 1, now: T0 });
  const live = activeBreakGlassList(st, asAdmin(T0 + 2 * 60_000));
  assert.deepEqual(live.map((e) => e.id), ["pat-2", "pat-1"], "the 1-minute one has lapsed");
});

test("a blocked storage costs the banner, never the gate", () => {
  // Private mode, a full quota, a hostile extension: none of these may throw
  // out of a render path. The data stays closed either way — the SERVER holds
  // the grant; this module only remembers that one was minted.
  assert.doesNotThrow(() => rememberBreakGlass(brokenStore, { ...EPISODE, now: T0 }));
  assert.equal(activeBreakGlass(brokenStore, "patient", "pat-1", asAdmin(T0)), null);
  assert.deepEqual(activeBreakGlassList(brokenStore, asAdmin(T0)), []);
  assert.equal(activeBreakGlass(null, "patient", "pat-1", asAdmin(T0)), null);
});

test("corrupt storage reads as no episode, not as a crash", () => {
  // Including the v1 shape — a flat map with no owner, left in a tab that was
  // open across the upgrade. It belonged to nobody nameable, so it is nobody's.
  const V1 = JSON.stringify({ "patient:pat-1": { kind: "patient", id: "pat-1", expiresAt: T0 + 60_000 } });
  for (const junk of ["{", "null", "[]", '"nope"', "7", V1]) {
    const st = memStore(junk);
    assert.equal(activeBreakGlass(st, "patient", "pat-1", asAdmin(T0)), null, junk);
  }
});

test("the justification is bounded so a pasted essay cannot fill storage", () => {
  const st = memStore();
  const e = rememberBreakGlass(st, { ...EPISODE, note: "x".repeat(5000), now: T0 });
  assert.equal(e.note.length, 500);
});

test("bgKey is stable and kind-scoped", () => {
  assert.equal(bgKey("patient", "p1"), "patient:p1");
  assert.notEqual(bgKey("patient", "p1"), bgKey("report", "p1"));
});

test("minutesLeft counts down and never goes negative", () => {
  const e = { expiresAt: T0 + 60 * 60_000 };
  assert.equal(minutesLeft(e, T0), 60);
  assert.equal(minutesLeft(e, T0 + 30 * 60_000), 30);
  assert.equal(minutesLeft(e, T0 + 90 * 60_000), 0);
  assert.equal(minutesLeft(null, T0), 0);
});

// ── the standing banner, rendered ──────────────────────────────────────

test("the banner names the reason back to the person", () => {
  const entry = rememberBreakGlass(memStore(), { ...EPISODE, now: Date.now() });
  const markup = renderAs(ROLES.tenant_admin, h(BreakGlassBanner, { entry, lang: "uk" }));
  assert.match(markup, /break-glass-banner/);
  assert.match(markup, /розбити скло/, "says what mode this is");
  assert.match(markup, /Безперервність надання допомоги/, "and names the reason");
  assert.match(markup, /data-reason="care_continuity"/);
});

test("the banner cannot be dismissed", () => {
  // The whole design. A banner you can close is a banner that is closed
  // within ten seconds and never seen again.
  const entry = rememberBreakGlass(memStore(), { ...EPISODE, now: Date.now() });
  const markup = renderAs(ROLES.tenant_admin, h(BreakGlassBanner, { entry, lang: "uk" }));
  assert.ok(!/<button/.test(markup), "no close control");
  assert.ok(!/aria-label="(Закрити|Close)"/.test(markup));
  assert.ok(!/hidden/.test(markup));
});

test("no episode, no banner — an ordinary record is not decorated", () => {
  for (const entry of [null, undefined]) {
    assert.equal(renderAs(ROLES.clinician, h(BreakGlassBanner, { entry, lang: "uk" })), "");
  }
});

test("the treating clinician is never challenged and never banner-ed", () => {
  // The backend's relationship predicate decides; the FE renders what it is
  // given without adding chrome of its own. A clinician opening their own
  // patient has no episode recorded, so there is nothing to show.
  const st = memStore();
  const asDoctor = { now: T0, subject: DOCTOR };
  assert.equal(activeBreakGlass(st, "patient", "pat-1", asDoctor), null);
  const markup = renderAs(ROLES.clinician,
    h(BreakGlassBanner, { entry: activeBreakGlass(st, "patient", "pat-1", asDoctor), lang: "uk" }));
  assert.equal(markup, "");
});

test("the banner reads in English too", () => {
  const entry = rememberBreakGlass(memStore(), { ...EPISODE, reasonLabel: "Continuity of care", now: Date.now() });
  const markup = renderAs(ROLES.auditor, h(BreakGlassBanner, { entry, lang: "en" }));
  assert.match(markup, /Break-glass access/);
  assert.match(markup, /Continuity of care/);
});
