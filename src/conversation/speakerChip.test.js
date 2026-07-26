// Sprint 14 — the speaker chip renders the sprint-13 proposal grammar, so a
// clinician reads "the machine thinks" and "I confirmed" the same way here as
// they do on a diagnosis chip. Rendered to static markup under node, exactly
// like proposalGrammar.test.js.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SpeakerChip, toneFor } from "./SpeakerChip.js";
import { chooseRole, chooseUnknown } from "./speakerActions.js";
import { emptyMapping, assignRole } from "./mapping.js";

const h = React.createElement;
const render = (props) => renderToStaticMarkup(h(SpeakerChip, { lang: "uk", ...props }));

test("a machine label is DASHED (proposal) + sparkle + confidence bars", () => {
  const html = render({ speaker: "S1", role: "doctor", confidence: 0.84, source: "machine" });
  assert.match(html, /pgm-proposal/);          // shape channel
  assert.match(html, /pgm-icon/);              // icon channel
  // Band comes from the shared fieldContract thresholds — 0.84 is "medium".
  // Never a raw percentage in the primary view; the number is hover-only.
  assert.match(html, /pgm-conf pgm-conf-medium/);
  assert.match(html, /title="середня впевненість \(84%\)"/);
  assert.doesNotMatch(html, />84%</);
  assert.match(html, /aria-label="Лікар — пропозиція, не підтверджено"/); // text channel
  assert.match(html, /cv-doctor/);             // colour channel (fifth, not first)
});

test("a clinician label is SOLID (confirmed) with NO confidence meter", () => {
  const html = render({ speaker: "S2", role: "patient", confidence: 0.84, source: "clinician" });
  assert.match(html, /pgm-confirmed/);
  assert.doesNotMatch(html, /pgm-conf[" ]|pgm-conf-(bar|low|medium|high)/);
  assert.match(html, /aria-label="Пацієнт — підтверджено лікарем"/);
});

test("UNKNOWN announces that the system could not tell", () => {
  const html = render({ speaker: "UNKNOWN", role: null, confidence: 0.2, source: "machine" });
  assert.match(html, /cv-unknown/);
  assert.match(html, /aria-label="Невідомо — система не змогла визначити"/);
});

test("an unlabelled turn says the label has not arrived — it does not guess", () => {
  const html = render({ speaker: null, role: null, source: "machine" });
  assert.match(html, /cv-pending/);
  assert.match(html, /Визначається…/);
  assert.match(html, /мітка ще не надійшла/);
});

test("without a mapping the chip names the VOICE, not a person", () => {
  const html = render({ speaker: "S1", role: null, confidence: 0.7, source: "machine" });
  assert.match(html, /Голос 1/);
  assert.doesNotMatch(html, /Лікар|Пацієнт/);
});

test("the chip is a real button carrying the flip", () => {
  const html = render({ speaker: "S1", role: "doctor", source: "machine" });
  assert.match(html, /^<button type="button"/);
  assert.match(html, /data-testid="speaker-chip"/);
});

test("tone maps role first, then voice, with UNKNOWN visibly neutral", () => {
  assert.equal(toneFor("S1", "doctor"), "doctor");
  assert.equal(toneFor("S2", "patient"), "patient");
  assert.equal(toneFor("S1", null), "voice1");
  assert.equal(toneFor("UNKNOWN", null), "unknown");
  assert.equal(toneFor(null, null), "pending");
});

// ── menu choice resolution ───────────────────────────────────────────
test("picking a role on a LABELLED turn changes the mapping, not the turn", () => {
  const res = chooseRole({ turnSpeaker: "S2", mapping: emptyMapping(), role: "doctor" });
  assert.equal(res.speaker, null, "the turn keeps its voice");
  assert.deepEqual(res.assign, { label: "S2", role: "doctor" });
});

test("picking a role on an UNKNOWN turn moves the turn to the voice holding it", () => {
  const [mapped] = assignRole(emptyMapping(), "S1", "doctor");
  const res = chooseRole({ turnSpeaker: "UNKNOWN", mapping: mapped, role: "patient" });
  assert.equal(res.speaker, "S2");
  assert.equal(res.assign, null, "the mapping already knew");
});

test("picking a role with nothing known defines the mapping and the turn", () => {
  const res = chooseRole({ turnSpeaker: null, mapping: emptyMapping(), role: "patient" });
  assert.equal(res.speaker, "S1");
  assert.deepEqual(res.assign, { label: "S1", role: "patient" });
});

test("answering 'unknown' is about the TURN and never touches the mapping", () => {
  const res = chooseUnknown();
  assert.equal(res.speaker, "UNKNOWN");
  assert.equal(res.assign, null);
});
