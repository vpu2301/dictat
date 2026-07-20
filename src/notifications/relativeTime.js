// relativeTime.js — locale-aware "5 хв тому" / "5 min ago".
//
// Uses Intl.RelativeTimeFormat so the six supported locales get correct
// pluralisation for free; hand-rolled suffixes get Ukrainian plurals
// wrong (1 хвилина / 2 хвилини / 5 хвилин).
//
// `now` is injectable so the formatting is testable without a fake clock.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso, lang = "uk", now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = then - now; // negative for the past

  let value;
  let unit;
  const abs = Math.abs(diff);
  if (abs < MINUTE) {
    return justNow(lang);
  } else if (abs < HOUR) {
    value = Math.round(diff / MINUTE);
    unit = "minute";
  } else if (abs < DAY) {
    value = Math.round(diff / HOUR);
    unit = "hour";
  } else if (abs < 7 * DAY) {
    value = Math.round(diff / DAY);
    unit = "day";
  } else {
    return absoluteDate(iso, lang);
  }

  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(value, unit);
  } catch {
    return absoluteDate(iso, lang);
  }
}

function justNow(lang) {
  return lang === "uk" ? "щойно" : "just now";
}

export function absoluteDate(iso, lang = "uk") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Day-group heading: Today / Yesterday / an absolute date.
export function dayLabel(isoDate, lang = "uk", now = Date.now()) {
  const today = new Date(now);
  const todayKey = toKey(today);
  const yesterdayKey = toKey(new Date(now - DAY));
  if (isoDate === todayKey) return lang === "uk" ? "Сьогодні" : "Today";
  if (isoDate === yesterdayKey) return lang === "uk" ? "Учора" : "Yesterday";
  return absoluteDate(`${isoDate}T00:00:00Z`, lang);
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
