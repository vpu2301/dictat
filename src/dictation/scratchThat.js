// scratchThat.js — FE-only fallback for the "scratch that" intent.
//
// Backend has NO `scratch_that` / `delete_last_sentence` intent in either
// vocab seed (spec §C.2 sprint 05). To keep the UX promise we match the
// phrase client-side and trigger the existing undo-last-sentence flow.
//
// Caller wires this from inside the partial / final stream:
//   handlePartial(text) { if (matchScratchThat(text, lang)) editor.undoLastSentence() }

import { FE_ONLY_SCRATCH_PHRASES } from "./voiceCommands.js";

export function matchScratchThat(text, lang = "uk") {
  if (!text) return false;
  const patterns = FE_ONLY_SCRATCH_PHRASES[lang] || [];
  return patterns.some((re) => re.test(text));
}
