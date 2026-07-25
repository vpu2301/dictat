// Sprint 13 step 01 — templates.js mirrors the backend's sprint-13 template
// rules: choice/multi_choice are legal field types requiring 2..50 options,
// options are forbidden elsewhere, and removing an option value is a
// STRUCTURAL edit (stored selections would dangle).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { FIELD_TYPES, validateDefinition, classifyEdit, toStudioTemplate } from "./templates.js";

const section = (over = {}) => ({
  id: "pain", name: "Pain", field_type: "free_text", ...over,
});
const def = (sections) => ({ code: "card_exam", sections });

test("choice/multi_choice are registered field types", () => {
  assert.ok(FIELD_TYPES.includes("choice"));
  assert.ok(FIELD_TYPES.includes("multi_choice"));
});

test("choice sections need 2..50 options; other types must define none", () => {
  const noOpts = validateDefinition(def([section({ field_type: "choice" })]));
  assert.equal(noOpts.ok, false);
  assert.ok(noOpts.errors["sec.0.options"]);

  const ok = validateDefinition(def([section({
    field_type: "choice",
    options: [
      { value: "left", label: "Left", voice_aliases: ["зліва"] },
      { value: "right", label: "Right" },
    ],
  })]));
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const strayOpts = validateDefinition(def([section({
    options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
  })]));
  assert.equal(strayOpts.ok, false);
  assert.ok(strayOpts.errors["sec.0.options"]);
});

test("option values must be unique slugs; labels unique case-insensitively; aliases unique per section", () => {
  const dupValue = validateDefinition(def([section({
    field_type: "choice",
    options: [{ value: "left", label: "A" }, { value: "left", label: "B" }],
  })]));
  assert.equal(dupValue.ok, false);

  const dupLabel = validateDefinition(def([section({
    field_type: "choice",
    options: [{ value: "a", label: "Left" }, { value: "b", label: "LEFT" }],
  })]));
  assert.equal(dupLabel.ok, false);

  const dupAlias = validateDefinition(def([section({
    field_type: "multi_choice",
    options: [
      { value: "a", label: "A", voice_aliases: ["зліва"] },
      { value: "b", label: "B", voice_aliases: ["зліва"] },
    ],
  })]));
  assert.equal(dupAlias.ok, false);
});

test("classifyEdit: removing an option value is structural, label/add edits are cosmetic", () => {
  const before = def([section({
    field_type: "choice",
    options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }],
  })]);

  const removed = def([section({
    field_type: "choice",
    options: [{ value: "left", label: "Left" }],
  })]);
  assert.equal(classifyEdit(before, removed), "structural");

  const relabeled = def([section({
    field_type: "choice",
    options: [{ value: "left", label: "Left side" }, { value: "right", label: "Right" }],
  })]);
  assert.equal(classifyEdit(before, relabeled), "cosmetic");

  const added = def([section({
    field_type: "choice",
    options: [
      { value: "left", label: "Left" }, { value: "right", label: "Right" },
      { value: "both", label: "Both" },
    ],
  })]);
  assert.equal(classifyEdit(before, added), "cosmetic");

  assert.equal(classifyEdit(before, before), "no_change");
});

test("toStudioTemplate carries options through to Studio sections", () => {
  const tpl = {
    id: "t1", code: "card", specialty: "cardiology", name: "Cardio", status: "active",
    schema_jsonb: {
      sections: [{
        id: "pain", name: "Pain", field_type: "choice", order: 0,
        options: [{ value: "left", label: "Left", voice_aliases: ["зліва"] }, { value: "right", label: "Right" }],
      }],
    },
  };
  const studio = toStudioTemplate(tpl);
  assert.equal(studio.sections[0].field_type, "choice");
  assert.deepEqual(studio.sections[0].options.map((o) => o.value), ["left", "right"]);
  assert.equal(studio.sections[0].options[0].label, "Left");
});
