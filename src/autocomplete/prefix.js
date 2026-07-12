// Sprint 10 — prefix/token extraction for autocomplete (pure, unit-tested).
//
// The backend trie matches PHRASE PREFIXES ("зад" → "задишка при …", "біль
// за груд" → "біль за грудиною …") and the snippet dispatcher expects the
// trigger token WITH its leading slash ("/vitals"). The suggest query must
// therefore carry what the clinician is typing right now — never the whole
// section text (the wire model caps `prefix` at 80 chars, and unknown keys
// 422 under extra="forbid").
//
// Strategy: primary candidate is the SENTENCE STEM (text since the last
// sentence boundary) because corpus phrases are complete clinical clauses;
// when the stem misses, the caller retries with the LAST WORD alone (the
// stem may contain lead-in words like "пацієнт скаржиться на" that are not
// part of any corpus phrase).

// Ends a sentence / clause — the stem never crosses these.
const SENTENCE_BOUNDARY = /[.,;:!?()[\]{}«»"\n\r\t]/;

export const MAX_PREFIX_LEN = 80;
export const MIN_PHRASE_PREFIX = 2;

/**
 * @param {string} textBeforeCaret text of the current block up to the caret
 * @returns {{prefix: string, kind: 'phrase'|'snippet', fallback: string|null} | null}
 *   `prefix`   — what to query first (stem, or the slash trigger);
 *   `fallback` — last word to retry with when the stem yields nothing
 *                (null when identical to `prefix` or not useful);
 *   null       — nothing queryable (empty / too short / just after a boundary).
 */
export function extractPrefix(textBeforeCaret) {
  if (!textBeforeCaret) return null;
  const text = String(textBeforeCaret);

  const last = text[text.length - 1];
  if (last === " " || SENTENCE_BOUNDARY.test(last)) return null; // mid-boundary

  // Last whitespace-delimited token.
  let wordStart = text.length;
  while (
    wordStart > 0 &&
    text[wordStart - 1] !== " " &&
    !SENTENCE_BOUNDARY.test(text[wordStart - 1])
  ) {
    wordStart--;
  }
  const lastWord = text.slice(wordStart);

  // Snippet trigger: "/vitals" — keep the slash, no fallback.
  if (lastWord.startsWith("/")) {
    if (lastWord.length < 2 || lastWord.slice(1).includes("/")) return null;
    return { prefix: lastWord.slice(0, MAX_PREFIX_LEN), kind: "snippet", fallback: null };
  }

  // Sentence stem: from the last sentence boundary to the caret.
  let stemStart = text.length;
  while (stemStart > 0 && !SENTENCE_BOUNDARY.test(text[stemStart - 1])) stemStart--;
  let stem = text.slice(stemStart).trimStart();

  if (stem.length > MAX_PREFIX_LEN) {
    // Keep the tail, aligned to a word start.
    let cut = stem.length - MAX_PREFIX_LEN;
    while (cut < stem.length && stem[cut - 1] !== " ") cut++;
    stem = stem.slice(cut);
  }

  if (stem.length < MIN_PHRASE_PREFIX) return null;
  const fallback =
    lastWord !== stem && lastWord.length >= MIN_PHRASE_PREFIX ? lastWord : null;
  return { prefix: stem, kind: "phrase", fallback };
}
