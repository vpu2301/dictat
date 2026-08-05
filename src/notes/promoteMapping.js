// promoteMapping.js — a note's sections → a report template's sections.
//
// A note is written against a note STRUCTURE (SOAP / APSO / DAP: keys "S",
// "O", "A", "P", "D"). A report is written against a report TEMPLATE, whose
// sections are things like `preop_diagnosis` or `assessment`. Promoting one
// into the other used to copy the note's keys verbatim, so the report was
// created with sections the template does not have: the API accepted it (create
// validates metadata, not keys) and the editor then rendered an EMPTY document.
// The clinician's text was in the record, addressed to nowhere.
//
// So: match each note section to the closest template section by NAME, using
// the same fuzzy resolver voice navigation uses ("Оцінка (A)" → "Assessment"),
// and put anything that matches nothing into the first section. Nothing is
// dropped, ever — a promote that loses a paragraph is worse than one that puts
// it under the wrong heading, because only the second is visible.
//
// When several note sections land in the same template section, each block
// keeps its note heading, so the merge is legible instead of a run-on.

import { findBestSection } from "../dictation/voiceCommands.js";

// "Скарги (S)" → "Скарги". The structure marker is for the note's own rail; to
// the matcher it is two characters of noise that push every label past the
// edit-distance tolerance.
const bare = (label) => String(label || "").replace(/\s*\([^)]*\)\s*$/, "").trim();

/**
 * @param {Array} noteSections   [{ id, label, text }] in the note's own order
 * @param {Array} templateSections toStudioTemplate() sections ({ id, name })
 * @returns {Object} { [templateSectionKey]: text }
 */
export function mapNoteToTemplate(noteSections = [], templateSections = []) {
  const filled = (noteSections || []).filter((s) => String(s?.text || "").trim());
  if (!filled.length) return {};

  // No template detail (offline, or a template without a schema) — keep the
  // note's own keys rather than inventing a mapping we cannot verify.
  if (!Array.isArray(templateSections) || !templateSections.length) {
    return Object.fromEntries(filled.map((s) => [s.id, s.text]));
  }

  const fallback = templateSections[0].id;
  const buckets = new Map();   // templateKey → [{ label, text }]
  for (const s of filled) {
    const name = bare(s.label) || s.id;
    const match = findBestSection(templateSections, name, name);
    const key = match ? match.id : fallback;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ label: s.label || s.id, text: String(s.text).trim() });
  }

  const out = {};
  for (const [key, blocks] of buckets) {
    out[key] = blocks.length === 1
      ? blocks[0].text
      : blocks.map((b) => `${b.label}\n${b.text}`).join("\n\n");
  }
  return out;
}
