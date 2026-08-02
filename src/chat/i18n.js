// chat/i18n.js — the module's own translator.
//
// Deliberately NOT the host's src/i18n.js: the embed contract says the feature
// owns nothing global, and a module that reaches into the host's language
// registry stops being droppable into another host. `locale` arrives as a prop
// like everything else; anything that is not "uk" falls back to English.
//
// Note the second axis: `answerLanguage` (a feature setting) decides the
// language of ANSWERS and evidence records, independently of the UI locale.

export function t(locale, uk, en) {
  return locale === "uk" ? uk : en;
}

// Evidence records and canned answers carry German variants alongside English.
// `field` is the English key; the German one is its `…De` sibling.
export function pick(record, field, answerLanguage) {
  if (!record) return "";
  if (answerLanguage === "de") {
    const de = record[`${field}De`];
    if (de) return de;
  }
  return record[field] ?? "";
}

export function relative(iso, locale = "en") {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return String(iso);
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return t(locale, "щойно", "just now");
  const m = Math.floor(s / 60);
  if (m < 60) return t(locale, `${m} хв тому`, `${m}m ago`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(locale, `${h} год тому`, `${h}h ago`);
  const d = Math.floor(h / 24);
  if (d < 7) return t(locale, `${d} дн тому`, `${d}d ago`);
  return new Date(ms).toLocaleDateString(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Age from a date of birth, which is what a clinician reads — the DOB itself
// is shown next to it so nothing is hidden, but "67" is the number in play.
export function age(dob) {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

// Thousands separators for counts (a connector's corpus size, mostly). The
// grouping follows the UI locale, because it is a number the reader parses at a
// glance rather than content in the answer's language.
export function num(value, locale = "en") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(locale === "uk" ? "uk-UA" : "en-US");
}

export function formatDate(iso, locale = "en") {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return String(iso || "—");
  return new Date(ms).toLocaleDateString(locale === "uk" ? "uk-UA" : "en-US", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
