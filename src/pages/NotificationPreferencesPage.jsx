// NotificationPreferencesPage.jsx — the per-category channel matrix.
//
// Kept prop-driven where it can be: sprint 17's admin screen reuses the
// same matrix to edit TENANT defaults, so the table is a component that
// takes rows + an onChange rather than reaching into the store itself.
//
// Saving is optimistic with rollback. The PUT is a full replace, so
// `savePreferences` always sends the complete matrix (see prefs.toWire).

import React, { useEffect, useState } from "react";

import { Icon } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { Row, Section, SettingsNav, Toggle, useSettingsSections } from "../components/SettingsLayout.jsx";
import { tr } from "../i18n.js";
import { ALL_CATEGORIES, EMAIL_MODE } from "../notifications/constants.js";
// Shared with the history page's category filter — one wording per
// category, in one place.
import { categoryLabel, emailModeLabel } from "../notifications/labels.js";
import { toTimeInput, fromTimeInput, validateQuietHours } from "../notifications/prefs.js";
import { useNotifications } from "../notifications/store.jsx";

/**
 * The reusable matrix. `rows` is [{category, inApp, email, isDefault,
 * digestEligible}]; `onChange(category, patch)` bubbles a single cell.
 */
export function PreferenceMatrix({ rows, onChange, lang = "uk", disabled = false }) {
  return (
    <table className="np-matrix">
      <thead>
        <tr>
          <th scope="col">{tr(lang, "Подія", "Event")}</th>
          <th scope="col">{tr(lang, "У застосунку", "In app")}</th>
          <th scope="col">{tr(lang, "Пошта", "Email")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.category}>
            <th scope="row">
              <span className="np-cat">{categoryLabel(row.category, lang)}</span>
              {row.isDefault && (
                <span className="np-default">{tr(lang, "за умовчанням", "default")}</span>
              )}
            </th>
            <td>
              {/* Same switch as every other on/off setting on /settings. */}
              <Toggle
                on={row.inApp !== false}
                disabled={disabled}
                onChange={(v) => onChange(row.category, { inApp: v })}
                label={`${tr(lang, "У застосунку", "In app")}: ${categoryLabel(row.category, lang)}`}
              />
            </td>
            <td>
              <MenuSelect
                value={row.email || EMAIL_MODE.OFF}
                disabled={disabled}
                ariaLabel={`${tr(lang, "Пошта", "Email")}: ${categoryLabel(row.category, lang)}`}
                onChange={(v) => onChange(row.category, { email: v })}
                options={[
                  { value: EMAIL_MODE.OFF, label: emailModeLabel(EMAIL_MODE.OFF, lang) },
                  { value: EMAIL_MODE.IMMEDIATE, label: emailModeLabel(EMAIL_MODE.IMMEDIATE, lang) },
                  // The server refuses to batch a failure into tomorrow's
                  // summary; offering the option would be a lie.
                  ...(row.digestEligible
                    ? [{ value: EMAIL_MODE.DIGEST, label: emailModeLabel(EMAIL_MODE.DIGEST, lang) }]
                    : []),
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Digest hour is a 0–23 integer on the wire; show it as a wall clock.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, "0")}:00`,
}));

// A short zone list rather than free text — the server only accepts IANA names,
// and a typo silently shifts every quiet window. The browser's own zone is
// always offered, and a value we don't recognise is kept as its own option so
// selecting nothing can't erase it.
const COMMON_ZONES = [
  "Europe/Kyiv", "Europe/Warsaw", "Europe/Berlin", "Europe/Bucharest",
  "Europe/Prague", "Europe/Belgrade", "Europe/Budapest", "Europe/London", "UTC",
];

function timezoneOptions(current) {
  let local = "";
  try {
    local = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    local = "";
  }
  const zones = [];
  for (const z of [local, current, ...COMMON_ZONES]) {
    if (z && !zones.includes(z)) zones.push(z);
  }
  return zones.map((z) => ({
    value: z,
    label: z.replace(/_/g, " "),
    sub: z === local ? "local" : undefined,
  }));
}

// ── Section registry (drives both the side nav and the rendered order) ────────
const SECTIONS = [
  { id: "events", icon: "bell",  uk: "Події та канали", en: "Events & channels" },
  { id: "quiet",  icon: "moon",  uk: "Тихі години",     en: "Quiet hours" },
  { id: "digest", icon: "clock", uk: "Щоденний підсумок", en: "Daily digest" },
];

export default function NotificationPreferencesPage({ lang = "uk", navigate }) {
  const n = useNotifications();
  const [dirty, setDirty] = useState(null);
  const [saved, setSaved] = useState(false);
  const [quietError, setQuietError] = useState(null);
  const T = (uk, en) => tr(lang, uk, en);
  // Hooks stay above the disabled-environment early return.
  const { active, jump } = useSettingsSections(SECTIONS);

  useEffect(() => {
    if (n && n.enabled && !n.preferences.loaded && !n.preferences.loading) {
      n.loadPreferences();
    }
  }, [n]);

  const header = (
    <div className="page-h">
      <div>
        <h1>{T("Сповіщення", "Notifications")}</h1>
        <p className="muted">
          {T(
            "Канали для кожної події, тихі години та щоденний підсумок.",
            "Channels per event, quiet hours and the daily digest.",
          )}
        </p>
      </div>
    </div>
  );

  if (!n || !n.enabled) {
    return (
      <div className="page settings-page np-page">
        {header}
        <section className="card settings-card">
          <p className="muted" style={{ margin: 0 }}>
            {T("Сповіщення вимкнено в цьому середовищі.", "Notifications are disabled in this environment.")}
          </p>
        </section>
      </div>
    );
  }

  const prefs = n.preferences;
  const working = dirty || {
    matrix: prefs.matrix,
    quietHours: prefs.quietHours,
    timezone: prefs.timezone,
    digestHour: prefs.digestHour,
  };

  const rows = ALL_CATEGORIES.map((category) => ({
    category,
    ...(working.matrix[category] || { inApp: true, email: EMAIL_MODE.OFF, isDefault: true }),
  }));

  const patch = (next) => {
    setSaved(false);
    setDirty({ ...working, ...next });
  };

  const onCell = (category, cell) =>
    patch({
      matrix: {
        ...working.matrix,
        [category]: { ...(working.matrix[category] || {}), ...cell, isDefault: false },
      },
    });

  const onSave = async () => {
    const err = validateQuietHours(working.quietHours);
    if (err) {
      setQuietError(err);
      return;
    }
    setQuietError(null);
    const ok = await n.savePreferences(working);
    if (ok) {
      setDirty(null);
      setSaved(true);
    }
  };

  return (
    <div className="page settings-page np-page">
      {header}

      <div className="settings-layout">
        <SettingsNav
          sections={SECTIONS.map((s) => ({ id: s.id, icon: s.icon, label: T(s.uk, s.en) }))}
          active={active}
          onJump={jump}
          label={T("Розділи сповіщень", "Notification sections")}
        />

        <div className="settings-main">
          {prefs.error && (
            <div className="np-error card settings-card" role="alert">
              {T("Не вдалося зберегти налаштування.", "Could not save preferences.")}{" "}
              {prefs.error.message}
            </div>
          )}

          <Section id="events" icon="bell" title={T("Події та канали", "Events & channels")}>
            <p className="settings-row-hint np-intro">
              {T(
                "Листи містять лише код звіту та посилання — без медичних даних пацієнта.",
                "Emails contain only a report code and a link — never patient data.",
              )}
            </p>
            {prefs.loading ? (
              <p className="muted">{T("Завантаження…", "Loading…")}</p>
            ) : (
              <PreferenceMatrix rows={rows} onChange={onCell} lang={lang} disabled={prefs.saving} />
            )}
          </Section>

          <Section id="quiet" icon="moon" title={T("Тихі години", "Quiet hours")}>
            <p className="settings-row-hint np-intro">
              {T(
                "Листи відкладаються до кінця вікна. Сповіщення в застосунку не відкладаються.",
                "Emails are held until the window ends. In-app notifications are never delayed.",
              )}
            </p>
            <Row label={T("Початок", "Start")}>
              <input
                type="time"
                className="input"
                value={toTimeInput(working.quietHours.start)}
                disabled={prefs.saving}
                aria-label={T("Початок", "Start")}
                onChange={(e) =>
                  patch({
                    quietHours: { ...working.quietHours, start: fromTimeInput(e.target.value) },
                  })
                }
              />
            </Row>
            <Row label={T("Кінець", "End")}>
              <input
                type="time"
                className="input"
                value={toTimeInput(working.quietHours.end)}
                disabled={prefs.saving}
                aria-label={T("Кінець", "End")}
                onChange={(e) =>
                  patch({
                    quietHours: { ...working.quietHours, end: fromTimeInput(e.target.value) },
                  })
                }
              />
            </Row>
            <Row
              label={T("Часовий пояс", "Timezone")}
              hint={T("Вікно рахується за цим поясом", "The window is evaluated in this zone")}
            >
              <MenuSelect
                value={working.timezone || ""}
                options={timezoneOptions(working.timezone)}
                disabled={prefs.saving}
                ariaLabel={T("Часовий пояс", "Timezone")}
                onChange={(v) => patch({ timezone: v })}
              />
            </Row>
            {quietError === "incomplete" && (
              <p className="np-error" role="alert">
                {T("Вкажіть і початок, і кінець.", "Set both a start and an end.")}
              </p>
            )}
            {quietError === "zero_width" && (
              <p className="np-error" role="alert">
                {T(
                  "Початок і кінець збігаються — це вікно нічого не приглушує.",
                  "Start and end are the same — that window silences nothing.",
                )}
              </p>
            )}
          </Section>

          <Section id="digest" icon="clock" title={T("Щоденний підсумок", "Daily digest")}>
            <Row
              label={T("Час підсумку", "Digest hour")}
              hint={T("Година доби, коли надходить один лист-підсумок", "Hour of the day the single summary email arrives")}
            >
              <MenuSelect
                value={String(working.digestHour)}
                options={HOUR_OPTIONS}
                disabled={prefs.saving}
                ariaLabel={T("Час підсумку", "Digest hour")}
                onChange={(v) => patch({ digestHour: Number(v) })}
              />
            </Row>
          </Section>

          <div className="np-actions">
            <button type="button" className="btn primary" onClick={onSave} disabled={prefs.saving || !dirty}>
              {prefs.saving ? T("Збереження…", "Saving…") : T("Зберегти", "Save")}
            </button>
            {dirty && (
              <button type="button" className="btn" onClick={() => { setDirty(null); setQuietError(null); }}>
                {T("Скасувати", "Cancel")}
              </button>
            )}
            {saved && (
              <span className="np-saved" role="status">
                <Icon name="check" size={13} /> {T("Збережено", "Saved")}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn ghost sm" onClick={() => navigate?.("/settings")}>
              <Icon name="sliders" size={13} /> {T("Усі налаштування", "All settings")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
