// AccountSecuritySection.jsx — the "Account & security" block in /settings.
//
// Replaces three disabled "Soon" buttons with two working ones: change
// your password, and see/end the sessions you have open. (The 2FA row
// keeps its placeholder — MFA enrolment has its own full-page flow at
// /mfa and a settings toggle would be a second, competing entrance.)
//
// A SELF-CONTAINED SECTION, following the ChatSettingsSection pattern:
// it exports both the nav descriptor and the component, so SettingsPage
// stays a registry rather than accumulating this screen's state.
//
// The change-password form is inline rather than a modal. It is the
// only control on this page that ends the user's own session, and a
// modal that vanishes on an outside click is the wrong container for
// something with that consequence.

import React from "react";
import { Icon } from "./UI.jsx";
import { Row, Section } from "./SettingsLayout.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";
import { NewPasswordField, isPasswordSubmittable } from "./PasswordField.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";
import {
  changePassword,
  fetchPasswordPolicy,
  fetchSessions,
  passwordErrorCode,
  revokeAllSessions,
  weakPasswordMinLength,
  weakPasswordReasons,
} from "../api/password.js";

export const ACCOUNT_SECURITY_SECTION = {
  id: "account",
  icon: "user",
  uk: "Акаунт і безпека",
  en: "Account & security",
};

function formatWhen(value, lang) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return d.toLocaleString(lang === "uk" ? "uk-UA" : lang === "de" ? "de-DE" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function AccountSecuritySection({ lang = "en", onToast }) {
  const T = (uk, en) => tr(lang, uk, en);
  const { state } = useAuth();
  const email = state?.dbUser?.email || state?.claims?.email || "";
  const displayName = state?.dbUser?.display_name || "";

  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [phase, setPhase] = React.useState("idle"); // idle | saving | done
  const [error, setError] = React.useState(null);
  const [serverReasons, setServerReasons] = React.useState([]);
  const [minLength, setMinLength] = React.useState(12);
  const [showCurrent, setShowCurrent] = React.useState(false);

  const [sessions, setSessions] = React.useState(null);
  const [sessionsError, setSessionsError] = React.useState(null);
  const [revoking, setRevoking] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetchPasswordPolicy()
      .then((p) => { if (alive && p?.min_length) setMinLength(p.min_length); })
      .catch(() => {});
    fetchSessions()
      .then((rows) => { if (alive) setSessions(rows); })
      .catch((e) => { if (alive) setSessionsError(e); });
    return () => { alive = false; };
  }, []);

  const reset = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setError(null);
    setServerReasons([]);
    setPhase("idle");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!current || !isPasswordSubmittable(next, { minLength, email, displayName })) return;
    setPhase("saving");
    setError(null);
    setServerReasons([]);
    try {
      await changePassword(current, next);
      setPhase("done");
      onToast?.(T("Пароль змінено. Інші сеанси завершено.", "Password changed. Other sessions signed out."));
      // The session this tab holds is revoked too, so there is nothing
      // useful left to show here — the client's 401 handling will move
      // the user to /login on their next request. Clearing the typed
      // secrets immediately is the only thing this screen still owes.
      setCurrent("");
      setNext("");
    } catch (err) {
      setPhase("idle");
      if (passwordErrorCode(err) === "weak_password") {
        setServerReasons(weakPasswordReasons(err));
        const min = weakPasswordMinLength(err);
        if (min) setMinLength(min);
      } else if (err?.status === 401) {
        setError({
          status: 401,
          problem: {
            title: T("Невірний поточний пароль", "Current password is wrong"),
            detail: T("Перевірте поточний пароль і спробуйте ще раз.", "Check your current password and try again."),
          },
        });
      } else {
        setError(err);
      }
    }
  };

  const signOutEverywhere = async () => {
    setRevoking(true);
    try {
      await revokeAllSessions();
      onToast?.(T("Усі сеанси завершено.", "Signed out everywhere."));
    } catch (err) {
      setSessionsError(err);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Section
      id={ACCOUNT_SECURITY_SECTION.id}
      icon={ACCOUNT_SECURITY_SECTION.icon}
      title={T(ACCOUNT_SECURITY_SECTION.uk, ACCOUNT_SECURITY_SECTION.en)}
    >
      <Row
        label={T("Змінити пароль", "Change password")}
        hint={T("Знадобиться поточний пароль", "You'll need your current password")}
      >
        <button
          type="button"
          className={"btn sm" + (open ? "" : " ghost")}
          onClick={() => (open ? reset() : setOpen(true))}
          aria-expanded={open}
        >
          {open ? T("Скасувати", "Cancel") : T("Змінити", "Change")}
        </button>
      </Row>

      {open && phase !== "done" && (
        <form className="pw-settings-form" onSubmit={submit} noValidate data-testid="change-password-form">
          <label className="mk-auth-field">
            <span>{T("Поточний пароль", "Current password")}</span>
            <div className="mk-auth-pw">
              <input
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={phase === "saving"}
                required
              />
              <button
                type="button"
                className="mk-auth-pw-toggle"
                onClick={() => setShowCurrent((v) => !v)}
                aria-pressed={showCurrent}
                aria-label={showCurrent ? T("Сховати пароль", "Hide password") : T("Показати пароль", "Show password")}
              >
                <Icon name={showCurrent ? "eyeOff" : "eye"} size={17} />
              </button>
            </div>
            <a
              className="mk-auth-link pw-forgot-inline"
              href="#/forgot-password"
              onClick={() => { /* full navigation — the hash router picks it up */ }}
            >
              {T("Не пам’ятаєте його?", "Don't remember it?")}
            </a>
          </label>

          <NewPasswordField
            value={next}
            onChange={(v) => { setNext(v); if (serverReasons.length) setServerReasons([]); }}
            lang={lang}
            minLength={minLength}
            email={email}
            displayName={displayName}
            serverReasons={serverReasons}
            disabled={phase === "saving"}
            id="settings-new-password"
          />

          {error && <ApiErrorView error={error} lang={lang} />}

          <p className="pw-note">
            <Icon name="shield" size={14} />
            {T(
              "Зміна пароля завершить сеанси на всіх пристроях, включно з цим, і ми надішлемо вам лист-підтвердження.",
              "Changing your password signs out every device including this one, and we'll email you a confirmation.",
            )}
          </p>

          <div className="pw-settings-actions">
            <button type="button" className="btn ghost sm" onClick={reset} disabled={phase === "saving"}>
              {T("Скасувати", "Cancel")}
            </button>
            <button
              type="submit"
              className="btn primary sm"
              disabled={phase === "saving" || !current || !isPasswordSubmittable(next, { minLength, email, displayName })}
            >
              {phase === "saving" ? T("Збереження…", "Saving…") : T("Змінити пароль", "Change password")}
            </button>
          </div>
        </form>
      )}

      {phase === "done" && (
        <p className="pw-note ok" data-testid="change-password-done">
          <Icon name="check" size={14} />
          {T(
            "Пароль змінено. Увійдіть знову з новим паролем.",
            "Password changed. Sign in again with your new password.",
          )}
        </p>
      )}

      <Row
        label={T("Двофакторна автентифікація", "Two-factor authentication")}
        hint={T("Додатковий захист входу", "Extra protection at sign-in")}
      >
        <a className="btn ghost sm" href="#/mfa">{T("Налаштувати", "Set up")}</a>
      </Row>

      <Row
        label={T("Активні сеанси", "Active sessions")}
        hint={T("Пристрої, де ви увійшли", "Devices where you're signed in")}
      >
        <button
          type="button"
          className="btn ghost sm danger"
          onClick={signOutEverywhere}
          disabled={revoking}
        >
          {revoking ? T("Завершення…", "Signing out…") : T("Вийти всюди", "Sign out everywhere")}
        </button>
      </Row>

      {sessionsError && <ApiErrorView error={sessionsError} lang={lang} />}

      {Array.isArray(sessions) && sessions.length > 0 && (
        <ul className="pw-sessions" data-testid="session-list">
          {sessions.map((s) => (
            <li key={s.id} className={"pw-session" + (s.current ? " current" : "")}>
              <Icon name={s.current ? "check" : "layers"} size={14} />
              <div>
                <div className="pw-session-ip">
                  {s.ip_address || T("Невідома адреса", "Unknown address")}
                  {s.current && <span className="pw-session-badge">{T("цей пристрій", "this device")}</span>}
                </div>
                <div className="pw-session-when">
                  {T("Остання активність", "Last active")}: {formatWhen(s.last_access_at, lang) || "—"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
