// voiceCommands.js — UK + EN vocabulary mirror.
//
// Source of truth: backend nlp-service intent seeds (spec §B sprint 05).
// We mirror them here for FE display purposes (voice command reference panel,
// keyboard-shortcut tooltips, and the FE-only `scratch_that` fallback).
//
// IMPORTANT: detection itself is server-side. This list is descriptive, not
// authoritative — backend may add intents in future sprints; if a Final
// message arrives with an `intent` we don't recognise locally, fall back to
// the `unknown_intent` operation.

export const COMMANDS = [
  // intent          op (FE)                    UK phrases                                         EN phrases
  { intent: "newparagraph",   op: "insert_paragraph_break",
    uk: ["новий абзац", "абзац", "новий параграф"],
    en: ["new paragraph", "paragraph break"] },
  { intent: "newline",        op: "insert_line_break",
    uk: ["новий рядок", "перенос рядка"],
    en: ["new line", "line break"] },
  { intent: "period",         op: "insert_punctuation", arg: { value: "." },
    uk: ["крапка", "крапку"],
    en: ["period", "full stop"] },
  { intent: "comma",          op: "insert_punctuation", arg: { value: "," },
    uk: ["кома", "кому"],
    en: ["comma"] },
  { intent: "question_mark",  op: "insert_punctuation", arg: { value: "?" },
    uk: ["знак питання", "питальний знак"],
    en: ["question mark"] },
  { intent: "section.diagnosis", op: "navigate_section",
    uk: ["розділ діагноз", "перейти до діагнозу"],
    en: ["section diagnosis", "go to diagnosis"] },
  { intent: "section.history",   op: "navigate_section",
    uk: ["розділ анамнез", "перейти до анамнезу"],
    en: ["section history", "go to history"] },
  { intent: "section.exam",      op: "navigate_section",
    uk: ["розділ огляд", "об'єктивний огляд"],
    en: ["section exam", "physical exam"] },
  { intent: "section.plan",      op: "navigate_section",
    uk: ["розділ план", "план лікування"],
    en: ["section plan", "treatment plan"] },
  { intent: "insert_template", op: "insert_template",
    uk: ["вставити шаблон", "шаблон"],
    en: ["insert template", "template"] },
  { intent: "save_draft",      op: "save_draft",
    uk: ["зберегти чернетку", "зберегти як чернетку"],
    en: ["save draft", "save as draft"] },
  { intent: "undo_last",       op: "undo_last",
    uk: ["відмінити останнє", "скасувати останнє"],
    en: ["undo last", "undo that"] },
  { intent: "stop_dictation",  op: "stop_dictation",
    uk: ["стоп диктування", "зупинити диктування", "закінчити диктування"],
    en: ["stop dictation", "end dictation"] },
  { intent: "begin_quote",     op: "insert_quote_marker", arg: { value: "open" },
    uk: ["відкрити лапки", "цитата початок"],
    en: ["open quote", "quote begin"] },
  { intent: "end_quote",       op: "insert_quote_marker", arg: { value: "close" },
    uk: ["закрити лапки", "цитата кінець"],
    en: ["close quote", "quote end"] },
];

// Quick lookup helpers.
export function phrasesFor(intent, lang = "uk") {
  const row = COMMANDS.find((c) => c.intent === intent || c.intent.startsWith(intent + "."));
  if (!row) return [];
  return row[lang] || [];
}

export function intentToOp(intent) {
  // Section navigation: backend emits `section.<sectionId>` with arg.section_id
  if (intent && intent.startsWith("section.")) return "navigate_section";
  const row = COMMANDS.find((c) => c.intent === intent);
  return row ? row.op : "unknown_intent";
}

// Match a spoken phrase (from the browser Web Speech path, where detection is
// NOT done server-side) against the command vocabulary. Returns the matching
// COMMANDS row, or null. Punctuation/whitespace on the ends is ignored.
export function matchVoiceCommand(text, lang = "uk") {
  const norm = String(text || "").trim().toLowerCase().replace(/[.,!?]+$/, "").trim();
  if (!norm) return null;
  return COMMANDS.find((c) => (c[lang] || []).some((p) => p.toLowerCase() === norm)) || null;
}

// Resolve a command row to the literal text it inserts (insert ops only).
export function insertionFor(row) {
  if (!row) return null;
  switch (row.op) {
    case "insert_paragraph_break": return "\n\n";
    case "insert_line_break":      return "\n";
    case "insert_punctuation":     return (row.arg?.value || "") + " ";
    case "insert_quote_marker":    return row.arg?.value === "open" ? "«" : "»";
    default:                       return null;
  }
}

// Client-side fallback for `scratch that` — backend has NO such intent
// (spec §C.2 sprint 05). Bind this regex client-side and trigger undo_last.
export const FE_ONLY_SCRATCH_PHRASES = {
  uk: [/\bвідміни\s+(останнє|речення)\b/i, /\bвидали\s+останнє\b/i],
  en: [/\bscratch\s+that\b/i, /\bdelete\s+(that|the\s+last\s+sentence)\b/i],
};
