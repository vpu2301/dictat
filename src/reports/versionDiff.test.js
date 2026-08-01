// Version-diff shaping. The regression these lock down: the diff view used to
// read `version.body`, a key GET /v1/reports/{id}/versions/{n} never returns —
// so every section diffed empty-against-empty and "Compare versions" rendered
// a blank page. Payloads below are trimmed from the live report-service.
import test from "node:test";
import assert from "node:assert/strict";
import { versionBody, humanizeKey, diffSectionList } from "./versionDiff.js";

const V2 = {
  version_number: 2,
  content: {
    template_id: "fbde6106",
    template_schema_version: 1,
    sections: [
      { section_key: "preop_diagnosis", text: "Цукровий діабет 2 типу", icd10: [], field_specific_metadata: {} },
      { section_key: "postop_diagnosis", text: "Ампутація правої стопи" },
    ],
  },
  rendered_text: "preop_diagnosis\nЦукровий діабет 2 типу\n",
};

const V3 = {
  version_number: 3,
  content: {
    template_id: "fbde6106",
    sections: [
      { section_key: "preop_diagnosis", text: "Цукровий діабет 2 типу" },
      { section_key: "postop_diagnosis", text: "Ампутація правої стопи. Без ускладнень" },
    ],
  },
  rendered_text: "…",
};

test("versionBody flattens content.sections — the wire shape has no `body`", () => {
  assert.equal("body" in V2, false);
  assert.deepEqual(versionBody(V2), {
    preop_diagnosis: "Цукровий діабет 2 типу",
    postop_diagnosis: "Ампутація правої стопи",
  });
});

test("versionBody: missing text is empty string, not undefined", () => {
  const body = versionBody({ content: { sections: [{ section_key: "plan" }] } });
  assert.deepEqual(body, { plan: "" });
});

test("versionBody: sectionless free-text version falls back to rendered_text", () => {
  assert.deepEqual(
    versionBody({ content: { sections: [] }, rendered_text: "Вільний текст" }),
    { note: "Вільний текст" },
  );
});

test("versionBody: sections win over rendered_text, no synthetic note", () => {
  assert.deepEqual(Object.keys(versionBody(V2)), ["preop_diagnosis", "postop_diagnosis"]);
});

test("versionBody tolerates a null/absent version", () => {
  assert.deepEqual(versionBody(null), {});
  assert.deepEqual(versionBody({}), {});
});

test("diffSectionList: template order wins, titles localized from the template", () => {
  const template = {
    sections: [
      { id: "preop_diagnosis", name: { uk: "Передопераційний діагноз", en: "Pre-op diagnosis" } },
      { id: "postop_diagnosis", name: { uk: "Післяопераційний діагноз", en: "Post-op diagnosis" } },
      { id: "specimen", name: { uk: "Препарат", en: "Specimen" } },
    ],
  };
  const rows = diffSectionList({ template, bodies: [versionBody(V2), versionBody(V3)], lang: "uk" });
  assert.deepEqual(rows.map(r => r.id), ["preop_diagnosis", "postop_diagnosis", "specimen"]);
  assert.equal(rows[0].title, "Передопераційний діагноз");
});

test("diffSectionList: no template — sections come from the versions themselves", () => {
  const rows = diffSectionList({ bodies: [versionBody(V2), versionBody(V3)], lang: "uk" });
  assert.deepEqual(rows.map(r => r.id), ["preop_diagnosis", "postop_diagnosis"]);
  assert.equal(rows[0].title, "Preop Diagnosis"); // humanized key, no label source
});

test("diffSectionList: keys a later template revision dropped still diff, after the template ones", () => {
  const template = { sections: [{ id: "preop_diagnosis", name: { uk: "Діагноз" } }] };
  const rows = diffSectionList({ template, bodies: [versionBody(V2), versionBody(V3)], lang: "uk" });
  assert.deepEqual(rows.map(r => r.id), ["preop_diagnosis", "postop_diagnosis"]);
});

test("diffSectionList: server-resolved section_labels beat the template name", () => {
  const template = { sections: [{ id: "preop_diagnosis", name: { uk: "З шаблону" } }] };
  const labelMap = { preop_diagnosis: { uk: "З сервера", en: "From server" } };
  const rows = diffSectionList({ template, labelMap, bodies: [versionBody(V2)], lang: "uk" });
  assert.equal(rows[0].title, "З сервера");
});

test("diffSectionList: no duplicate rows when both versions carry the same key", () => {
  const rows = diffSectionList({ bodies: [versionBody(V2), versionBody(V2)] });
  assert.equal(rows.length, 2);
});

test("humanizeKey turns a section_key into a readable fallback title", () => {
  assert.equal(humanizeKey("postop_diagnosis"), "Postop Diagnosis");
  assert.equal(humanizeKey("note"), "Note");
});
