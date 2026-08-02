// chat/documents.test.js — the generated document.
//
// This output leaves the module and can end up in a patient's record, so the
// rules that keep it honest are tested rather than trusted: citations resolve,
// limitations always travel, and every document says it came from a demo build.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDocument, DOCUMENT_KINDS } from "./documents.js";

const answer = {
  recommendation: "Aim for ~7.0–7.5% [1][2]. Review metformin dosing [3].",
  summary: "The corridor follows comorbidity and hypoglycaemia risk [1].",
  limitations: "Hypoglycaemia history is not in the attached record.",
  grade: "Ia",
  confidence: 0.91,
  citations: [
    { id: "ev_01", index: 1, title: "National guideline: T2DM therapy", source: "AWMF", year: 2024, evidenceLevel: "Ia", registry: "nvl-001" },
    { id: "ev_04", index: 2, title: "HbA1c targets in older adults", source: "PubMed", year: 2024, evidenceLevel: "IV", pmid: "38112204" },
    { id: "ev_03", index: 3, title: "Metformin dosing in CKD 3", source: "Cochrane", year: 2022, evidenceLevel: "Ia", doi: "10.1002/x" },
  ],
};

const patient = {
  id: "pat_01", name: "Manfred Weber", dob: "1959-03-12", sex: "m",
  diagnoses: [{ code: "E11.9", label: "Type 2 diabetes mellitus", labelDe: "Diabetes mellitus Typ 2" }],
  medications: ["Metformin 1000 mg 1-0-1"],
  labs: [{ name: "HbA1c", value: "7.8", unit: "%" }],
  allergies: ["Penicillin"],
};

const q = "What HbA1c target should I aim for?";

test("every kind produces a titled document", () => {
  for (const kind of DOCUMENT_KINDS) {
    const doc = generateDocument({ kind, question: q, answer });
    assert.ok(doc.body.length > 40, `${kind} produced nothing`);
    assert.match(doc.title, /HbA1c/);
    assert.equal(doc.kind, kind);
  }
});

test("the note is an assessment and a plan, not a transcript of the chat", () => {
  const doc = generateDocument({ kind: "note", question: q, answer });
  assert.match(doc.body, /Assessment:/);
  assert.match(doc.body, /Plan:/);
  assert.equal(/Ask next/i.test(doc.body), false);
});

test("the plan is numbered steps taken from the recommendation", () => {
  const doc = generateDocument({ kind: "plan", question: q, answer });
  assert.match(doc.body, /1\. Aim for/);
  assert.match(doc.body, /2\. Review metformin dosing/);
});

test("citations resolve to a numbered source list carrying their identifiers", () => {
  const doc = generateDocument({ kind: "note", question: q, answer });
  assert.match(doc.body, /\[1\] National guideline: T2DM therapy — AWMF 2024, Ia \(nvl-001\)/);
  assert.match(doc.body, /PMID 38112204/);
  assert.match(doc.body, /DOI 10\.1002\/x/);
  assert.equal(doc.sourceCount, 3);
});

test("limitations always travel with the recommendation", () => {
  for (const kind of DOCUMENT_KINDS) {
    const doc = generateDocument({ kind, question: q, answer });
    assert.match(doc.body, /Hypoglycaemia history is not in the attached record/, `${kind} dropped the limitations`);
  }
});

test("every document says it came from a demo build", () => {
  for (const kind of DOCUMENT_KINDS) {
    assert.match(generateDocument({ kind, question: q, answer }).body, /demo build/i);
  }
});

test("the patient block states what was attached, and infers nothing", () => {
  const doc = generateDocument({ kind: "note", question: q, answer, patient });
  assert.match(doc.body, /Patient context:/);
  assert.match(doc.body, /Manfred Weber · 6[0-9] · M/);
  assert.match(doc.body, /E11\.9 Type 2 diabetes mellitus/);
  assert.match(doc.body, /Allergies: Penicillin/);
  assert.equal(doc.patientId, "pat_01");
});

test("without a patient there is no patient block at all", () => {
  const doc = generateDocument({ kind: "note", question: q, answer });
  assert.equal(/Patient context/.test(doc.body), false);
  assert.equal(doc.patientId, null);
});

test("the document is written in the answer's language, not the interface's", () => {
  const de = generateDocument({ kind: "note", question: q, answer, language: "de", locale: "en" });
  assert.match(de.body, /Beurteilung:/);
  assert.match(de.body, /Demo-Build/);
  assert.equal(de.language, "de");

  // Ukrainian interface, English answers → an English document.
  const uk = generateDocument({ kind: "note", question: q, answer, language: "en", locale: "uk" });
  assert.match(uk.body, /Оцінка:/);
});

test("an answer with no citations still produces a usable document", () => {
  const doc = generateDocument({ kind: "note", question: q, answer: { ...answer, citations: [] } });
  assert.equal(doc.sourceCount, 0);
  assert.equal(/Evidence:/.test(doc.body), false);
  assert.match(doc.body, /Assessment:/);
});

test("no answer, no document", () => {
  assert.equal(generateDocument({ kind: "note", question: q, answer: null }), null);
});
