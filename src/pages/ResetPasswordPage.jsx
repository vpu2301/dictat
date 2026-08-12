// ResetPasswordPage.jsx — /reset-password?token=…
//
// The landing page for the link in the reset email, and the second half
// of the lockdown flow (AccountRecoveryPage hands its fresh token
// straight here via `presetToken`, so the user never waits for a second
// email while somebody else is in their account).
//
// THE TOKEN RIDES IN THE HASH FRAGMENT — `#/reset-password?token=…`, not
// `?token=…#/reset-password`. That is the app's hash router, but it is
// also the safer of the two: a fragment is never sent to the server, so
// the token stays out of every proxy access log between the clinic and
// the app, and out of the Referer header if this page ever loads a
// third-party resource. The backend builds the URL the same way.
//
// The token is lifted out of the URL and into component state on mount,
// then the address bar is rewritten without it. A reset link left in
// somebody's browser history is a credential left in their browser
// history; it is single-use and short-lived, but there is no reason to
// keep it visible after it has been read.
import React, { useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { NewPasswordField, isPasswordSubmittable } from "../components/PasswordField.jsx";
import {
  fetchPasswordPolicy,
  isInvalidToken,
  passwordErrorCode,
  resetPassword,
  weakPasswordMinLength,
  weakPasswordReasons,
} from "../api/password.js";
import { tr } from "../i18n.js";

export function ResetPasswordPage({ navigate, lang = "en", token: presetToken = "", query }) {
  // Read once, on mount. Reading it during render would re-take it after
  // the address bar is scrubbed below and hand back an empty string.
  const [token] = useState(() => presetToken || (query && query.get("token")) || "");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | submitting | done
  const [error, setError] = useState(null);
  const [serverReasons, setServerReasons] = useState([]);
  const [minLength, setMinLength] = useState(12);

  useEffect(() => {
    // Scrub the credential out of the visible URL and out of history.
    if (!presetToken && token && typeof window !== "undefined") {
      window.history.replaceState(null, "", "#/reset-password");
    }
  }, [presetToken, token]);

  useEffect(() => {
    // Keep the meter honest against whatever this deployment enforces.
    let alive = true;
    fetchPasswordPolicy()
      .then((p) => { if (alive && p && p.min_length) setMinLength(p.min_length); })
      .catch(() => {}); // The default of 12 is a fine fallback.
    return () => { alive = false; };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordSubmittable(password, { minLength })) return;
    setPhase("submitting");
    setError(null);
    setServerReasons([]);
    try {
      await resetPassword(token, password);
      setPhase("done");
    } catch (err) {
      setPhase("idle");
      if (passwordErrorCode(err) === "weak_password") {
        setServerReasons(weakPasswordReasons(err));
        const min = weakPasswordMinLength(err);
        if (min) setMinLength(min);
      } else {
        setError(err);
      }
    }
  };

  // ── No token at all ────────────────────────────────────────────────
  if (!token) {
    return (
      <Shell navigate={navigate} lang={lang} title={tr(lang, "Посилання неповне", "Incomplete link")}>
        <div className="mk-auth-form">
          <p className="pw-note">
            <Icon name="alert" size={14} />
            {tr(
              lang,
              "У цьому посиланні немає коду відновлення. Скопіюйте адресу з листа повністю або запросіть нове посилання.",
              "This link has no recovery code in it. Copy the whole address from the email, or request a new link.",
            )}
          </p>
          <button className="mk-auth-btn primary" data-testid="request-new-link" onClick={() => navigate("/forgot-password")}>
            {tr(lang, "Запросити нове посилання", "Request a new link")}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <Shell navigate={navigate} lang={lang} title={tr(lang, "Пароль змінено", "Password changed")} mark="check">
        <div className="mk-auth-form" data-testid="reset-done">
          <p className="pw-note">
            <Icon name="shield" size={14} />
            {tr(
              lang,
              "Ми завершили всі сеанси на інших пристроях і надіслали вам лист із підтвердженням.",
              "We signed out every other device and sent you a confirmation email.",
            )}
          </p>
          <button className="mk-auth-btn primary" onClick={() => navigate("/login")}>
            {tr(lang, "Увійти", "Sign in")}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Expired / already used ─────────────────────────────────────────
  if (error && isInvalidToken(error)) {
    return (
      <Shell navigate={navigate} lang={lang} title={tr(lang, "Посилання більше не дійсне", "This link is no longer valid")} mark="alert">
        <div className="mk-auth-form">
          <p className="pw-note">
            <Icon name="clock" size={14} />
            {tr(
              lang,
              "Посилання для відновлення діє 30 хвилин і спрацьовує лише один раз. Це вже використано або його термін минув.",
              "Reset links last 30 minutes and work once. This one has either been used already or expired.",
            )}
          </p>
          <button className="mk-auth-btn primary" data-testid="request-new-link" onClick={() => navigate("/forgot-password")}>
            {tr(lang, "Запросити нове посилання", "Request a new link")}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell navigate={navigate} lang={lang} title={tr(lang, "Новий пароль", "Choose a new password")}>
      <form className="mk-auth-form" onSubmit={onSubmit} noValidate>
        <NewPasswordField
          value={password}
          onChange={(v) => { setPassword(v); if (serverReasons.length) setServerReasons([]); }}
          lang={lang}
          minLength={minLength}
          serverReasons={serverReasons}
          disabled={phase === "submitting"}
          autoFocus
        />

        {error && <ApiErrorView error={error} lang={lang} />}

        <button
          type="submit"
          className="mk-auth-btn primary"
          disabled={phase === "submitting" || !isPasswordSubmittable(password, { minLength })}
        >
          {phase === "submitting"
            ? tr(lang, "Збереження…", "Saving…")
            : tr(lang, "Встановити пароль", "Set new password")}
        </button>

        <p className="mk-auth-hint">
          {tr(
            lang,
            "Після зміни пароля всі активні сеанси буде завершено.",
            "Changing your password signs out every active session.",
          )}
        </p>
      </form>
    </Shell>
  );
}

function Shell({ navigate, lang, title, mark, children }) {
  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); navigate("/welcome"); }}>
          <span className="lp-brand-name">Klarnote</span>
        </a>
        {mark && (
          <div className={"pw-sent-mark" + (mark === "alert" ? " warn" : "")}>
            <Icon name={mark} size={26} />
          </div>
        )}
        <h1 className="mk-auth-title">{title}</h1>
        {children}
        <div className="mk-auth-foot">
          <a className="mk-auth-link" href="#/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>
            {tr(lang, "Повернутися до входу", "Back to sign in")}
          </a>
        </div>
      </div>
    </div>
  );
}
