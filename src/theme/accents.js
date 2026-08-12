// accents.js — the accent palette, in one place.
//
// Two surfaces pick an accent: /settings (the real one) and the dev Tweaks
// panel. They used to carry two copies of the same hex list, which is how the
// two lists drift. The value written to `--accent` is the hex, so this file is
// the whole contract — nothing downstream needs the name.
//
// Every colour here clears 4.5:1 against white, because --accent is a BUTTON
// ground with white text on it (.btn.accent), not only a tint. That rules out
// the bright mid-tones a palette picker gravitates to (sky-500, orange-500):
// they look modern and render an unreadable button.
//
// Teal is the product's own colour and is deliberately unchanged.

export const ACCENTS = [
  { value: "#0a8a7a", uk: "Смарагдовий", en: "Teal" },
  { value: "#4f46e5", uk: "Індиго", en: "Indigo" },
  { value: "#9333ea", uk: "Фіолетовий", en: "Violet" },
  { value: "#e11d48", uk: "Рожевий", en: "Rose" },
  { value: "#334155", uk: "Графіт", en: "Graphite" },
];

export const DEFAULT_ACCENT = ACCENTS[0].value;

export const ACCENT_VALUES = ACCENTS.map((a) => a.value);

/** The palette entry for a hex, or null for a colour set outside the list. */
export function findAccent(hex) {
  const want = String(hex || "").toLowerCase();
  return ACCENTS.find((a) => a.value === want) || null;
}
