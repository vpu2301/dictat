// chat/data/answerMapping.test.js — the wire format, asserted.
//
// Two repos meet in this file. Everything here is a claim about what the
// evidence API sends and what this module does with it, and each one is a
// claim that would otherwise only be checked by a human looking at a screen.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseMarkdown, normaliseEvidenceLevel, splitAnswerSections,
  mapCitation, mapCitations, mapQueryResponse, abstentionCopy,
  ageRangeFromDob, toPatientContext,
} from "./answerMapping.js";

// The shape the synthesis prompt pins the model to (both languages).
const EN_ANSWER = `## Recommendation
Start a DOAC in preference to a vitamin-K antagonist (level Ia) [1].

## Evidence
Apixaban reduced stroke without excess major bleeding [1], [2].

## Caveats
Dose reduction applies at eGFR below 30 ml/min [2].`;

test("the three prompt sections become lead, body and limitations", () => {
  const out = splitAnswerSections(EN_ANSWER);
  assert.match(out.recommendation, /^Start a DOAC/);
  assert.match(out.summary, /^Apixaban reduced stroke/);
  assert.match(out.limitations, /^Dose reduction/);
  // Citation markers survive intact — they are what the chips are built from.
  assert.match(out.summary, /\[1\], \[2\]/);
});

test("the German headings map to the same three sections", () => {
  const out = splitAnswerSections("## Empfehlung\nA\n\n## Evidenz\nB\n\n## Zu beachten\nC");
  assert.equal(out.recommendation, "A");
  assert.equal(out.summary, "B");
  assert.equal(out.limitations, "C");
});

test("an unheaded answer still leads with its first paragraph", () => {
  const out = splitAnswerSections("Lead sentence [1].\n\nSupporting detail.\n\nMore detail.");
  assert.equal(out.recommendation, "Lead sentence [1].");
  assert.equal(out.summary, "Supporting detail.\n\nMore detail.");
  assert.equal(out.limitations, "");
});

test("an unrecognised heading keeps its text and its body", () => {
  // A model adding a section must never make a sentence disappear.
  const out = splitAnswerSections("## Recommendation\nA\n\n## Further reading\nSee X [1].");
  assert.match(out.recommendation, /^A/);
  assert.match(out.recommendation, /Further reading/);
  assert.match(out.recommendation, /See X \[1\]\./);
});

test("text before the first heading joins the body, not the lead", () => {
  const out = splitAnswerSections("Context first.\n\n## Recommendation\nDo this.");
  assert.equal(out.recommendation, "Do this.");
  assert.equal(out.summary, "Context first.");
});

test("markdown is flattened without eating citation markers", () => {
  const md = "**Bold** and `code` and [a link](https://x.test/p) and *em*.\n- one\n- two";
  const out = normaliseMarkdown(md);
  assert.equal(out.includes("**"), false);
  assert.equal(out.includes("`"), false);
  assert.equal(out.includes("https://"), false);
  assert.match(out, /Bold and code and a link and em\./);
  assert.match(out, /• one\n• two/);
  // The one bracket form that must survive untouched.
  assert.equal(normaliseMarkdown("Claim [1] and [12]."), "Claim [1] and [12].");
  // …and the documented alternative form is rewritten into it.
  assert.equal(normaliseMarkdown("Claim [citation:3]."), "Claim [3].");
});

test("emphasis flattening leaves arithmetic and snake_case alone", () => {
  assert.equal(normaliseMarkdown("Give 2*3 doses of egfr_ml_min."), "Give 2*3 doses of egfr_ml_min.");
});

test("only levels the badge can explain are kept", () => {
  assert.equal(normaliseEvidenceLevel("Ia"), "Ia");
  assert.equal(normaliseEvidenceLevel("level ib"), "Ib");
  // GRADE and Oxford values the API may send that this UI cannot decode.
  assert.equal(normaliseEvidenceLevel("moderate"), null);
  assert.equal(normaliseEvidenceLevel("1++"), null);
  assert.equal(normaliseEvidenceLevel(null), null);
});

test("a citation maps to a source record, inventing nothing", () => {
  const mapped = mapCitation({
    source: "PubMed", source_id: "36720132", title: "A trial", url: "https://pubmed.test/36720132",
    evidence_level: "Ib", recommendation_grade: "A", relevance_score: 0.82,
  });
  assert.equal(mapped.id, "PubMed:36720132");
  assert.equal(mapped.pmid, "36720132");
  assert.equal(mapped.doi, null);
  assert.equal(mapped.evidenceLevel, "Ib");
  // The API sends no publication year and no plain-language summary. Neither
  // is guessed at — a fabricated year on a clinical source is a dated lie.
  assert.equal(mapped.year, null);
  assert.equal(mapped.summary, "");
});

test("guideline bodies get a source type; a journal index does not", () => {
  assert.equal(mapCitation({ source: "AWMF", source_id: "nvl-001" }).sourceType, "guideline");
  assert.equal(mapCitation({ source: "Cochrane", source_id: "CD012345" }).sourceType, "meta-analysis");
  assert.equal(mapCitation({ source: "EuropePMC", source_id: "MED/99" }).sourceType, null);
});

test("a DOI in the source id is labelled as one", () => {
  assert.equal(mapCitation({ source: "Cochrane", source_id: "10.1002/14651858.CD012345" }).doi,
    "10.1002/14651858.CD012345");
});

test("the final event becomes the record the answer renders from", () => {
  const answer = mapQueryResponse({
    query_history_id: "qh-1", answer_md: EN_ANSWER, confidence: 0.91, evidence_level: "Ia",
    citations: [
      { source: "ESC", source_id: "af-2024", title: "AF guideline", url: "https://esc.test", relevance_score: 0.9 },
      { source: "PubMed", source_id: "36720132", title: "Apixaban trial", url: "https://p.test", relevance_score: 0.7 },
    ],
    latency_ms: 4200, model_id: "m", prompt_version: "p@v1",
    disclaimer_de: "…", disclaimer_en: "…",
  }, { entities: ["atrial fibrillation"], locale: "en" });

  assert.equal(answer.abstained, false);
  assert.equal(answer.grade, "Ia");
  assert.equal(answer.confidence, 0.91);
  assert.equal(answer.citations.length, 2);
  assert.deepEqual(answer.entities, ["atrial fibrillation"]);
  // Marker [2] must resolve to the second citation — the module's chips are
  // 1-based indices into this list, so the order is load-bearing.
  assert.equal(answer.citations[1].title, "Apixaban trial");
  // No follow-ups are invented: this pipeline generates none.
  assert.deepEqual(answer.followUps, []);
});

test("an abstention keeps its sources and explains itself", () => {
  const answer = mapQueryResponse({
    abstained: true, abstention_reason: "low_confidence", confidence: 0.3,
    answer_md: "", citations: [{ source: "AWMF", source_id: "x", title: "A guideline", url: "#" }],
    latency_ms: 900,
  }, { locale: "en" });

  assert.equal(answer.abstained, true);
  assert.match(answer.recommendation, /No confident answer/);
  // R2.2: a low-confidence abstention DID retrieve real sources. Dropping them
  // would withhold the only thing the clinician can still act on.
  assert.equal(answer.citations.length, 1);
});

test("a pipeline failure is not reported as an evidence gap", () => {
  // Seen for real: with the model unreachable the backend abstains with
  // `pipeline_error`. Saying "no sources cover this" would blame the corpus
  // for a broken service and send the clinician rewriting a fine question.
  const copy = abstentionCopy("pipeline_error", "en");
  assert.match(copy.title, /pipeline failed/);
  assert.match(copy.body, /not an evidence gap/);
});

test("each abstention reason gets its own sentence", () => {
  const reasons = ["no_retrieval_hits", "out_of_scope", "low_confidence", "high_hallucination_risk", "pipeline_error"];
  const titles = new Set(reasons.map((r) => abstentionCopy(r, "en").title));
  assert.equal(titles.size, reasons.length, "two reasons share one message");
  // An unknown reason still says something true rather than crashing.
  assert.match(abstentionCopy("something_new", "en").title, /No answer/);
  assert.match(abstentionCopy("out_of_scope", "uk").title, /Поза межами/);
});

// ── the PHI boundary ──────────────────────────────────────────────────────

const NOW = new Date(Date.UTC(2026, 7, 6));
const yearsAgo = (n) => new Date(Date.UTC(2026 - n, 7, 6)).toISOString().slice(0, 10);

test("age becomes a bracket, never a date", () => {
  assert.equal(ageRangeFromDob(yearsAgo(10), NOW), "0-17");
  assert.equal(ageRangeFromDob(yearsAgo(30), NOW), "18-39");
  assert.equal(ageRangeFromDob(yearsAgo(50), NOW), "40-64");
  assert.equal(ageRangeFromDob(yearsAgo(70), NOW), "65-79");
  assert.equal(ageRangeFromDob(yearsAgo(90), NOW), "80+");
  assert.equal(ageRangeFromDob(null, NOW), null);
  assert.equal(ageRangeFromDob("not a date", NOW), null);
});

test("a birthday that has not happened yet is not counted", () => {
  const dayBeforeSixty = new Date(Date.UTC(2026 - 60, 7, 7)).toISOString().slice(0, 10);
  assert.equal(ageRangeFromDob(dayBeforeSixty, NOW), "40-64");
});

test("the patient context that leaves the browser carries no identifiers", () => {
  const patient = {
    id: "pat_x",
    name: "Manfred Weber",
    mrn: "MRN-4471",
    dob: yearsAgo(67),
    sex: "m",
    diagnoses: [{ code: "I48.0", label: "Paroxysmal atrial fibrillation" }],
    medications: ["Apixaban 5 mg 1-0-1"],
    labs: [{ name: "eGFR", value: "54", unit: "ml/min" }],
  };
  const context = toPatientContext(patient, { now: NOW });

  assert.deepEqual(context, {
    age_range: "65-79",
    sex: "M",
    comorbidities: ["I48.0 Paroxysmal atrial fibrillation"],
    current_medications: ["Apixaban 5 mg 1-0-1"],
    egfr_ml_min: 54,
  });

  // The claim in one line: nothing that names this person is in the payload.
  const wire = JSON.stringify(context);
  for (const identifier of [patient.name, patient.mrn, patient.dob, patient.id, "Weber", "1959"]) {
    assert.equal(wire.includes(identifier), false, `leaked ${identifier}`);
  }
});

test("a patient with nothing to contribute sends no context at all", () => {
  assert.equal(toPatientContext({ id: "p", name: "X" }), null);
  assert.equal(toPatientContext(null), null);
});

test("free-text lists are capped where the API caps them", () => {
  const many = (n, label) => Array.from({ length: n }, (_, i) => `${label} ${i}`);
  const context = toPatientContext({
    dob: yearsAgo(50),
    diagnoses: many(30, "dx"),
    medications: many(40, "rx"),
  }, { now: NOW });
  assert.equal(context.comorbidities.length, 20);
  assert.equal(context.current_medications.length, 30);
});

test("an out-of-range lab value is dropped rather than sent", () => {
  const context = toPatientContext({
    dob: yearsAgo(50), labs: [{ name: "eGFR", value: "999" }],
  }, { now: NOW });
  assert.equal("egfr_ml_min" in context, false);
});
