// dictations.js — what a clinician actually says, transcribed.
//
// One source for both places the site prints a spoken line: the hero readout
// under the claim chips, and the evidence constellation's caption, where each
// phrase is the sentence that pulled its cluster of guidelines back.
//
// They are shared rather than duplicated because they have to agree: the hero
// promises "Klarnote listens to the consultation", the evidence band shows the
// listening turning into citations, and a reader who scrolls between the two
// should be hearing the same clinic.
//
// WRITTEN AS SPEECH, NOT AS A NOTE. Numbers are spelled out the way they are
// said aloud — "сто шістдесят вісім на дев'яносто шість", not "168/96". That is
// what a recogniser receives, and it is the whole difference between a
// transcript and a form: the note gets the digits, the microphone gets the
// words. A demo that prints "BP 168/96" is showing the output while claiming
// to show the input.
//
// Each entry is [uk, en] and is keyed to a cluster in EvidenceGraph.jsx. The
// clinical content is deliberately ordinary — the findings that lead to the
// commonest questions in general practice, not rarities.

export const DICTATIONS = {
  bp: [
    "«Тиск сто шістдесят вісім на дев'яносто шість, приймає амлодипін п'ять міліграмів.»",
    "“Blood pressure a hundred and sixty-eight over ninety-six, on amlodipine five milligrams.”",
  ],
  af: [
    "«Пульс нерегулярний, на ЕКГ — фібриляція передсердь.»",
    "“Pulse is irregular, the ECG shows atrial fibrillation.”",
  ],
  sglt2: [
    "«Глікований гемоглобін вісім і чотири, ШКФ сорок сім.»",
    "“HbA1c eight point four, eGFR forty-seven.”",
  ],
  hf: [
    "«Задишка при навантаженні, фракція викиду тридцять два відсотки.»",
    "“Dyspnoea on exertion, ejection fraction thirty-two percent.”",
  ],
  pe: [
    "«Раптовий біль у грудях, ЧСС сто дванадцять, сатурація дев'яносто один.»",
    "“Sudden chest pain, heart rate a hundred and twelve, saturation ninety-one.”",
  ],
  cap: [
    "«Кашель п'ятий день, температура тридцять вісім і чотири, хрипи справа.»",
    "“Fifth day of cough, temperature thirty-eight four, crackles on the right.”",
  ],
};

/* The hero cycles all of them, in a fixed order. Not the object's key order —
 * that is an implementation detail of the file above, and the hero's sequence
 * is a piece of pacing: it opens on the commonest reading in general practice
 * and moves outward to the acute ones. */
export const HERO_SEQUENCE = ["bp", "cap", "sglt2", "af", "pe", "hf"];
