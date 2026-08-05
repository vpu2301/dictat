import test from "node:test";
import assert from "node:assert/strict";

import {
  syncTabs, closeTab, renameTab, documentKey, paramsOfTab, tabFromParams, fallbackTitle, MAX_TABS,
} from "./tabs.js";

test("a fresh navigation opens a tab", () => {
  const r = syncTabs([], { mode: "dictate" });
  assert.equal(r.tabs.length, 1);
  assert.equal(r.tabs[0].mode, "dictate");
  assert.equal(r.activeId, r.tabs[0].id);
});

test("navigating INSIDE a tab keeps it — the tab adopts the new document", () => {
  const first = syncTabs([], { mode: "dictate" });
  const id = first.activeId;
  // the tab picks a patient, then mints a report
  const withPatient = syncTabs(first.tabs, { mode: "dictate", patient: "p1", t: id }, { seq: first.seq });
  const withReport = syncTabs(withPatient.tabs, { mode: "dictate", patient: "p1", report: "r1", t: id }, { seq: withPatient.seq });
  assert.equal(withReport.tabs.length, 1);
  assert.equal(withReport.activeId, id);
  assert.equal(withReport.tabs[0].report, "r1");
});

test("two blank dictations are two tabs", () => {
  const a = syncTabs([], { mode: "dictate" });
  const b = syncTabs(a.tabs, { mode: "dictate" }, { seq: a.seq });
  assert.equal(b.tabs.length, 2);
  assert.notEqual(b.tabs[0].id, b.tabs[1].id);
});

test("the same report opened twice focuses the tab that has it", () => {
  const a = syncTabs([], { mode: "dictate", report: "r1" });
  const b = syncTabs(a.tabs, { mode: "dictate", report: "r1" }, { seq: a.seq });
  assert.equal(b.tabs.length, 1);
  assert.equal(b.activeId, a.activeId);
});

test("a title survives the tab adopting a new document", () => {
  const a = syncTabs([], { mode: "dictate" });
  const named = renameTab(a.tabs, a.activeId, "Іваненко");
  const b = syncTabs(named, { mode: "dictate", report: "r1", t: a.activeId }, { seq: a.seq });
  assert.equal(b.tabs[0].title, "Іваненко");
});

test("closing activates the right neighbour, then the left", () => {
  let s = syncTabs([], { mode: "dictate" });
  s = syncTabs(s.tabs, { mode: "scribe" }, { seq: s.seq });
  s = syncTabs(s.tabs, { mode: "audio" }, { seq: s.seq });
  const [t1, t2, t3] = s.tabs;

  const mid = closeTab(s.tabs, t2.id);
  assert.deepEqual(mid.tabs.map((t) => t.id), [t1.id, t3.id]);
  assert.equal(mid.next.id, t3.id, "right neighbour");

  const last = closeTab(s.tabs, t3.id);
  assert.equal(last.next.id, t2.id, "falls back to the left");

  assert.equal(closeTab([t1], t1.id).next, null, "the last tab leaves nothing behind");
  assert.deepEqual(closeTab(s.tabs, "nope").tabs.length, 3);
});

test("the strip is capped, oldest first", () => {
  let s = syncTabs([], { mode: "dictate" });
  for (let i = 0; i < MAX_TABS + 3; i++) s = syncTabs(s.tabs, { mode: "dictate" }, { seq: s.seq });
  assert.equal(s.tabs.length, MAX_TABS);
});

test("params round-trip through a tab, `t` included", () => {
  const tab = tabFromParams({ mode: "audio", job: "j1", patient: "p1" }, "t7");
  assert.deepEqual(paramsOfTab(tab), { mode: "audio", patient: "p1", job: "j1", t: "t7" });
});

test("document identity ignores the capture mode", () => {
  assert.equal(documentKey({ mode: "dictate", report: "r1" }), "report:r1");
  assert.equal(documentKey({ mode: "audio", job: "j1" }), "asr:j1");
  assert.equal(documentKey({ mode: "scribe", session: "s1" }), "dictate:s1");
  assert.equal(documentKey({ mode: "dictate" }), null);
});

test("an unnamed tab still says what it is", () => {
  assert.equal(fallbackTitle({ mode: "scribe" }, "en"), "Conversation");
  assert.equal(fallbackTitle({ mode: "dictate", job: "j1" }, "en"), "Audio");
  assert.equal(fallbackTitle({ mode: "smart" }, "en"), "Smart dictation");
});
