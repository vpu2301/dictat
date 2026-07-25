// Sprint 13 step 04 — NumericBody VERIFY: extracted pre-fills as a
// proposal (uk comma display), confirm→manual round-trips through the
// draft-save fragment (pinned at the pure layer), manual renders the
// confirmed chip, empty/ambiguous (incl. the BP compound case) keeps a
// plain input with prose intact by construction.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NumericBody } from "./NumericBody.js";
import { buildConfirm, buildOverride } from "../fieldActions.js";
import { FIXTURE_TEMPLATE, EXTRACTED_META, MANUAL_META } from "../fieldFixtures.js";

const h = React.createElement;
const section = FIXTURE_TEMPLATE.sections.find((s) => s.id === "lvef");
const render = (props) =>
  renderToStaticMarkup(h(NumericBody, { section, lang: "uk", onChange: () => {}, ...props }));

test("extracted (VERIFY): value+unit pre-filled in ProposalField, uk comma shown, band not number", () => {
  const html = render({ fieldMeta: { ...EXTRACTED_META.numeric_with_unit, value: 36.6, unit: "°C" } });
  assert.match(html, /pgm-field pgm-proposal/);
  assert.match(html, /Запропоновано з диктування — підтвердьте/);
  assert.match(html, /value="36,6"/);            // uk display comma
  assert.match(html, /value="°C"/);
  assert.match(html, /pgm-conf-high/);           // 0.91 → high band
  assert.doesNotMatch(html.replace(/title="[^"]*"/g, ""), /\d+\s*%/); // no raw percentage
  assert.match(html, />Підтвердити</);
  assert.match(html, />Відхилити</);
});

test("confirm→manual round-trip (VERIFY): the exact draft-save fragment", () => {
  const entry = { field_specific_metadata: EXTRACTED_META.numeric_with_unit }; // 42 %
  assert.deepEqual(buildConfirm(section, entry), {
    field_specific_metadata: { source: "manual", value: 42, unit: "%" },
  });
  // Editing to 36.7 then committing IS the override:
  assert.deepEqual(buildOverride(section, { value: 36.7, unit: "%" }), {
    field_specific_metadata: { source: "manual", value: 36.7, unit: "%" },
  });
});

test("manual: ConfirmedChip with formatted value+unit and the clear affordance", () => {
  const html = render({ fieldMeta: MANUAL_META.numeric_with_unit }); // 42 %
  assert.match(html, /pgm-chip pgm-confirmed/);
  assert.match(html, /42 % — підтверджено/);
  assert.match(html, /aria-label="Прибрати: 42 %"/);
  assert.doesNotMatch(html, /class="rf-num"/); // chip replaces the inputs
});

test("clear: override(null) is the explicit empty-metadata write", () => {
  assert.deepEqual(buildOverride(section, null), { field_specific_metadata: {} });
});

test("empty / BP-compound (VERIFY): plain inputs, zero proposal chrome — prose stays below", () => {
  // «сто сорок на дев'яносто» → backend binds nothing → fieldMeta null.
  const html = render({ fieldMeta: null });
  assert.doesNotMatch(html, /pgm-/);
  assert.match(html, /class="rf-num"/);
  assert.match(html, /inputmode="decimal"/i);     // comma typeable (not type=number)
  assert.match(html, /aria-label="ФВ ЛШ"/);
  assert.match(html, /aria-label="Одиниця вимірювання"/);
});

test("controlled: model change flips proposal→confirmed with no local-state residue", () => {
  const before = render({ fieldMeta: EXTRACTED_META.numeric_with_unit });
  const after = render({ fieldMeta: MANUAL_META.numeric_with_unit });
  assert.match(before, /pgm-proposal/);
  assert.doesNotMatch(after, /pgm-proposal/);
  assert.match(after, /pgm-confirmed/);
});

test("readOnly disables inputs and the confirm action", () => {
  const html = render({ fieldMeta: EXTRACTED_META.numeric_with_unit, readOnly: true });
  assert.match(html, /rf-num" [^>]*disabled/);
  assert.match(html, /pgm-btn-confirm" disabled/);
});
