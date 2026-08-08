// chat/data/platformMapping.test.js — the typed envelope, in the module's shape.
//
// The envelope shapes here are copied from `libs/evidence_models` in the
// evidence backend (stream.py / envelope.py), not invented: the point of this
// file is to fail when that contract moves.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASK_MODE, askLocale, buildAskBody, mapSource, segmentText,
  partitionSegments, noteLines, mapAnswer,
} from "./platformMapping.js";

const segment = (id, kind, text, citations = []) => ({
  id, kind, text, citations, patient_fact_refs: [],
});

const CORPUS = {
  id: "S1", kind: "corpus", title: "2 Recommendations > 2.1 Monitoring",
  evidence_tier: "guideline", source_authority: "international",
  document_version_id: "2e9c6151-1bd1-486c-beee-a20ef156ed68",
};

const WEB = {
  id: "S2", kind: "web", title: "Type 2 diabetes in adults",
  evidence_tier: "systematic_review", source_authority: "national",
  web: { url: "https://nice.org.uk/ng28", domain: "nice.org.uk", trust_tier: "guideline_registry", accessed_at: "2026-08-07T20:00:00Z" },
};

// ── the request ───────────────────────────────────────────────────────────
// `AskRequest` is `additionalProperties: false` with `locale: ^(uk|en)` and a
// mode enum that does NOT contain "quick". Every one of those is a 422, and a
// 422 reaches the reader as "could not get an answer".

test("the ask body is exactly what AskRequest accepts", () => {
  assert.deepEqual(buildAskBody("  What HbA1c target?  ", { language: "en", locale: "uk" }), {
    question: "What HbA1c target?",
    mode: ASK_MODE,
    locale: "en",
  });
  assert.equal(ASK_MODE, "quick_search");
});

test("a locale the service does not accept falls back rather than 422ing", () => {
  assert.equal(askLocale("uk"), "uk");
  assert.equal(askLocale("en-GB"), "en");
  assert.equal(askLocale("de", "uk"), "uk");     // the UI locale is the next candidate
  assert.equal(askLocale("de", "pl"), "en");     // neither maps → en
  assert.equal(askLocale(null, undefined), "en");
  assert.equal(buildAskBody("q", { language: "de", locale: "ro" }).locale, "en");
});

// ── citation markers ──────────────────────────────────────────────────────

test("citations become the 1-based markers citations.js parses", () => {
  const indexOf = new Map([["S1", 1], ["S2", 2]]);
  const seg = segment("s1", "evidence", "Measure every three months.", [
    { source_id: "S2" }, { source_id: "S1" },
  ]);
  assert.equal(segmentText(seg, indexOf), "Measure every three months. [2][1]");
});

test("a marker is never rendered for a source that did not arrive", () => {
  const indexOf = new Map([["S1", 1]]);
  const seg = segment("s1", "evidence", "Titrate to target.", [{ source_id: "S9" }]);
  assert.equal(segmentText(seg, indexOf), "Titrate to target.");
});

test("the same source cited twice in one segment gets one marker", () => {
  const indexOf = new Map([["S1", 1]]);
  const seg = segment("s1", "evidence", "Both arms agreed.", [
    { source_id: "S1", passage_id: "p1" }, { source_id: "S1", passage_id: "p2" },
  ]);
  assert.equal(segmentText(seg, indexOf), "Both arms agreed. [1]");
});

// ── the taxonomy → the three-part answer ──────────────────────────────────

test("uncertainty and missing_info are the aside; everything else is the body", () => {
  const { body, limitations } = partitionSegments(
    [segment("s1", "evidence", "A"), segment("s2", "uncertainty", "B")],
    [segment("d1", "next_step", "C"), segment("d2", "missing_info", "D")],
  );
  assert.deepEqual(body.map((s) => s.id), ["s1", "d1"]);
  assert.deepEqual(limitations.map((s) => s.id), ["s2", "d2"]);
});

test("the first body segment leads and the rest is the summary", () => {
  const answer = mapAnswer({
    header: { answer_id: "a-1", verified: false, flags: [] },
    summary: [
      segment("s1", "evidence", "Target 7% for most adults.", [{ source_id: "S1" }]),
      segment("s2", "interpretation", "Relax it in frailty."),
      segment("s3", "uncertainty", "Evidence in the very old is thin.", [{ source_id: "S2" }]),
    ],
    detail: [segment("d1", "next_step", "Recheck in three months.")],
    sources: [CORPUS, WEB],
    done: { answer_id: "a-1", status: "ok", provenance_ref: "prov-1", flags: [] },
  }, { locale: "en", latencyMs: 1200 });

  assert.equal(answer.abstained, false);
  assert.equal(answer.recommendation, "Target 7% for most adults. [1]");
  assert.equal(answer.summary, "Relax it in frailty.\n\nRecheck in three months.");
  assert.equal(answer.limitations, "Evidence in the very old is thin. [2]");
  assert.deepEqual(answer.citations.map((c) => c.id), ["S1", "S2"]);
  assert.equal(answer.latencyMs, 1200);
  assert.equal(answer.provenanceRef, "prov-1");
});

test("nothing is invented for what this service does not report", () => {
  const answer = mapAnswer({
    summary: [segment("s1", "evidence", "X.", [{ source_id: "S1" }])],
    sources: [CORPUS],
    done: { status: "ok" },
  });
  assert.equal(answer.grade, null);
  assert.equal(answer.confidence, null, "a fabricated confidence is a number nothing computed");
  assert.deepEqual(answer.entities, []);
  assert.deepEqual(answer.followUps, []);
});

// ── sources ───────────────────────────────────────────────────────────────

test("a source maps to what ReferenceCard renders, and no further", () => {
  assert.deepEqual(mapSource(CORPUS, "en"), {
    id: "S1",
    title: "2 Recommendations > 2.1 Monitoring",
    source: "International",
    sourceType: "guideline",
    year: null,
    evidenceLevel: null,
    recommendationGrade: null,
    summary: "",
    pmid: null,
    doi: null,
    registry: null,
    url: "",
    relevance: null,
  });
});

test("a web source publishes as its domain and keeps its address", () => {
  const mapped = mapSource(WEB, "uk");
  assert.equal(mapped.source, "nice.org.uk");
  assert.equal(mapped.url, "https://nice.org.uk/ng28");
  assert.equal(mapped.sourceType, "meta-analysis");
  assert.equal(mapped.year, null, "accessed_at is a fetch date, not a publication year");
});

// ── the states that are not a plain answer ────────────────────────────────

test("insufficient_basis reads differently depending on whether anything was found", () => {
  const withSources = mapAnswer({
    summary: [], detail: [], sources: [CORPUS],
    done: { status: "insufficient_basis", flags: [{ code: "insufficient_basis", severity: "warning", message: "" }] },
  }, { locale: "en" });
  assert.equal(withSources.abstained, true);
  assert.equal(withSources.abstentionReason, "low_confidence");
  assert.equal(withSources.citations.length, 1, "the sources found are still worth reading");

  const empty = mapAnswer({ summary: [], detail: [], sources: [], done: { status: "insufficient_basis" } });
  assert.equal(empty.abstentionReason, "no_retrieval_hits");
});

test("an empty body with an ok status is still an abstention, not a blank answer", () => {
  const answer = mapAnswer({ summary: [], detail: [], sources: [], done: { status: "ok" } });
  assert.equal(answer.abstained, true);
  assert.ok(answer.recommendation.length > 0);
});

test("a deflection carries the service's own sentence, not the generic one", () => {
  const answer = mapAnswer({
    summary: [], sources: [],
    done: {
      status: "deflected",
      triage: { reason_code: "individual_dosing", message: "Use the dosing protocol for this." },
    },
  }, { locale: "en" });
  assert.equal(answer.abstained, true);
  assert.equal(answer.abstentionReason, "individual_dosing");
  assert.equal(answer.summary, "Use the dosing protocol for this.");
});

// ── the notes ─────────────────────────────────────────────────────────────

test("an attached patient is told, in the answer, that its data was not used", () => {
  const answer = mapAnswer({
    summary: [segment("s1", "evidence", "X.", [{ source_id: "S1" }])],
    sources: [CORPUS],
    done: { status: "ok" },
  }, { locale: "uk", patientAttached: true });
  assert.match(answer.limitations, /Пацієнта прикріплено/);
});

test("degraded connectors and partial synthesis join the aside once each", () => {
  const flags = [
    { code: "web_unavailable", severity: "info", message: "" },
    { code: "partial_synthesis", severity: "warning", message: "" },
  ];
  const lines = noteLines({ flags: [...flags, ...flags], locale: "en" });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /web sources were unavailable/);
});

test("the insufficient_basis flag adds no note — the status already said it", () => {
  assert.deepEqual(noteLines({ flags: [{ code: "insufficient_basis" }], locale: "en" }), []);
});

test("header flags and done flags are one list, deduplicated", () => {
  const flag = { code: "web_unavailable", severity: "info", message: "" };
  const answer = mapAnswer({
    header: { flags: [flag] },
    summary: [segment("s1", "evidence", "X.", [{ source_id: "S1" }])],
    sources: [CORPUS],
    done: { status: "ok", flags: [flag] },
  }, { locale: "en" });
  assert.equal(answer.flags.length, 1);
  assert.equal((answer.limitations.match(/web sources were unavailable/g) || []).length, 1);
});
