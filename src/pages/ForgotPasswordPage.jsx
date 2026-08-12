// ForgotPasswordPage.jsx — /forgot-password.
//
// Replaces ForgotPasswordModal, which faked the request with a 500 ms
// timeout and then deep-linked to Keycloak's own reset form. There is a
// real endpoint now (POST /auth/password/forgot), and the reset happens
// inside this app, so the flow no longer leaves it.
//
// A PAGE, NOT A MODAL, because it has a sibling: /reset-password, which
// arrives from an email in a fresh tab and cannot be a modal over
// anything. Making both full screens means the two halves of one flow
// look like one flow.
//
// THE CONFIRMATION IS UNCONDITIONAL. The backend answers 202 for a real
// address, an unknown one, a deactivated one, and a throttled one, so
// that this endpoint cannot be used to discover who has an account.
// This screen must not undo that: there is exactly one success state and
// it never says whether the address was found. The only error rendered
// is a network or server failure, where nothing was learned about any
// account either way.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { requestPasswordReset } from "../api/password.js";
import { tr } from "../i18n.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage({ navigate, lang = "en", initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [phase, setPhase] = useState("idle"); // idle | submitting | sent
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setFieldError(tr(lang, "Введіть коректну електронну пошту.", "Enter a valid email address."));
      return;
    }
    setFieldError(null);
    setError(null);
    setPhase("submitting");
    try {
      await requestPasswordReset(email, lang);
      setPhase("sent");
    } catch (err) {
      // Only a transport/server failure lands here — the backend does
      // not distinguish outcomes, so there is nothing about the account
      // to leak in this branch.
      setPhase("idle");
      setError(err);
    }
  };

  if (phase === "sent") {
    return (
      <div className="lp mk-auth-shell">
        <div className="mk-auth">
          <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); navigate("/welcome"); }}>
            <span className="lp-brand-name">Klarnote</span>
          </a>
          <div className="pw-sent-mark"><Icon name="check" size={26} /></div>
          <h1 className="mk-auth-title">{tr(lang, "Перевірте пошту", "Check your email")}</h1>
          <p className="mk-auth-sub">
            {tr(
              lang,
              `Якщо для ${email} існує обліковий запис, ми надіслали посилання для встановлення нового пароля.`,
              `If an account exists for ${email}, we've sent a link to set a new password.`,
            )}
          </p>
          <div className="mk-auth-form" data-testid="forgot-sent">
            <p className="pw-note">
              <Icon name="clock" size={14} />
              {tr(
                lang,
                "Посилання діє 30 хвилин і спрацьовує один раз.",
                "The link is valid for 30 minutes and works once.",
              )}
            </p>
            <p className="pw-note">
              <Icon name="shield" size={14} />
              {tr(
                lang,
                "Не отримали листа? Перевірте теку зі спамом. Ваш пароль не змінено, доки ви не скористаєтеся посиланням.",
                "No email? Check your spam folder. Your password has not changed until you use the link.",
              )}
            </p>
            <button className="mk-auth-btn soft" onClick={() => { setPhase("idle"); }}>
              {tr(lang, "Надіслати ще раз", "Send again")}
            </button>
          </div>
          <div className="mk-auth-foot">
            <a className="mk-auth-link" href="#/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>
              {tr(lang, "Повернутися до входу", "Back to sign in")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); navigate("/welcome"); }}>
          <span className="lp-brand-name">Klarnote</span>
        </a>
        <h1 className="mk-auth-title">{tr(lang, "Відновлення пароля", "Reset your password")}</h1>
        <p className="mk-auth-sub">
          {tr(
            lang,
            "Вкажіть пошту вашого облікового запису — ми надішлемо посилання.",
            "Enter your account email and we'll send you a link.",
          )}
        </p>

        <form className="mk-auth-form" onSubmit={onSubmit} noValidate>
          <label className="mk-auth-field">
            <span>{tr(lang, "Електронна пошта", "Email")}</span>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(null); }}
              placeholder="you@clinic.example"
              disabled={phase === "submitting"}
              aria-invalid={fieldError ? "true" : undefined}
              required
            />
            {fieldError && <span className="mk-auth-err">{fieldError}</span>}
          </label>

          {error && <ApiErrorView error={error} lang={lang} />}

          <button type="submit" className="mk-auth-btn primary" data-testid="forgot-submit" disabled={phase === "submitting" || !email}>
            {phase === "submitting"
              ? tr(lang, "Надсилання…", "Sending…")
              : tr(lang, "Надіслати посилання", "Send reset link")}
          </button>
        </form>

        <div className="mk-auth-foot">
          <a className="mk-auth-link" href="#/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>
            {tr(lang, "Повернутися до входу", "Back to sign in")}
          </a>
        </div>
      </div>
    </div>
  );
}
