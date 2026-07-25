// Sprint 13 step 02 — the visual grammar, rendered to static markup under
// node (the primitives are authored with createElement precisely so this
// suite can exist without a DOM runner): proposal vs confirmed snapshots,
// colorblind redundancy (shape class + icon + text present — color never
// alone), a11y roles/labels, and the no-raw-percentage rule.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProposalChip } from "./proposal/ProposalChip.js";
import { ConfirmedChip } from "./proposal/ConfirmedChip.js";
import { ProposalField } from "./proposal/ProposalField.js";
import { ConfidenceDot } from "./proposal/ConfidenceDot.js";
import { ProposalActions } from "./proposal/ProposalActions.js";

const h = React.createElement;
const render = (el) => renderToStaticMarkup(el);

test("proposal chip: dashed-outline class + sparkle icon + announced state + confidence bars", () => {
  const html = render(h(ProposalChip, {
    label: "Загрудинний", confidence: 0.87, lang: "uk",
    onConfirm: () => {}, onDismiss: () => {},
  }));
  assert.match(html, /pgm-chip pgm-proposal/);                       // shape channel
  assert.match(html, /pgm-icon/);                                    // icon channel
  assert.match(html, /aria-label="Загрудинний — запропоновано, не підтверджено"/); // text channel
  assert.match(html, /pgm-conf pgm-conf-high/);                      // confidence band
  assert.match(html, /aria-label="Підтвердити: Загрудинний"/);       // per-value actions
  assert.match(html, /aria-label="Відхилити: Загрудинний"/);
  assert.equal((html.match(/<button/g) || []).length, 2);            // real buttons
  assert.match(html, /type="button"/);
});

test("confirmed chip: solid class, check icon, NO confidence anything", () => {
  const html = render(h(ConfirmedChip, { label: "Загрудинний", lang: "uk", onRemove: () => {} }));
  assert.match(html, /pgm-chip pgm-confirmed/);
  assert.match(html, /aria-label="Загрудинний — підтверджено"/);
  // No ConfidenceDot markup (`pgm-conf`/`pgm-conf-*` — NOT `pgm-confirmed`):
  // a confirmed value is fact, not probability.
  assert.doesNotMatch(html, /pgm-conf[" ]|pgm-conf-(bar|low|medium|high)/);
  assert.match(html, /aria-label="Прибрати: Загрудинний"/);
  // Without onRemove there is no button at all.
  const bare = render(h(ConfirmedChip, { label: "X", lang: "uk" }));
  assert.doesNotMatch(bare, /<button/);
});

test("the primary view NEVER shows a raw percentage; the number lives in the hover title only", () => {
  for (const el of [
    h(ProposalChip, { label: "L", confidence: 0.82, lang: "uk", onConfirm() {}, onDismiss() {} }),
    h(ProposalField, { label: "L", confidence: 0.82, lang: "uk", onConfirm() {}, onDismiss() {} },
      h("input", { type: "number" })),
  ]) {
    const html = render(el);
    const withoutTitles = html.replace(/title="[^"]*"/g, "");
    assert.doesNotMatch(withoutTitles, /\d+\s*%/, "raw % leaked into the primary view");
    assert.match(html, /title="[^"]*82%[^"]*"/); // detail available on hover
  }
});

test("confidence bands map to shape (bar count), not just color", () => {
  for (const [conf, band] of [[0.3, "low"], [0.7, "medium"], [0.9, "high"]]) {
    const html = render(h(ConfidenceDot, { confidence: conf, lang: "uk" }));
    assert.match(html, new RegExp(`pgm-conf-${band}`));
    const on = (html.match(/pgm-conf-bar on/g) || []).length;
    assert.equal(on, { low: 1, medium: 2, high: 3 }[band]); // shape channel
    assert.doesNotMatch(html.replace(/title="[^"]*"/g, ""), /\d+%/);
  }
  // Band words, not numbers, announced to screen readers.
  const html = render(h(ConfidenceDot, { confidence: 0.9, lang: "uk" }));
  assert.match(html, /aria-label="висока впевненість"/);
});

test("proposal field: microcopy header + wrapped input + explicit text actions", () => {
  const html = render(h(ProposalField, {
    label: "ФВ ЛШ", confidence: 0.66, lang: "uk",
    onConfirm: () => {}, onDismiss: () => {},
  }, h("input", { type: "number", defaultValue: 42 })));
  assert.match(html, /pgm-field pgm-proposal/);
  assert.match(html, /Запропоновано з диктування — підтвердьте/);
  assert.match(html, /<input type="number"/);
  assert.match(html, />Підтвердити</);
  assert.match(html, />Відхилити</);
  assert.match(html, /aria-label="ФВ ЛШ — запропоновано, не підтверджено"/);
});

test("actions: two real buttons, text-labeled, en fallback for non-uk languages", () => {
  const uk = render(h(ProposalActions, { lang: "uk", onConfirm() {}, onDismiss() {} }));
  assert.match(uk, />Підтвердити</);
  const de = render(h(ProposalActions, { lang: "de", onConfirm() {}, onDismiss() {} }));
  assert.match(de, />Confirm</);
  assert.match(de, />Dismiss</);
  const disabled = render(h(ProposalActions, { lang: "uk", confirmDisabled: true, onConfirm() {}, onDismiss() {} }));
  assert.match(disabled, /pgm-btn-confirm" disabled/);
});
