// copy.js — conversation-mode microcopy (sprint 14). uk primary, en fallback,
// matching the repo's tr() convention. A11y strings live here too: a speaker
// label is a claim about who said something, so it must be ANNOUNCED, never
// carried by colour alone.

const uk = (lang) => lang === "uk";

// Roles, once the mapping knows them.
export const roleLabel = (role, lang) =>
  role === "doctor" ? (uk(lang) ? "Лікар" : "Doctor")
  : role === "patient" ? (uk(lang) ? "Пацієнт" : "Patient")
  : (uk(lang) ? "Невідомо" : "Unknown");

// Voices, before the mapping knows them. Deliberately NOT "Speaker 1/2" in a
// clinical register: it is a voice the machine separated, not a person it
// identified.
export const voiceLabel = (speaker, lang) =>
  speaker === "S1" ? (uk(lang) ? "Голос 1" : "Voice 1")
  : speaker === "S2" ? (uk(lang) ? "Голос 2" : "Voice 2")
  : speaker === "UNKNOWN" ? (uk(lang) ? "Невідомо" : "Unknown")
  : (uk(lang) ? "Визначається…" : "Resolving…");

// What the chip says: the role when the mapping can say, the voice otherwise.
export const speakerLabel = (speaker, role, lang) =>
  role ? roleLabel(role, lang) : voiceLabel(speaker, lang);

// Announced state. A machine label is "пропозиція" (a proposal); a clinician's
// is "підтверджено" — the same two words the sprint-13 grammar uses, so the
// whole product means one thing by them.
export const ariaTurn = (speaker, role, source, lang) => {
  const who = speakerLabel(speaker, role, lang);
  if (source === "clinician") return uk(lang) ? `${who} — підтверджено лікарем` : `${who} — confirmed by the clinician`;
  if (speaker === "UNKNOWN") return uk(lang) ? `${who} — система не змогла визначити` : `${who} — the system could not tell`;
  if (!speaker) return uk(lang) ? `${who} — мітка ще не надійшла` : `${who} — label has not arrived yet`;
  return uk(lang) ? `${who} — пропозиція, не підтверджено` : `${who} — proposed, not confirmed`;
};

export const flipHint = (lang) =>
  uk(lang) ? "Натисніть, щоб змінити мовця; утримуйте для вибору" : "Tap to switch speaker; hold to choose";

export const assignDoctor = (lang) => (uk(lang) ? "Це лікар" : "This is the clinician");
export const assignPatient = (lang) => (uk(lang) ? "Це пацієнт" : "This is the patient");
export const assignUnknown = (lang) => (uk(lang) ? "Невідомо" : "Unknown");

// The mapping banner. Colour is named in the text, because the colour itself
// is the thing the clinician has to be able to trust.
export const mappingKnown = (doctorVoice, lang) =>
  doctorVoice === "S2"
    ? (uk(lang) ? "Зелений — лікар, синій — пацієнт" : "Green — clinician, blue — patient")
    : (uk(lang) ? "Синій — лікар, зелений — пацієнт" : "Blue — clinician, green — patient");

export const mappingUnknown = (lang) =>
  uk(lang)
    ? "Система ще не визначила, хто лікар, а хто пацієнт"
    : "The system cannot yet tell which voice is the clinician";

export const mappingFrozen = (lang) =>
  uk(lang) ? "Визначено лікарем" : "Set by the clinician";

export const swapLabel = (lang) => (uk(lang) ? "Поміняти місцями" : "Swap");

export const unresolvedNote = (n, lang) =>
  uk(lang)
    ? `${n} ${n === 1 ? "репліка" : "реплік"} без мовця — можна залишити як є`
    : `${n} turn${n === 1 ? "" : "s"} without a speaker — may be left as is`;
