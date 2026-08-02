// midSentence.js — the one gate that decides whether Layer C may ask at all.
//
// Ghost text is a CONTINUATION. Asking a model to continue a finished sentence
// produces a new sentence the clinician never started writing — the exact
// failure mode that makes generated text feel like an intruder. So Layer C
// fires only when the caret sits inside an unfinished sentence.
//
// Pure functions, no React, no network: this is the piece worth unit-testing
// on its own, because "did a request fire?" is a VERIFY assertion.

// Sentence-ending punctuation. Colons and semicolons are deliberately absent —
// «Скарги:» is a heading the clinician is about to fill in, not a finished
// thought, and it is one of the best moments to offer a continuation.
const TERMINAL = /[.!?…]/;

// Trailing quotes/brackets close a sentence that ended before them:
// «…у нормі».» is still a finished sentence.
const CLOSERS = /[»"'’”)\]]+$/;

// How much unfinished sentence must exist before we ask. Below this the prefix
// carries no clinical intent and the model can only guess — and a wrong ghost
// costs more attention than a missing one is worth.
export const MIN_FRAGMENT_CHARS = 8;

// The current, unfinished sentence: everything after the last terminal
// punctuation mark. Newlines end a sentence too — a fresh line is a fresh
// thought even when the previous one was never punctuated.
export function sentenceFragment(textBeforeCaret) {
  const text = String(textBeforeCaret ?? "");
  let cut = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (TERMINAL.test(ch) || ch === "\n") cut = i + 1;
  }
  return text.slice(cut);
}

// True when the caret is mid-sentence and the fragment is substantial enough
// to continue. False for: empty input, a caret parked right after terminal
// punctuation (with or without trailing whitespace/closers), a fresh line, and
// anything shorter than MIN_FRAGMENT_CHARS.
export function isMidSentence(textBeforeCaret, { minChars = MIN_FRAGMENT_CHARS } = {}) {
  const text = String(textBeforeCaret ?? "");
  if (!text) return false;

  // "…у нормі. " / "…у нормі.»" — the sentence is over; trailing whitespace or
  // closing punctuation does not reopen it.
  const settled = text.replace(/\s+$/, "").replace(CLOSERS, "");
  if (!settled) return false;
  if (TERMINAL.test(settled[settled.length - 1])) return false;

  return sentenceFragment(text).trim().length >= minChars;
}
