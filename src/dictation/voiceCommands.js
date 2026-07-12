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
  { intent: "dash",           op: "insert_punctuation", arg: { value: "—", glue: "standalone" },
    uk: ["тире", "довге тире"],
    en: ["dash", "em dash"] },
  { intent: "colon",          op: "insert_punctuation", arg: { value: ":" },
    uk: ["двокрапка", "двокрапку"],
    en: ["colon"] },
  // ── Extended symbol set ────────────────────────────────────────────
  // arg.glue controls spacing when the symbol is inserted:
  //   "close"      attach to the previous word    ("50" + % → "50%") [default]
  //   "open"       space before, glue to the next ("(" + "текст" → "(текст")
  //   "both"       no space on either side        ("мг" + / + "добу" → "мг/добу")
  //   "standalone" spaces on both sides           ("а" + — + "б" → "а — б")
  { intent: "exclamation_mark", op: "insert_punctuation", arg: { value: "!" },
    uk: ["знак оклику"],
    en: ["exclamation mark"] },
  { intent: "semicolon",        op: "insert_punctuation", arg: { value: ";" },
    uk: ["крапка з комою"],
    en: ["semicolon"] },
  { intent: "ellipsis",         op: "insert_punctuation", arg: { value: "…" },
    uk: ["три крапки", "багатокрапка"],
    en: ["ellipsis", "dot dot dot"] },
  { intent: "hyphen",           op: "insert_punctuation", arg: { value: "-", glue: "both" },
    uk: ["дефіс"],
    en: ["hyphen"] },
  { intent: "en_dash",          op: "insert_punctuation", arg: { value: "–", glue: "both" },
    uk: ["коротке тире"],
    en: ["en dash"] },
  { intent: "open_double_quote",  op: "insert_punctuation", arg: { value: "“", glue: "open" },
    uk: ["відкрити подвійні лапки"],
    en: ["open double quote"] },
  { intent: "close_double_quote", op: "insert_punctuation", arg: { value: "”" },
    uk: ["закрити подвійні лапки"],
    en: ["close double quote"] },
  { intent: "open_single_quote",  op: "insert_punctuation", arg: { value: "‘", glue: "open" },
    uk: ["відкрити одинарні лапки"],
    en: ["open single quote"] },
  { intent: "close_single_quote", op: "insert_punctuation", arg: { value: "’" },
    uk: ["закрити одинарні лапки"],
    en: ["close single quote"] },
  { intent: "open_paren",       op: "insert_punctuation", arg: { value: "(", glue: "open" },
    uk: ["відкрити круглу дужку"],
    en: ["open paren", "open parenthesis"] },
  { intent: "close_paren",      op: "insert_punctuation", arg: { value: ")" },
    uk: ["закрити круглу дужку"],
    en: ["close paren", "close parenthesis"] },
  { intent: "open_bracket",     op: "insert_punctuation", arg: { value: "[", glue: "open" },
    uk: ["відкрити квадратну дужку"],
    en: ["open bracket"] },
  { intent: "close_bracket",    op: "insert_punctuation", arg: { value: "]" },
    uk: ["закрити квадратну дужку"],
    en: ["close bracket"] },
  { intent: "open_brace",       op: "insert_punctuation", arg: { value: "{", glue: "open" },
    uk: ["відкрити фігурну дужку"],
    en: ["open brace"] },
  { intent: "close_brace",      op: "insert_punctuation", arg: { value: "}" },
    uk: ["закрити фігурну дужку"],
    en: ["close brace"] },
  { intent: "slash",            op: "insert_punctuation", arg: { value: "/", glue: "both" },
    uk: ["скісна риска", "слеш"],
    en: ["slash", "forward slash"] },
  { intent: "backslash",        op: "insert_punctuation", arg: { value: "\\", glue: "both" },
    uk: ["зворотна скісна риска", "бекслеш"],
    en: ["backslash"] },
  { intent: "apostrophe",       op: "insert_punctuation", arg: { value: "’", glue: "both" },
    uk: ["апостроф"],
    en: ["apostrophe"] },
  { intent: "asterisk",         op: "insert_punctuation", arg: { value: "*", glue: "standalone" },
    uk: ["зірочка"],
    en: ["asterisk"] },
  { intent: "hash",             op: "insert_punctuation", arg: { value: "#", glue: "standalone" },
    uk: ["решітка"],
    en: ["hash"] },
  { intent: "numero_sign",      op: "insert_punctuation", arg: { value: "№", glue: "standalone" },
    uk: ["знак номера"],
    en: ["numero sign"] },
  { intent: "percent_sign",     op: "insert_punctuation", arg: { value: "%" },
    uk: ["знак відсотка"],
    en: ["percent sign"] },
  { intent: "ampersand",        op: "insert_punctuation", arg: { value: "&", glue: "standalone" },
    uk: ["амперсанд", "і комерційне"],
    en: ["ampersand"] },
  { intent: "at_sign",          op: "insert_punctuation", arg: { value: "@", glue: "both" },
    uk: ["собачка"],
    en: ["at sign"] },
  { intent: "plus_sign",        op: "insert_punctuation", arg: { value: "+", glue: "standalone" },
    uk: ["знак плюс"],
    en: ["plus sign"] },
  { intent: "minus_sign",       op: "insert_punctuation", arg: { value: "−", glue: "standalone" },
    uk: ["знак мінус"],
    en: ["minus sign"] },
  { intent: "equals_sign",      op: "insert_punctuation", arg: { value: "=", glue: "standalone" },
    uk: ["знак дорівнює"],
    en: ["equals sign"] },
  { intent: "underscore",       op: "insert_punctuation", arg: { value: "_", glue: "both" },
    uk: ["нижнє підкреслення"],
    en: ["underscore"] },
  { intent: "vertical_bar",     op: "insert_punctuation", arg: { value: "|", glue: "standalone" },
    uk: ["вертикальна риска"],
    en: ["vertical bar"] },
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
    uk: ["зберегти чернетку", "зберегти як чернетку", "зберегти"],
    en: ["save draft", "save as draft", "save"] },
  { intent: "undo_last",       op: "undo_last",
    uk: ["відмінити останнє", "скасувати останнє", "скасувати"],
    en: ["undo last", "undo that", "undo"] },
  { intent: "stop_dictation",  op: "stop_dictation",
    uk: ["стоп диктування", "зупинити диктування", "закінчити диктування", "кінець диктування"],
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

// ── Inline detection (Web Speech path) ──────────────────────────────
//
// Web Speech final results rarely contain a command in isolation — the
// clinician says "болить голова кома температура" as one utterance, so a
// whole-utterance equality check (matchVoiceCommand) misses it and the
// literal word lands in the note. segmentUtterance() walks the tokens and
// splits out embedded commands instead.
//
// Insert-type ops (punctuation, breaks, quotes) are safe to fire anywhere
// in the utterance. Action ops (save/undo/stop/template/navigate) only
// fire when the command stands alone or ends the utterance — a mid-
// sentence hit is almost always content, not intent.
export const INSERT_OPS = new Set([
  "insert_punctuation",
  "insert_paragraph_break",
  "insert_line_break",
  "insert_quote_marker",
]);

const _tableCache = {};
function phraseTable(lang) {
  if (_tableCache[lang]) return _tableCache[lang];
  const entries = [];
  for (const row of COMMANDS) {
    for (const p of row[lang] || []) {
      entries.push({ words: p.toLowerCase().split(/\s+/), row, phrase: p });
    }
  }
  entries.sort((a, b) => b.words.length - a.words.length); // longest-first
  _tableCache[lang] = entries;
  return entries;
}

const _normToken = (t) =>
  t.toLowerCase().replace(/^[«»"'([]+/, "").replace(/[.,!?:;«»"')\]]+$/, "");

// Split a final utterance into parts:
//   { type: "text", text }                       — literal content
//   { type: "command", row, phrase }             — detected command
export function segmentUtterance(text, lang = "uk") {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const tokens = raw.split(/\s+/);
  const norm = tokens.map(_normToken);
  const table = phraseTable(lang);

  const parts = [];
  let buf = [];
  const flush = () => {
    if (buf.length) { parts.push({ type: "text", text: buf.join(" ") }); buf = []; }
  };
  let i = 0;
  while (i < tokens.length) {
    let hit = null;
    for (const entry of table) {
      const n = entry.words.length;
      if (i + n > tokens.length) continue;
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (norm[i + j] !== entry.words[j]) { ok = false; break; }
      }
      if (ok) { hit = entry; break; }
    }
    if (!hit) { buf.push(tokens[i]); i++; continue; }
    const isLast = i + hit.words.length >= tokens.length;
    if (!INSERT_OPS.has(hit.row.op) && !isLast) {
      // Action command mid-utterance — treat as content.
      buf.push(tokens[i]);
      i++;
      continue;
    }
    flush();
    parts.push({ type: "command", row: hit.row, phrase: hit.phrase });
    i += hit.words.length;
  }
  flush();
  return parts;
}

// ── Section resolution ("перейти до <розділ>") ──────────────────────
//
// Spoken section names arrive mangled: ASR mishears ("хіт операції" for
// "Хід операції") and Ukrainian case endings ("до ходу операції") both
// break exact comparison. Resolve fuzzily instead — whole-string edit
// distance against every candidate name/alias, with tolerance scaled to
// the string length so short names stay strict.

function _lev(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

const _normPhrase = (s) => String(s || "").toLowerCase()
  .replace(/[.,!?:;«»"'()[\]]+/g, " ").replace(/\s+/g, " ").trim();

// Best-matching template section for a spoken phrase (plus an optional
// intent keyword like "diagnosis"). Returns the section or null.
export function findBestSection(sections, phrase, keyword) {
  if (!Array.isArray(sections) || !sections.length) return null;
  const queries = [phrase, keyword]
    .map(_normPhrase)
    .map((q) => q.replace(/^(розділ|section)\s+/, ""))
    .filter(Boolean);
  if (!queries.length) return null;

  let best = null;
  let bestDist = Infinity;
  for (const s of sections) {
    const candidates = [
      ...(s.voice_aliases || []),
      typeof s.name === "string" ? s.name : null,
      s.name?.uk, s.name?.en,
      s.anchor?.uk, s.anchor?.en,
      String(s.id || "").replace(/[_-]+/g, " "),
    ].map(_normPhrase).filter(Boolean);
    for (const q of queries) {
      for (const c of candidates) {
        const d = _lev(q, c);
        const tol = Math.min(3, Math.max(1, Math.floor(Math.min(q.length, c.length) * 0.3)));
        if (d <= tol && d < bestDist) { best = s; bestDist = d; }
      }
    }
  }
  return best;
}

// Action commands the caller must execute after the text is applied.
export function actionsOf(parts) {
  return parts
    .filter((p) => p.type === "command" && !INSERT_OPS.has(p.row.op) && p.row.op !== "undo_last")
    .map((p) => ({ op: p.row.op, intent: p.row.intent, phrase: p.phrase }));
}

// Drop the trailing sentence (or unterminated fragment) from `text`.
export function stripLastSentence(text) {
  let s = String(text || "").replace(/\s+$/, "");
  s = s.replace(/[.!?…]+$/, ""); // ignore the terminator of the last sentence
  const idx = Math.max(
    s.lastIndexOf("."), s.lastIndexOf("!"), s.lastIndexOf("?"),
    s.lastIndexOf("…"), s.lastIndexOf("\n"),
  );
  return idx >= 0 ? s.slice(0, idx + 1) : "";
}

// Append a segmented utterance to the current editor text. Punctuation
// attaches to the preceding word ("голова" + comma → "голова,"), breaks
// collapse trailing spaces, quotes glue to their side. `wrapText` lets the
// caller decorate literal runs (e.g. low-confidence [[...]] markers).
// undo_last is applied here (drops the last sentence); other action ops are
// left to the caller — collect them with actionsOf(parts).
export function appendUtterance(current, parts, { wrapText } = {}) {
  let cur = current || "";
  let glueNext = false; // set by "open"/"both" glue — next part attaches with no space
  const trimEnd = () => { cur = cur.replace(/[ \t]+$/, ""); };
  const sep = () =>
    !glueNext && cur && !cur.endsWith(" ") && !cur.endsWith("\n") ? " " : "";
  for (const part of parts) {
    if (part.type === "text") {
      const t = wrapText ? wrapText(part.text) : part.text;
      cur += sep() + t;
      glueNext = false;
      continue;
    }
    const { row } = part;
    switch (row.op) {
      case "insert_punctuation": {
        const v = (row.arg && row.arg.value) || "";
        const glue = (row.arg && row.arg.glue) || "close";
        if (glue === "close") { trimEnd(); cur += v; glueNext = false; }
        else if (glue === "open") { cur += sep() + v; glueNext = true; }
        else if (glue === "both") { trimEnd(); cur += v; glueNext = true; }
        else { cur += sep() + v; glueNext = false; } // standalone
        break;
      }
      case "insert_paragraph_break":
        trimEnd(); cur += "\n\n"; glueNext = false; break;
      case "insert_line_break":
        trimEnd(); cur += "\n"; glueNext = false; break;
      case "insert_quote_marker":
        if (row.arg && row.arg.value === "open") { cur += sep() + "«"; glueNext = true; }
        else { trimEnd(); cur += "»"; glueNext = false; }
        break;
      case "undo_last":
        cur = stripLastSentence(cur); glueNext = false;
        break;
      default:
        break; // action op — caller executes via actionsOf()
    }
  }
  return cur;
}

// Client-side fallback for `scratch that` — backend has NO such intent
// (spec §C.2 sprint 05). Bind this regex client-side and trigger undo_last.
export const FE_ONLY_SCRATCH_PHRASES = {
  uk: [/\bвідміни\s+(останнє|речення)\b/i, /\bвидали\s+останнє\b/i],
  en: [/\bscratch\s+that\b/i, /\bdelete\s+(that|the\s+last\s+sentence)\b/i],
};
