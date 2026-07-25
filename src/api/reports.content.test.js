// Sprint 13 step 01 — buildReportContent round-trips section_meta (icd10 +
// field_specific_metadata) and, WITHOUT it, stays byte-identical to the
// pre-S13 output: the autosave payload for a plain prose draft must not
// change shape under this sprint.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildReportContent } from "./reports.js";

const base = {
  template_id: "0b6e7c1e-6a2f-4d2a-9d1e-4242deadbeef",
  template_schema_version: 2,
  body: { anamnesis: "скарги", diagnosis: "ІХС", empty: "" },
};

test("without section_meta the output is exactly the pre-S13 shape", () => {
  const content = buildReportContent(base);
  assert.deepEqual(content, {
    template_id: base.template_id,
    template_schema_version: 2,
    sections: [
      { section_key: "anamnesis", text: "скарги" },
      { section_key: "diagnosis", text: "ІХС" },
    ],
  });
  // Byte-identical serialization guard (what actually goes on the wire).
  assert.equal(
    JSON.stringify(content),
    JSON.stringify(buildReportContent({ ...base, section_meta: undefined })),
  );
});

test("section_meta attaches icd10 and field_specific_metadata to its section", () => {
  const meta = {
    diagnosis: {
      icd10: [{ code: "I25.1", display: "ІХС" }],
      field_specific_metadata: {
        source: "extracted", confidence: 0.8,
        proposals: [{ code: "I20.0", confidence: 0.8 }],
      },
    },
  };
  const content = buildReportContent({ ...base, section_meta: meta });
  const diag = content.sections.find((s) => s.section_key === "diagnosis");
  assert.deepEqual(diag.icd10, meta.diagnosis.icd10);
  assert.deepEqual(diag.field_specific_metadata, meta.diagnosis.field_specific_metadata);
  // Sections without meta carry neither key (extra keys would change the
  // canonical bytes the backend signs).
  const ana = content.sections.find((s) => s.section_key === "anamnesis");
  assert.deepEqual(Object.keys(ana), ["section_key", "text"]);
});

test("a section with meta but no prose is still emitted (empty text)", () => {
  const content = buildReportContent({
    ...base,
    body: { anamnesis: "скарги" },
    section_meta: { pain: { field_specific_metadata: { source: "manual", selected: "no_pain" } } },
  });
  const pain = content.sections.find((s) => s.section_key === "pain");
  assert.deepEqual(pain, {
    section_key: "pain",
    text: "",
    field_specific_metadata: { source: "manual", selected: "no_pain" },
  });
});

test("empty meta entries do not fabricate sections or keys", () => {
  const content = buildReportContent({
    ...base,
    section_meta: {
      anamnesis: {},                       // nothing to attach
      ghost: { icd10: [], field_specific_metadata: {} }, // resolves to nothing
    },
  });
  assert.deepEqual(content.sections.map((s) => s.section_key), ["anamnesis", "diagnosis"]);
  assert.deepEqual(Object.keys(content.sections[0]), ["section_key", "text"]);
});

test("string-body drafts (legacy single note) still accept section_meta", () => {
  const content = buildReportContent({
    ...base,
    body: "весь текст",
    section_meta: { note: { icd10: [{ code: "M54.5" }] } },
  });
  assert.deepEqual(content.sections, [
    { section_key: "note", text: "весь текст", icd10: [{ code: "M54.5" }] },
  ]);
});
