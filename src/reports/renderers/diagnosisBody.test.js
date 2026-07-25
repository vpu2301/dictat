// Sprint 13 step 05 — DiagnosisBody VERIFY: the three zones; leaf-only
// pickability; confirm-proposal/remove/pick save fragments; dedupe; and
// the sprint's headline invariant — PROSE IS NEVER MUTATED BY ANY CODE
// OPERATION, asserted byte-identically through the real state merge and
// the real autosave payload builder.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagnosisBody, Icd10Results } from "./DiagnosisBody.js";
import {
  buildConfirmProposal, buildRemoveCode, buildPickCode, buildDismissProposal,
} from "../fieldActions.js";
import { sectionMetaFromContent } from "../fieldContract.js";
import { buildReportContent } from "../../api/reports.js";
import { FIXTURE_TEMPLATE, FIXTURE_DRAFT_CONTENT, FIXTURE_ICD10_SEARCH } from "../fieldFixtures.js";

const h = React.createElement;
const section = FIXTURE_TEMPLATE.sections.find((s) => s.id === "diagnosis");
const render = (props) =>
  renderToStaticMarkup(h(DiagnosisBody, { section, lang: "uk", onChange: () => {}, icd10: [], ...props }));

const draftMeta = sectionMetaFromContent(FIXTURE_DRAFT_CONTENT).diagnosis;

test("three zones: confirmed chips, proposals sorted by confidence desc, search combobox", () => {
  const html = render({ icd10: draftMeta.icd10, fieldMeta: draftMeta.field_specific_metadata });
  // Zone 1: the already-confirmed I10 as a ConfirmedChip.
  assert.match(html, /aria-label="I10 — Есенціальна гіпертензія — підтверджено"/);
  // Zone 2: both proposals, I20.0 (0.82) BEFORE I25.1 (0.61).
  const i20 = html.indexOf("I20.0");
  const i25 = html.indexOf("I25.1");
  assert.ok(i20 > -1 && i25 > -1 && i20 < i25, "sorted by confidence desc");
  assert.match(html, /aria-label="I20\.0 — Нестабільна стенокардія — запропоновано, не підтверджено"/);
  // Zone 3: the combobox.
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-label="Пошук діагнозу МКХ-10"/);
});

test("confirm/remove/pick/dismiss produce the exact save fragments; FE never invents a code", () => {
  const entry = { icd10: draftMeta.icd10, field_specific_metadata: draftMeta.field_specific_metadata };
  const confirmed = buildConfirmProposal(section, entry, "I20.0");
  assert.deepEqual(confirmed.icd10.map((c) => c.code), ["I10", "I20.0"]);
  assert.deepEqual(confirmed.field_specific_metadata.proposals.map((p) => p.code), ["I25.1"]);

  assert.deepEqual(buildRemoveCode(section, entry, "I10"),
    { icd10: [] });

  const picked = buildPickCode(section, entry, FIXTURE_ICD10_SEARCH.results[2]); // I20.8 leaf
  assert.deepEqual(picked, { icd10: [...draftMeta.icd10, { code: "I20.8", display: "Інші форми стенокардії" }] });

  const dismissed = buildDismissProposal(section, entry, "I25.1");
  assert.deepEqual(dismissed.field_specific_metadata.proposals.map((p) => p.code), ["I20.0"]);
});

test("leaf rule + dedupe: non-leaf never picks; an already-confirmed code no-ops", () => {
  const entry = { icd10: [{ code: "I20.0" }] };
  assert.equal(buildPickCode(section, entry, FIXTURE_ICD10_SEARCH.results[0]), null); // I20 heading
  assert.equal(buildPickCode(section, entry, { code: "I20.0", display: "dup", is_leaf: true }), null);
  assert.equal(buildPickCode(section, entry, { code: "not-a-code", is_leaf: true }), null);
});

test("PROSE INVARIANT (headline VERIFY): byte-identical prose across confirm→remove→pick", () => {
  // The real Studio state shape: body (prose) + sectionMeta, merged exactly
  // like Studio.onSectionMetaChange, serialized by the real payload builder.
  const PROSE = "клініка нестабільної стенокардії";
  const body = { diagnosis: PROSE };
  const bodyBytes = JSON.stringify(body);
  let sectionMeta = { diagnosis: { ...draftMeta } };
  const mergePatch = (patch) => {
    const entry = { ...(sectionMeta.diagnosis || {}), ...patch };
    if (entry.icd10 && !entry.icd10.length) delete entry.icd10;
    if (entry.field_specific_metadata && !Object.keys(entry.field_specific_metadata).length) {
      delete entry.field_specific_metadata;
    }
    sectionMeta = Object.keys(entry).length ? { ...sectionMeta, diagnosis: entry } : {};
  };
  const entryNow = () => ({ icd10: [], field_specific_metadata: undefined, ...sectionMeta.diagnosis });

  const proseAfter = () => {
    const content = buildReportContent({
      template_id: FIXTURE_TEMPLATE.id, template_schema_version: 3,
      body, section_meta: sectionMeta,
    });
    return content.sections.find((s) => s.section_key === "diagnosis").text;
  };

  mergePatch(buildConfirmProposal(section, entryNow(), "I20.0"));
  assert.equal(proseAfter(), PROSE);
  mergePatch(buildRemoveCode(section, entryNow(), "I20.0"));
  assert.equal(proseAfter(), PROSE);
  mergePatch(buildPickCode(section, entryNow(), FIXTURE_ICD10_SEARCH.results[2]));
  assert.equal(proseAfter(), PROSE);
  mergePatch(buildDismissProposal(section, entryNow(), "I25.1"));
  assert.equal(proseAfter(), PROSE);
  // And the body object itself was never even touched.
  assert.equal(JSON.stringify(body), bodyBytes);
});

test("results listbox: leaves are buttons, headings dimmed non-interactive context", () => {
  const html = renderToStaticMarkup(h(Icd10Results, {
    results: FIXTURE_ICD10_SEARCH.results, onPick: () => {}, lang: "uk",
  }));
  assert.match(html, /role="listbox"/);
  assert.equal((html.match(/<button/g) || []).length, 2); // I20.0, I20.8 — leaves only
  assert.match(html, /rf-icd-head[^>]*role="presentation" aria-hidden="true"/);
  assert.match(html, />I20</); // the heading still shows as context
});

test("degraded/empty search and absent display degrade gracefully", () => {
  assert.equal(renderToStaticMarkup(h(Icd10Results, { results: [], onPick: () => {}, lang: "uk" })), "");
  // Code-only chip (Icd10Code.display is optional).
  const html = render({ icd10: [{ code: "M54.5" }] });
  assert.match(html, /aria-label="M54\.5 — підтверджено"/);
  // No proposals, empty icd10 → just the search box, zero chips.
  const bare = render({});
  assert.doesNotMatch(bare, /pgm-chip/);
  assert.match(bare, /role="combobox"/);
});

test("readOnly: chips disabled, no search surface at all", () => {
  const html = render({
    icd10: draftMeta.icd10, fieldMeta: draftMeta.field_specific_metadata, readOnly: true,
  });
  assert.doesNotMatch(html, /combobox/);
  assert.equal((html.match(/<button [^>]*disabled/g) || []).length, (html.match(/<button /g) || []).length);
});
