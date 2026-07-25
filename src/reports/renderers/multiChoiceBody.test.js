// Sprint 13 step 03 — MultiChoiceBody VERIFY: extracted set renders as
// per-value proposals + the set-level «Підтвердити всі»/«Відхилити всі»
// pair; manual set renders confirmed chips + plain toggles; fully
// controlled by the model. Set math (toggle/exclusive) and per-chip
// confirm/dismiss fragments are pinned in fieldActions.test.js.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MultiChoiceBody } from "./MultiChoiceBody.js";
import { FIXTURE_TEMPLATE, EXTRACTED_META } from "../fieldFixtures.js";

const h = React.createElement;
const section = FIXTURE_TEMPLATE.sections.find((s) => s.id === "risk_factors");
const render = (props) =>
  renderToStaticMarkup(h(MultiChoiceBody, { section, lang: "uk", onChange: () => {}, ...props }));

test("extracted set: each proposed value is a ProposalChip; unproposed options stay plain", () => {
  const html = render({ fieldMeta: EXTRACTED_META.multi_choice }); // smoking + hypertension @0.74
  assert.equal((html.match(/pgm-chip pgm-proposal/g) || []).length, 2);
  assert.match(html, /aria-label="Куріння — запропоновано, не підтверджено"/);
  assert.match(html, /aria-label="Гіпертензія — запропоновано, не підтверджено"/);
  assert.match(html, /pgm-conf-medium/);
  assert.equal((html.match(/class="rf-chip"/g) || []).length, 1); // diabetes plain
});

test("set-level actions render only while a proposal is pending", () => {
  const proposal = render({ fieldMeta: EXTRACTED_META.multi_choice });
  assert.match(proposal, />Підтвердити всі</);
  assert.match(proposal, />Відхилити всі</);
  const manual = render({ fieldMeta: { source: "manual", selected: ["smoking"] } });
  assert.doesNotMatch(manual, />Підтвердити всі</);
  const empty = render({ fieldMeta: null });
  assert.doesNotMatch(empty, /pgm-/);
});

test("manual set: confirmed chips with remove, others plain unpressed toggles", () => {
  const html = render({ fieldMeta: { source: "manual", selected: ["smoking", "diabetes"] } });
  assert.equal((html.match(/pgm-chip pgm-confirmed/g) || []).length, 2);
  assert.match(html, /aria-label="Куріння — підтверджено"/);
  assert.match(html, /aria-label="Прибрати: Діабет"/);
  assert.match(html, /class="rf-chip" aria-pressed="false"[^>]*>Гіпертензія</);
});

test("controlled (VERIFY): an external model change (voice op add_choice) re-renders cleanly", () => {
  const before = render({ fieldMeta: { source: "manual", selected: ["smoking"] } });
  const after = render({ fieldMeta: { source: "manual", selected: ["smoking", "diabetes"] } });
  assert.doesNotMatch(before, /aria-label="Діабет — підтверджено"/);
  assert.match(after, /aria-label="Діабет — підтверджено"/);
});

test("keyboard: all affordances are native buttons; readOnly hides set actions and disables chips", () => {
  const html = render({ fieldMeta: EXTRACTED_META.multi_choice });
  // 2 proposals × (confirm+dismiss) + 1 plain chip + confirm-all + dismiss-all.
  assert.equal((html.match(/<button /g) || []).length, 7);
  const ro = render({ fieldMeta: EXTRACTED_META.multi_choice, readOnly: true });
  assert.doesNotMatch(ro, />Підтвердити всі</);
  assert.equal((ro.match(/<button [^>]*disabled/g) || []).length, (ro.match(/<button /g) || []).length);
});

test("empty options render nothing (defense-in-depth)", () => {
  const none = renderToStaticMarkup(h(MultiChoiceBody, {
    section: { ...section, options: [] }, lang: "uk", onChange: () => {},
  }));
  assert.equal(none, "");
});
