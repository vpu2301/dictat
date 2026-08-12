import test from "node:test";
import assert from "node:assert/strict";

import {
  syncTabs, closeTab, renameTab, renameTabForPatient, documentKey, paramsOfTab, tabFromParams, fallbackTitle, MAX_TABS,
  loadTabs, saveTabs, TABS_KEY, patientSource,
} from "./tabs.js";

const memStore = (seed) => {
  const map = new Map(seed ? [[TABS_KEY, seed]] : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    has: (k) => map.has(k),
  };
};
const HOUR = 60 * 60 * 1000;
const at = (h, m = 0) => new Date(2026, 7, 9, h, m).getTime(); // 9 Aug 2026, local

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

test("a strip written today comes back on reload", () => {
  const s = memStore();
  saveTabs(s, [{ id: "t1", mode: "scribe", patient: "p1" }], at(9, 0));
  assert.deepEqual(loadTabs(s, at(15, 30)).map((t) => t.id), ["t1"]);
});

test("yesterday's strip does not open with today's clinic", () => {
  const s = memStore();
  saveTabs(s, [{ id: "t1", mode: "scribe", patient: "p1" }], at(9, 0) - 24 * HOUR);
  assert.deepEqual(loadTabs(s, at(9, 36)), []);
  assert.equal(s.has(TABS_KEY), false, "and the stale strip is swept, not re-read");
});

test("a reboot across midnight still carries the work over", () => {
  const s = memStore();
  saveTabs(s, [{ id: "t1", mode: "dictate" }], at(23, 55));
  assert.deepEqual(loadTabs(s, at(23, 55) + 10 * 60 * 1000).map((t) => t.id), ["t1"]);
});

test("junk, a pre-v2 array, and a future clock all start empty", () => {
  assert.deepEqual(loadTabs(memStore("{not json"), at(9)), []);
  assert.deepEqual(loadTabs(memStore(JSON.stringify([{ id: "t1" }])), at(9)), [], "old bare-array shape");
  const s = memStore();
  saveTabs(s, [{ id: "t1" }], at(9) + 48 * HOUR);
  assert.deepEqual(loadTabs(s, at(9)), [], "clock moved backwards");
});

test("an unnamed tab still says what it is", () => {
  assert.equal(fallbackTitle({ mode: "scribe" }, "en"), "Conversation");
  assert.equal(fallbackTitle({ mode: "dictate", job: "j1" }, "en"), "Audio");
  assert.equal(fallbackTitle({ mode: "smart" }, "en"), "Smart dictation");
});

// ── whose patient the open document is about ───────────────────────────
// Regression: a dictation tab for Mia Tkachenko sat beside an uploaded audio
// job that had no patient at all. The editor stays mounted behind the upload,
// so its snapshot still named her — the job's tab took her name, and the header
// claimed the recording was about her.

test("a document with no patient of its own borrows nobody's", () => {
  assert.equal(patientSource({
    // the open document: an ASR job, no patient, no report
    jobId: "a8e34554",
    // the editor, still mounted behind it, holding the draft from the next tab
    snapPatientId: "mia", snapReportId: "r1",
    // and the workspace's own fetch, which useAsync never forgets
    fetchedId: "mia",
  }), null);
});

test("the patient the URL names wins, from whichever source has them", () => {
  assert.equal(patientSource({ patientId: "p1", fetchedId: "p1" }), "fetched");
  assert.equal(patientSource({ patientId: "p1", pickedId: "p1" }), "picked");
  // The editor resolves the patient a moment before the workspace does; that
  // head start is worth keeping, so long as it is the SAME patient.
  assert.equal(patientSource({ patientId: "p1", snapPatientId: "p1" }), "snapshot");
});

test("a stale source is not the current patient", () => {
  assert.equal(patientSource({ patientId: "p2", fetchedId: "p1", pickedId: "p1", snapPatientId: "p1" }), null);
});

test("a reopened draft may take its patient from the editor's envelope", () => {
  // The only case the snapshot legitimately answers: ?report=r1 with no
  // ?patient=, where the id lives in the report envelope only the editor fetches.
  assert.equal(patientSource({ reportId: "r1", snapReportId: "r1", snapPatientId: "mia" }), "snapshot");
  // …but not for a DIFFERENT report, which is the previous tab's.
  assert.equal(patientSource({ reportId: "r2", snapReportId: "r1", snapPatientId: "mia" }), null);
});

test("nothing open, nothing known", () => {
  assert.equal(patientSource(), null);
  assert.equal(patientSource({}), null);
});

// ── a tab's name belongs to its own patient ────────────────────────────────
// The defect these pin, in the words it was reported in: "when I switch between
// tabs with different patients, the last tab takes the name". The workspace
// renamed `activeTab` — React state an effect sets — with a title derived from
// the URL, which is a render ahead of it. Switching to a tab whose patient was
// already resolvable wrote that patient's name onto the tab just LEFT.
//
// In a medical record the tab strip is how two open consultations are told
// apart, so the rule is now a pure function and pinned here.

test("a patient may only name the tab that asked for that patient", () => {
  const tabs = [
    { id: "t1", mode: "dictate", patient: "p-luca" },
    { id: "t2", mode: "dictate", patient: "p-volodymyr" },
  ];
  // The wrong-patient write the bug performed: t1 renamed to t2's patient.
  const same = renameTabForPatient(tabs, "t1", "Volodymyr Pugachov", "p-volodymyr");
  assert.equal(same, tabs, "a tab holding another patient must not be renamed");
  assert.equal(same[0].title, undefined);

  // The legitimate write: the tab's own patient resolved.
  const named = renameTabForPatient(tabs, "t1", "Luca Bondarenko", "p-luca");
  assert.equal(named[0].title, "Luca Bondarenko");
  assert.equal(named[1].title, undefined, "the other tab is untouched");
});

test("a tab with no patient of its own is still named by its document", () => {
  // An audio job or a note has no patient param and must still get a title —
  // that is what stops the strip reading "Аудіо, Аудіо, Аудіо".
  const tabs = [{ id: "t3", mode: "audio", job: "job-1" }];
  const named = renameTabForPatient(tabs, "t3", "Volodymyr Pugachov", "p-volodymyr");
  assert.equal(named[0].title, "Volodymyr Pugachov");
});

test("renaming a tab that is not in the strip changes nothing", () => {
  const tabs = [{ id: "t1", mode: "dictate", patient: "p-luca" }];
  assert.equal(renameTabForPatient(tabs, "t9", "Ghost", "p-x"), tabs);
  assert.equal(renameTabForPatient(tabs, "t1", "", "p-luca"), tabs, "no title, no write");
});
