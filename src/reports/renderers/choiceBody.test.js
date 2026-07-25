// Sprint 13 step 03 — ChoiceBody VERIFY: an extracted value renders as a
// proposal; manual renders confirmed; empty renders plain selectable chips;
// the component is fully controlled by the section model (a model change —
// e.g. a step-07 voice op — re-renders the right chrome with no local
// state); keyboard affordances are native buttons. Save-fragment semantics
// are pinned at the pure layer (fieldActions.test.js) — these tests pin
// which state renders which affordance.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChoiceBody } from "./ChoiceBody.js";
import { FIXTURE_TEMPLATE, EXTRACTED_META, MANUAL_META } from "../fieldFixtures.js";

const h = React.createElement;
const section = FIXTURE_TEMPLATE.sections.find((s) => s.id === "pain_location");
const render = (props) =>
  renderToStaticMarkup(h(ChoiceBody, { section, lang: "uk", onChange: () => {}, ...props }));

test("empty: one plain chip per option, no proposal chrome anywhere", () => {
  const html = render({ fieldMeta: null });
  assert.equal((html.match(/class="rf-chip"/g) || []).length, 3);
  assert.doesNotMatch(html, /pgm-/);
  assert.match(html, /role="group" aria-label="Локалізація болю"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, />Загрудинний</); // labels from option.label, never the slug
  assert.doesNotMatch(html, />retrosternal</);
});

test("extracted (VERIFY): the selected option is a ProposalChip, the rest stay plain", () => {
  const html = render({ fieldMeta: EXTRACTED_META.choice }); // selected: retrosternal @0.87
  assert.match(html, /pgm-chip pgm-proposal/);
  assert.match(html, /aria-label="Загрудинний — запропоновано, не підтверджено"/);
  assert.match(html, /pgm-conf-high/);
  assert.match(html, /aria-label="Підтвердити: Загрудинний"/); // confirm tab-reachable
  assert.match(html, /aria-label="Відхилити: Загрудинний"/);
  assert.equal((html.match(/class="rf-chip"/g) || []).length, 2); // other options overridable
});

test("manual: ConfirmedChip with the clear affordance, no confidence", () => {
  const html = render({ fieldMeta: MANUAL_META.choice });
  assert.match(html, /pgm-chip pgm-confirmed/);
  assert.match(html, /aria-label="Загрудинний — підтверджено"/);
  assert.match(html, /aria-label="Прибрати: Загрудинний"/);
  assert.doesNotMatch(html, /pgm-conf[" ]|pgm-conf-(bar|low|medium|high)/);
});

test("controlled (VERIFY): the same component re-renders chrome purely from the model", () => {
  // Simulates a step-07 voice op: set_choice writes manual metadata into the
  // model → the proposal chrome must disappear with no local state fighting it.
  const before = render({ fieldMeta: EXTRACTED_META.choice });
  const after = render({ fieldMeta: { source: "manual", selected: "left_arm" } });
  assert.match(before, /pgm-proposal/);
  assert.doesNotMatch(after, /pgm-proposal/);
  assert.match(after, /aria-label="Ліва рука — підтверджено"/);
});

test("keyboard (VERIFY): every affordance is a native button — Tab/Space/Enter for free", () => {
  const html = render({ fieldMeta: EXTRACTED_META.choice });
  const buttons = html.match(/<button /g) || [];
  // 2 plain options + confirm + dismiss on the proposal chip.
  assert.equal(buttons.length, 4);
  assert.doesNotMatch(html, /tabindex="-1"/);
  assert.match(html, /type="button"/);
});

test("readOnly disables everything; empty options render nothing (defense-in-depth)", () => {
  const ro = render({ fieldMeta: EXTRACTED_META.choice, readOnly: true });
  assert.equal((ro.match(/<button [^>]*disabled/g) || []).length, 4);
  const none = renderToStaticMarkup(h(ChoiceBody, {
    section: { ...section, options: [] }, lang: "uk", onChange: () => {},
  }));
  assert.equal(none, "");
});
