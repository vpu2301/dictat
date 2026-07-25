// dateInput.js — Sprint 13 step 04: date parsing/formatting for the
// date / date_with_note renderers. Storage is ALWAYS ISO "YYYY-MM-DD"
// (the pinned metadata contract); display is uk-formatted DD.MM.YYYY for
// uk, ISO elsewhere (unambiguous in a medical record).
//
// The renderer uses a native <input type="date"> (emits ISO, shows the
// browser locale's format, ships a picker) — parseDateTolerant covers
// typed text for non-native fallbacks and future text inputs:
// ISO, DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY → ISO; anything else (including
// impossible calendar dates) → null.

import { isRealIsoDate } from "./fieldContract.js";

export function parseDateTolerant(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isRealIsoDate(s) ? s : null;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isRealIsoDate(iso) ? iso : null;
}

export function formatDateDisplay(iso, lang) {
  if (!isRealIsoDate(iso || "")) return "";
  if (lang !== "uk") return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
