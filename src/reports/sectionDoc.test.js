// Sprint 13 step 01 — free_text regression guard for the body ⇄ doc mapping,
// plus the new behavior: the section node's `kind` attr carries the real
// template field_type (the dispatch hook), defaulting to free_text.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { bodyToDoc, docToBody } from "./sectionDoc.js";

const template = {
  sections: [
    { id: "anamnesis", name: { uk: "Анамнез", en: "History" }, required: true },
    { id: "pain", name: { en: "Pain" }, required: false, field_type: "choice" },
    { id: "diagnosis", name: { en: "Diagnosis" }, required: true, field_type: "structured_diagnosis" },
  ],
};

test("bodyToDoc: kind carries field_type, free_text is the default", () => {
  const doc = bodyToDoc(template, { anamnesis: "скарги на біль" }, "uk");
  assert.equal(doc.type, "doc");
  assert.equal(doc.content.length, 3);
  const [a, p, d] = doc.content;
  assert.equal(a.attrs.kind, "free_text");   // no field_type on the section → default
  assert.equal(p.attrs.kind, "choice");
  assert.equal(d.attrs.kind, "structured_diagnosis");
  // Pre-S13 shape otherwise unchanged: prose in a paragraph, title resolved.
  assert.equal(a.attrs.title, "Анамнез");
  assert.deepEqual(a.content, [{ type: "paragraph", content: [{ type: "text", text: "скарги на біль" }] }]);
  assert.deepEqual(p.content, [{ type: "paragraph", content: [] }]);
});

test("typed sections still carry prose like any other section", () => {
  const doc = bodyToDoc(template, { pain: "біль зліва" }, "en");
  assert.deepEqual(doc.content[1].content[0].content, [{ type: "text", text: "біль зліва" }]);
});

test("free_text SNAPSHOT: byte-identical to the pre-S13 mapping (regression guard)", () => {
  // Pinned literal = the exact JSON the pre-refactor TipTapEditor.bodyToDoc
  // (commit d8a75cf) produced for a prose-only template. The ProseMirror
  // render is a pure function of this doc, so byte-identity here IS the
  // pixel-stability guarantee for prose sections.
  const proseTemplate = {
    sections: [
      { id: "anamnesis", name: { uk: "Анамнез", en: "History" }, required: true },
      { id: "conclusion", name: { en: "Conclusion" }, required: false },
    ],
  };
  const snapshot = '{"type":"doc","content":[{"type":"section","attrs":{"id":"anamnesis","title":"Анамнез","kind":"free_text","required":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"скарги на біль"}]}]},{"type":"section","attrs":{"id":"conclusion","title":"Conclusion","kind":"free_text","required":false},"content":[{"type":"paragraph","content":[]}]}]}';
  assert.equal(
    JSON.stringify(bodyToDoc(proseTemplate, { anamnesis: "скарги на біль" }, "uk")),
    snapshot,
  );
});

test("unknown field_type falls through to prose: kind carries the raw value, content unchanged", () => {
  const doc = bodyToDoc(
    { sections: [{ id: "x", name: { en: "X" }, field_type: "future_type" }] },
    { x: "prose stays" },
    "en",
  );
  assert.equal(doc.content[0].attrs.kind, "future_type"); // inert attr, no renderer
  assert.deepEqual(doc.content[0].content, [
    { type: "paragraph", content: [{ type: "text", text: "prose stays" }] },
  ]);
});

// Minimal stand-in for a ProseMirror doc node (forEach / type.name /
// attrs / textContent are all docToBody touches).
function fakeDoc(sections) {
  return {
    forEach(fn) {
      for (const s of sections) {
        fn({ type: { name: "section" }, attrs: { id: s.id }, textContent: s.text });
      }
    },
  };
}

test("docToBody round-trips section text regardless of kind", () => {
  const body = { anamnesis: "a", pain: "b", diagnosis: "" };
  const round = docToBody(fakeDoc([
    { id: "anamnesis", text: "a" },
    { id: "pain", text: "b" },
    { id: "diagnosis", text: "" },
  ]));
  assert.deepEqual(round, body);
});
