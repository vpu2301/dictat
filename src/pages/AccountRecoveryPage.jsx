// AccountRecoveryPage.jsx — /account-recovery?token=…
//
// Where the "This wasn't me — secure my account" button in the security
// notification email lands.
//
// THE ONE DESIGN DECISION WORTH DEFENDING: this page does NOT act on
// arriving. It shows what is about to happen and waits for a click.
//
// The tempting alternative is to fire the lockdown immediately, on the
// theory that someone opening this link is in trouble and every second
// counts. It is wrong, because links in email are followed by things
// that are not people — scanning proxies in corporate mail gateways,
// link-preview fetchers, antivirus crawlers. Any of them would consume
// the token and sign the real user out of every device, from an email
// that says a password was changed, which for the ~99% case where the
// change was legitimate turns a routine notification into an unexplained
// mass logout. A POST behind a deliberate click cannot be triggered by a
// GET-following crawler.
//
// Once confirmed, the backend hands back a fresh reset token, and this
// page passes it straight to ResetPasswordPage. No second email, no
// waiting on a relay while somebody else is in the account.
import React, { useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { ResetPasswordPage } from "./ResetPasswordPage.jsx";
import { isInvalidToken, triggerAccountLockdown } from "../api/password.js";
import { tr } from "../i18n.js";

export function AccountRecoveryPage({ navigate, lang = "en", query }) {
  const [token] = useState(() => (query && query.get("token")) || "");
  const [phase, setPhase] = useState("confirm"); // confirm | working | done
  const [resetToken, setResetToken] = useState("");
  const [revoked, setRevoked] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      window.history.replaceState(null, "", "#/account-recovery");
    }
  }, [token]);

  const run = async () => {
    setPhase("working");
    setError(null);
    try {
      const body = await triggerAccountLockdown(token);
      setResetToken(body.reset_token);
      setRevoked(body.sessions_revoked !== false);
      setPhase("done");
    } catch (err) {
      setPhase("confirm");
      setError(err);
    }
  };

  // Straight into setting a new password, carrying the handed-back token.
  if (phase === "done" && resetToken) {
    return (
      <>
        {!revoked && (
          <div className="pw-banner warn" role="alert">
            <Icon name="alert" size={15} />
            <span>
              {tr(
                lang,
                "Не всі сеанси вдалося завершити. Обов’язково встановіть новий пароль зараз і повідомте адміністратора клініки.",
                "Some sessions could not be ended. Set a new password now and tell your clinic administrator.",
              )}
            </span>
          </div>
        )}
        <ResetPasswordPage navigate={navigate} lang={lang} token={resetToken} />
      </>
    );
  }

  if (!token) {
    return (
      <Shell navigate={navigate} lang={lang} title={tr(lang, "Посилання неповне", "Incomplete link")} mark="alert">
        <div className="mk-auth-form">
          <p className="pw-note">
            <Icon name="alert" size={14} />
            {tr(
              lang,
              "У цьому посиланні немає коду. Скопіюйте адресу з листа повністю.",
              "This link has no code in it. Copy the whole address from the email.",
            )}
          </p>
          <button className="mk-auth-btn primary" data-testid="goto-forgot" onClick={() => navigate("/forgot-password")}>
            {tr(lang, "Відновити пароль", "Reset my password")}
          </button>
        </div>
      </Shell>
    );
  }

  if (error && isInvalidToken(error)) {
    return (
      <Shell navigate={navigate} lang={lang} title={tr(lang, "Посилання більше не дійсне", "This link is no longer valid")} mark="alert">
        <div className="mk-auth-form">
          <p className="pw-note">
            <Icon name="clock" size={14} />
            {tr(
              lang,
              "Це посилання вже використано або його термін минув. Якщо ви досі не можете увійти, відновіть пароль звичайним шляхом.",
              "This link has already been used or has expired. If you still cannot sign in, reset your password the usual way.",
            )}
          </p>
          <button className="mk-auth-btn primary" data-testid="goto-forgot" onClick={() => navigate("/forgot-password")}>
            {tr(lang, "Відновити пароль", "Reset my password")}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      navigate={navigate}
      lang={lang}
      title={tr(lang, "Захистити обліковий запис", "Secure your account")}
      mark="shield"
    >
      <div className="mk-auth-form" data-testid="lockdown-confirm">
        <p className="mk-auth-sub" style={{ margin: "0 0 4px" }}>
          {tr(
            lang,
            "Ви повідомили, що не змінювали свій пароль. Ми зробимо три речі:",
            "You told us you did not change your password. We will do three things:",
          )}
        </p>
        <ul className="pw-steps">
          <li>
            <Icon name="shield" size={14} />
            {tr(lang, "Завершимо сеанси на всіх пристроях.", "Sign out every device, everywhere.")}
          </li>
          <li>
            <Icon name="clock" size={14} />
            {tr(lang, "Скасуємо всі невикористані посилання для відновлення.", "Cancel every outstanding reset link.")}
          </li>
          <li>
            <Icon name="check" size={14} />
            {tr(lang, "Одразу дамо вам встановити новий пароль.", "Take you straight to setting a new password.")}
          </li>
        </ul>

        {error && <ApiErrorView error={error} lang={lang} />}

        <button className="mk-auth-btn primary danger" data-testid="lockdown-confirm-btn" onClick={run} disabled={phase === "working"}>
          {phase === "working"
            ? tr(lang, "Захищаємо…", "Securing…")
            : tr(lang, "Так, це були не я", "Yes — this wasn't me")}
        </button>
        <p className="mk-auth-hint">
          {tr(
            lang,
            "Якщо пароль змінили саме ви, просто закрийте цю сторінку — нічого не станеться.",
            "If you did change your password, just close this page — nothing will happen.",
          )}
        </p>
      </div>
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
          <div className={"pw-sent-mark" + (mark === "alert" ? " warn" : mark === "shield" ? " alert" : "")}>
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
