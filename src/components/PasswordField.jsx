// PasswordField.jsx — the "choose a new password" input, used by the
// reset page, the lockdown page and the settings dialog.
//
// One component for all three so the rules a user is held to look and
// read identically wherever they meet them. The three screens differ in
// what surrounds the field, never in what the field says.
//
// THE MESSAGE TABLE IS THE POINT. The backend rejects with reason slugs
// (`too_short`, `common`, `contains_identifier`…) rather than prose,
// precisely so the words can live here and reach every language the app
// speaks. `reasonText` is the single place those slugs become sentences;
// a slug the backend adds without a matching entry falls back to a
// generic line rather than rendering a raw identifier at a clinician.

import React from "react";
import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { localPasswordReasons, passwordScore } from "../api/password.js";

/** Turn a backend reason slug into a sentence in the user's language. */
export function reasonText(lang, reason, minLength = 12) {
  switch (reason) {
    case "too_short":
      return tr(
        lang,
        `Пароль має містити щонайменше ${minLength} символів.`,
        `Use at least ${minLength} characters.`,
      );
    case "too_long":
      return tr(lang, "Пароль задовгий (максимум 128 символів).", "That is too long (128 characters maximum).");
    case "common":
      return tr(
        lang,
        "Цей пароль надто поширений — його перевіряють першим під час атак.",
        "This password is too common — it is among the first any attack tries.",
      );
    case "contains_identifier":
      return tr(
        lang,
        "Пароль не повинен містити вашу пошту чи ім’я.",
        "Do not use your email address or name in the password.",
      );
    case "repeated":
      return tr(lang, "Забагато однакових символів.", "Too many repeated characters.");
    case "sequential":
      return tr(
        lang,
        "Уникайте послідовностей на кшталт «abcde» або «12345».",
        "Avoid runs like “abcde” or “12345”.",
      );
    case "whitespace_only":
      return tr(lang, "Пароль не може складатися лише з пробілів.", "A password cannot be only spaces.");
    default:
      return tr(lang, "Оберіть надійніший пароль.", "Choose a stronger password.");
  }
}

const SCORE_LABEL = (lang, score) =>
  [
    tr(lang, "Заслабкий", "Too weak"),
    tr(lang, "Слабкий", "Weak"),
    tr(lang, "Прийнятний", "Fair"),
    tr(lang, "Надійний", "Strong"),
    tr(lang, "Дуже надійний", "Very strong"),
  ][score] || "";

/**
 * A 0–4 meter. Display only — it never decides whether the password is
 * accepted, which is why a rejected password always shows an empty bar
 * regardless of how long it is: encouraging a password the server will
 * refuse is worse than showing nothing.
 */
export function PasswordMeter({ password, reasons, lang }) {
  const score = reasons.length ? 0 : passwordScore(password);
  if (!password) return null;
  return (
    <div className="pw-meter" data-testid="password-meter">
      <div className="pw-meter-track" role="img" aria-label={SCORE_LABEL(lang, score)}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={"pw-meter-seg" + (i < score ? ` on s${score}` : "")} />
        ))}
      </div>
      <span className={"pw-meter-label s" + score}>{SCORE_LABEL(lang, score)}</span>
    </div>
  );
}

/**
 * Controlled new-password input with a reveal toggle, a live meter and
 * live reasons.
 *
 * `serverReasons` are merged with the locally computed ones so a
 * rejection from the backend stays visible even for a rule the client
 * mirror does not implement. The client copy is a courtesy for
 * responsiveness; the server's answer is the truth, and when the two
 * disagree the server's must not vanish on the next keystroke.
 */
export function NewPasswordField({
  value,
  onChange,
  lang = "en",
  minLength = 12,
  email = "",
  displayName = "",
  serverReasons = [],
  disabled = false,
  autoFocus = false,
  label,
  id = "new-password",
}) {
  const [reveal, setReveal] = React.useState(false);
  const localReasons = React.useMemo(
    () => localPasswordReasons(value, { minLength, email, displayName }),
    [value, minLength, email, displayName],
  );
  // Server reasons first: they are the authoritative ones, and putting
  // them at the top means the message that actually blocked the submit
  // is the one the user reads first.
  const reasons = [...new Set([...serverReasons, ...localReasons])];
  const showReasons = value.length > 0 || serverReasons.length > 0;

  return (
    <label className="mk-auth-field">
      <span>{label || tr(lang, "Новий пароль", "New password")}</span>
      <div className="mk-auth-pw">
        <input
          id={id}
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={serverReasons.length > 0 ? "true" : undefined}
          aria-describedby={`${id}-reasons`}
          required
        />
        <button
          type="button"
          className="mk-auth-pw-toggle"
          onClick={() => setReveal((v) => !v)}
          disabled={disabled}
          aria-pressed={reveal}
          aria-label={reveal ? tr(lang, "Сховати пароль", "Hide password") : tr(lang, "Показати пароль", "Show password")}
        >
          <Icon name={reveal ? "eyeOff" : "eye"} size={17} />
        </button>
      </div>

      <PasswordMeter password={value} reasons={reasons} lang={lang} />

      <ul className="pw-reasons" id={`${id}-reasons`} aria-live="polite">
        {showReasons && reasons.length === 0 && (
          <li className="pw-reason ok">
            <Icon name="check" size={13} />
            {tr(lang, "Цей пароль підходить.", "This password will work.")}
          </li>
        )}
        {showReasons &&
          reasons.map((r) => (
            <li key={r} className="pw-reason bad">
              <Icon name="alert" size={13} />
              {reasonText(lang, r, minLength)}
            </li>
          ))}
      </ul>

      {!value && (
        <p className="mk-auth-hint">
          {tr(
            lang,
            `Щонайменше ${minLength} символів. Довга фраза з кількох слів надійніша за короткий набір символів.`,
            `At least ${minLength} characters. A long phrase of several words is stronger than a short jumble.`,
          )}
        </p>
      )}
    </label>
  );
}

/** True when the field is safe to submit — non-empty and locally clean. */
export function isPasswordSubmittable(value, { minLength = 12, email = "", displayName = "" } = {}) {
  return !!value && localPasswordReasons(value, { minLength, email, displayName }).length === 0;
}
