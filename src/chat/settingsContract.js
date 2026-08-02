// chat/settingsContract.js — the module's settings, as data.
//
// The module owns WHICH settings exist, what they mean and where they persist.
// The host owns WHERE they are shown — and in this host that is the general
// settings page, alongside appearance, language and dictation, rather than a
// second settings surface hidden inside a feature.
//
// So the module publishes a contract instead of a screen: option lists with
// labels in both languages, plus the storage hook. A host renders them with its
// own controls and they look native, because they ARE native — the module never
// draws a settings row.

export { useSettings, DEFAULT_SETTINGS } from "./data/useSettings.js";

// Evidence detail — how much of each source the panel shows. Provenance
// (publisher, type, year, level) survives at every level; only the summary and
// identifiers are dropped, because a "compact" mode that hides where a claim
// came from would be hiding the point of the module.
export const EVIDENCE_DETAIL_OPTIONS = [
  { value: "compact", uk: "Стисло", en: "Compact" },
  { value: "full", uk: "Повністю", en: "Full" },
];

// Answer language — the language of answers and evidence records. NOT the UI
// language: the host owns that, and a clinician reading German guideline
// summaries in an English interface is a normal thing to want.
export const ANSWER_LANGUAGE_OPTIONS = [
  { value: "en", uk: "English", en: "English" },
  { value: "de", uk: "Deutsch", en: "Deutsch" },
];

export const SETTINGS_LABELS = {
  evidenceDetail: {
    uk: ["Деталізація джерел", "Тип, рік і рівень доказовості показуються завжди"],
    en: ["Evidence detail", "Type, year and evidence level always show"],
  },
  answerLanguage: {
    uk: ["Мова відповідей", "Мова відповідей і джерел, окремо від мови інтерфейсу"],
    en: ["Answer language", "The language of answers and sources, separate from the interface"],
  },
};

export const optionLabel = (options, value, lang) => {
  const found = options.find((o) => o.value === value);
  if (!found) return String(value);
  return lang === "uk" ? found.uk : found.en;
};
