// Sprint 13 step 04 — DateBody VERIFY: proposal → confirm → manual with ISO
// storage and uk display; date_with_note uses the SAME renderer (the note
// is the section prose); tolerant text parsing matrix; multi-date/empty ⇒
// plain picker with prose preserved.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DateBody } from "./DateBody.js";
import { buildConfirm, buildOverride } from "../fieldActions.js";
import { parseDateTolerant, formatDateDisplay } from "../dateInput.js";
import { getFieldRenderer } from "../fieldRegistry.js";
import { FIXTURE_TEMPLATE, EXTRACTED_META, MANUAL_META } from "../fieldFixtures.js";

const h = React.createElement;
const section = FIXTURE_TEMPLATE.sections.find((s) => s.id === "onset_date");
const render = (props) =>
  renderToStaticMarkup(h(DateBody, { section, lang: "uk", onChange: () => {}, ...props }));

test("extracted (VERIFY): ISO value in a native date input inside ProposalField", () => {
  const html = render({ fieldMeta: EXTRACTED_META.date }); // 2026-07-15 @0.8
  assert.match(html, /pgm-field pgm-proposal/);
  assert.match(html, /type="date"/);
  assert.match(html, /value="2026-07-15"/);      // ISO storage in the input
  assert.match(html, /pgm-conf-medium/);         // 0.8 → medium band
  assert.match(html, />Підтвердити</);
});

test("confirm→manual round-trip (VERIFY): exact fragments, ISO stored", () => {
  const entry = { field_specific_metadata: EXTRACTED_META.date };
  assert.deepEqual(buildConfirm(section, entry), {
    field_specific_metadata: { source: "manual", date: "2026-07-15" },
  });
  assert.deepEqual(buildOverride(section, "2026-07-16"), {
    field_specific_metadata: { source: "manual", date: "2026-07-16" },
  });
  assert.deepEqual(buildOverride(section, ""), { field_specific_metadata: {} }); // picker emptied = clear
});

test("manual: ConfirmedChip shows the uk display format, storage stays ISO", () => {
  const html = render({ fieldMeta: MANUAL_META.date });
  assert.match(html, /15\.07\.2026 — підтверджено/);   // DD.MM.YYYY display
  assert.match(html, /aria-label="Прибрати: 15\.07\.2026"/);
  assert.doesNotMatch(html, /type="date"/);
});

test("empty / multi-date: plain picker, no chrome (backend gave no metadata — prose stays)", () => {
  const html = render({ fieldMeta: null });
  assert.doesNotMatch(html, /pgm-/);
  assert.match(html, /class="rf-date" type="date"/);
  assert.match(html, /aria-label="Дата початку"/);
});

test("date_with_note dispatches to the SAME renderer — the note is the section prose", async () => {
  await import("./register.js");
  assert.equal(getFieldRenderer("date_with_note"), DateBody);
  assert.equal(getFieldRenderer("date"), DateBody);
  // And the metadata contract is identical for both (only {date}):
  const noteSection = { ...section, field_type: "date_with_note" };
  assert.deepEqual(buildOverride(noteSection, "2026-07-15"), {
    field_specific_metadata: { source: "manual", date: "2026-07-15" },
  });
});

test("parseDateTolerant matrix: ISO / uk formats → ISO; impossible dates → null", () => {
  for (const [raw, iso] of [
    ["2026-07-15", "2026-07-15"],
    ["15.07.2026", "2026-07-15"],
    ["15/07/2026", "2026-07-15"],
    ["15-07-2026", "2026-07-15"],
    ["1.7.2026", "2026-07-01"],
  ]) {
    assert.equal(parseDateTolerant(raw), iso, raw);
  }
  for (const bad of ["2026-02-30", "30.02.2026", "32.01.2026", "15.07.26", "июль", "", "2026/07/15"]) {
    assert.equal(parseDateTolerant(bad), null, bad);
  }
});

test("formatDateDisplay: uk DD.MM.YYYY, en keeps ISO (unambiguous), junk empty", () => {
  assert.equal(formatDateDisplay("2026-07-15", "uk"), "15.07.2026");
  assert.equal(formatDateDisplay("2026-07-15", "en"), "2026-07-15");
  assert.equal(formatDateDisplay("nope", "uk"), "");
});
