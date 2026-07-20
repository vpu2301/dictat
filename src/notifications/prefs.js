// prefs.js — the ONE place the preferences wire shape is converted.
//
// The wire sends a LIST of category rows plus top-level timezone /
// digest_hour:
//
//   { categories: [{ category, in_app_enabled, email_mode,
//                    is_default, digest_eligible }],
//     timezone, quiet_hours: { start, end }, digest_hour }
//
// The UI wants a map keyed by category, because every control is
// addressed by category and a list would force an O(n) find on each
// keystroke. Converting in components would mean several slightly
// different conversions; doing it here keeps the wire shape in exactly
// two functions.
//
// PUT is a FULL REPLACE with extra="forbid", so `toWire` always emits
// every category — an omitted one silently reverts to the catalog
// default instead of keeping the user's previous choice.

import { ALL_CATEGORIES, EMAIL_MODE } from "./constants.js";

// The browser's best guess, used when the user has never set one.
export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
  } catch {
    return "Europe/Kyiv";
  }
}

/**
 * Wire → UI.
 * @returns {{ matrix: Record<string, {inApp: boolean, email: string,
 *             isDefault: boolean, digestEligible: boolean}>,
 *             quietHours: {start: string|null, end: string|null},
 *             timezone: string, digestHour: number }}
 */
export function fromWire(view) {
  const matrix = {};
  for (const row of (view && view.categories) || []) {
    matrix[row.category] = {
      inApp: !!row.in_app_enabled,
      email: row.email_mode || EMAIL_MODE.OFF,
      // Echoed by the server so the UI can render "(default)" without
      // shipping its own copy of the backend catalog, which would drift.
      isDefault: !!row.is_default,
      digestEligible: !!row.digest_eligible,
    };
  }
  const quiet = (view && view.quiet_hours) || {};
  return {
    matrix,
    quietHours: { start: quiet.start ?? null, end: quiet.end ?? null },
    timezone: (view && view.timezone) || browserTimezone(),
    digestHour: view && Number.isFinite(view.digest_hour) ? view.digest_hour : 8,
  };
}

/**
 * UI → wire. Emits every known category, not just the touched ones.
 */
export function toWire(ui) {
  const categories = ALL_CATEGORIES.map((category) => {
    const row = (ui.matrix && ui.matrix[category]) || {};
    return {
      category,
      in_app_enabled: row.inApp !== false,
      email_mode: row.email || EMAIL_MODE.OFF,
    };
  });

  // The backend CHECK requires start and end to be set together; sending
  // one alone is a 422. Normalise a half-filled form to "disabled".
  const start = ui.quietHours && ui.quietHours.start;
  const end = ui.quietHours && ui.quietHours.end;
  const paired = start && end ? { start, end } : {};

  return {
    categories,
    timezone: ui.timezone || browserTimezone(),
    quiet_hours: paired,
    digest_hour: Number.isFinite(ui.digestHour) ? ui.digestHour : 8,
  };
}

// Quiet hours are stored as local wall-clock TIME (HH:MM[:SS]); the
// <input type="time"> value is HH:MM. Normalise both directions so a
// round-trip through the form does not change the stored value.
export function toTimeInput(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

export function fromTimeInput(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}:00` : null;
}

// A zero-width window silences nothing on the backend (start === end is
// treated as "not quiet"), so the form refuses it rather than letting a
// user save something that looks set but does nothing.
export function validateQuietHours({ start, end }) {
  if (!start && !end) return null;              // disabled — fine
  if (!start || !end) return "incomplete";      // half-filled
  if (toTimeInput(start) === toTimeInput(end)) return "zero_width";
  return null;
}
