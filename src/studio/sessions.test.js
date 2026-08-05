import test from "node:test";
import assert from "node:assert/strict";

import {
  reportToSession, noteToSession, dictationToSession, asrToSession,
  mergeSessions, filterSessions, groupSessions, sessionParams, studioHref, statusTone,
} from "./sessions.js";

test("a report hit keeps the backend's field names straight", () => {
  const s = reportToSession({
    report_id: "r1", title: "Виписка", patient_name: "Іваненко І.",
    patient_id: "p1", status: "draft", updated_at: "2026-08-03T09:00:00Z",
    template_id: "t1",
  });
  assert.equal(s.key, "report:r1");
  assert.equal(s.kind, "report");
  assert.equal(s.title, "Виписка");
  assert.equal(s.subtitle, "Іваненко І.");
  assert.equal(s.at, "2026-08-03T09:00:00Z");
  assert.equal(s.patientId, "p1");
});

test("a redacted patient name is never traded for an unredacted one", () => {
  const s = reportToSession({ report_id: "r2", patient_name_redacted: "І. І.", patient_name: "Іваненко Іван" });
  assert.equal(s.patientName, "І. І.");
  assert.equal(s.title, "І. І.");
});

test("a dictation session says what it is instead of inventing a patient", () => {
  const s = dictationToSession({
    id: "d1", status: "finalized", language: "uk", target_kind: "conversation",
    started_at: "2026-08-02T10:00:00Z", last_active_at: "2026-08-02T10:12:00Z",
    total_audio_ms: 125000,
  }, "en");
  assert.equal(s.kind, "dictate");
  assert.equal(s.title, "Conversation");
  assert.equal(s.subtitle, "2:05 · UK");
  assert.equal(s.at, "2026-08-02T10:12:00Z");
  assert.equal(s.patientId, null);
});

test("an asr job dates itself by the latest moment it reached", () => {
  const queued = asrToSession({ id: "j1", status: "queued", queued_at: "2026-08-01T08:00:00Z", language: "uk" });
  assert.equal(queued.at, "2026-08-01T08:00:00Z");
  const done = asrToSession({
    id: "j2", status: "complete", queued_at: "2026-08-01T08:00:00Z",
    started_at: "2026-08-01T08:01:00Z", finished_at: "2026-08-01T08:05:00Z",
  });
  assert.equal(done.at, "2026-08-01T08:05:00Z");
});

test("merge sorts newest first and sinks undated rows", () => {
  const merged = mergeSessions(
    [{ key: "a", at: "2026-08-01T00:00:00Z" }],
    [{ key: "b", at: null }],
    [{ key: "c", at: "2026-08-03T00:00:00Z" }],
  );
  assert.deepEqual(merged.map((m) => m.key), ["c", "a", "b"]);
});

test("grouping buckets by day boundaries, not by 24h windows", () => {
  const now = Date.parse("2026-08-03T09:00:00Z");
  const iso = (d) => new Date(d).toISOString();
  const groups = groupSessions([
    { key: "t", at: iso(now - 3600e3) },        // today
    { key: "y", at: iso(now - 26 * 3600e3) },   // yesterday
    { key: "w", at: iso(now - 4 * 86400e3) },   // this week
    { key: "o", at: iso(now - 40 * 86400e3) },  // older
    { key: "u", at: null },
  ], "en", now);
  assert.deepEqual(groups.map((g) => g.key), ["today", "yesterday", "week", "older", "undated"]);
  assert.deepEqual(groups.map((g) => g.items.length), [1, 1, 1, 1, 1]);
});

test("empty buckets are not rendered", () => {
  const groups = groupSessions([{ key: "t", at: new Date().toISOString() }], "en");
  assert.deepEqual(groups.map((g) => g.key), ["today"]);
});

test("filter matches the precomputed search text only", () => {
  const items = [
    { key: "a", search: "виписка іваненко" },
    { key: "b", search: "consultation" },
  ];
  assert.deepEqual(filterSessions(items, "івАН").map((i) => i.key), ["a"]);
  assert.equal(filterSessions(items, "  ").length, 2);
});

test("each kind opens its own mode", () => {
  assert.deepEqual(sessionParams({ kind: "report", id: "r1", patientId: "p1" }),
    { mode: "dictate", report: "r1", patient: "p1" });
  assert.deepEqual(sessionParams({ kind: "asr", id: "j1", patientId: null }),
    { mode: "audio", job: "j1", patient: undefined });
  assert.deepEqual(sessionParams({ kind: "dictate", id: "d1" }),
    { mode: "scribe", session: "d1" });
});

test("href drops empty params", () => {
  assert.equal(studioHref({ mode: "dictate", report: "r1", patient: undefined }), "/studio?mode=dictate&report=r1");
  assert.equal(studioHref({}), "/studio");
});

test("three status vocabularies collapse into one scale", () => {
  assert.equal(statusTone({ status: "signed" }), "done");
  assert.equal(statusTone({ status: "complete" }), "done");
  assert.equal(statusTone({ status: "failed" }), "bad");
  assert.equal(statusTone({ status: "running" }), "live");
  assert.equal(statusTone({ status: "draft" }), "draft");
});

test("a clinical note joins the same list", () => {
  const s = noteToSession({
    id: "n1", title: "Скарги на кашель", structure: "SOAP", status: "draft",
    patient: { id: "p1", name: { uk: "Іваненко І." } }, patient_id: "p1",
    created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-02T11:00:00Z",
  }, "uk");
  assert.equal(s.key, "note:n1");
  assert.equal(s.kind, "note");
  assert.equal(s.title, "Скарги на кашель");
  assert.equal(s.subtitle, "Іваненко І. · SOAP");
  assert.equal(s.at, "2026-08-02T11:00:00Z");
  assert.equal(s.patientId, "p1");
});

test("an untitled note falls back to the patient, then to its kind", () => {
  assert.equal(noteToSession({ id: "n2", patient: { name: { uk: "Петренко" } } }, "uk").title, "Петренко");
  assert.equal(noteToSession({ id: "n3" }, "en").title, "Note");
});

test("a note row opens note mode", () => {
  assert.deepEqual(sessionParams({ kind: "note", id: "n1", patientId: "p1" }),
    { mode: "note", note: "n1", patient: "p1" });
});
