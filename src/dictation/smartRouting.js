// smartRouting.js — "smart dictation": which section did that sentence belong to?
//
// Word-by-word dictation puts every syllable into the section the clinician
// selected. Smart dictation lets them talk through the whole note in one pass
// and names the section as they go:
//
//   «Скарги: болить голова другий день»   → complaints  ← "болить голова…"
//   «Об'єктивно тони серця ритмічні»       → exam        ← "тони серця…"
//
// The routing is deliberately conservative, because the failure mode is not
// symmetric: text filed under the wrong heading is worse than text filed under
// the one the clinician had open. A leading phrase only steers the section when
//
//   · it is followed by a colon — an explicit, unambiguous heading, or
//   · it resolves to a section name/alias AND is long enough to be a name
//     rather than a stray first word (≥2 words, or ≥5 characters).
//
// Everything else is content and goes wherever the caret already is. The
// matcher itself is the same fuzzy resolver the «перейти до <розділ>» voice
// command uses (voiceCommands.findBestSection) — one vocabulary, so a section
// you can navigate to by voice is a section smart dictation can find.

import { findBestSection } from "./voiceCommands.js";

const MAX_PREFIX_WORDS = 4;

// Strip the trailing separator a spoken heading leaves behind.
const clean = (s) => String(s || "").replace(/^[\s:—–-]+|[\s:—–-]+$/g, "").trim();

/**
 * @param {Array} sections template sections ({ id, name, voice_aliases, ... })
 * @param {string} text     one final utterance
 * @returns {{ sectionId: string|null, text: string, explicit: boolean }}
 *          `sectionId` — the section this utterance names, or null to keep the
 *          current one. `text` — what is left to insert once the heading is
 *          removed (may be empty: a bare heading is a pure section switch).
 *          `explicit` — the heading was punctuated, not inferred.
 */
export function routeUtterance(sections, text) {
  const raw = String(text || "").trim();
  const out = { sectionId: null, text: raw, explicit: false };
  if (!raw || !Array.isArray(sections) || !sections.length) return out;

  const tokens = raw.split(/\s+/);
  const limit = Math.min(MAX_PREFIX_WORDS, tokens.length);

  // Longest candidate heading first: "об'єктивний огляд" must win over
  // "об'єктивний" when both resolve.
  for (let n = limit; n >= 1; n--) {
    const head = tokens.slice(0, n).join(" ");
    const headClean = clean(head);
    if (!headClean) continue;

    const colon = /[:—–]\s*$/.test(head) || /[:—–]\s*$/.test(tokens[n - 1] || "");
    const section = findBestSection(sections, headClean, headClean);
    if (!section) continue;

    // Inferred (no colon) headings must look like a name, not like the first
    // word of a sentence that happens to be close to one.
    if (!colon && n < 2 && headClean.length < 5) continue;

    return {
      sectionId: section.id,
      text: clean(tokens.slice(n).join(" ")),
      explicit: colon,
    };
  }

  return out;
}
