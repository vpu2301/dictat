// LoginPage.jsx — /login. Username + password → access token + /auth/me.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal.jsx";
import { login as apiLogin, me as apiMe } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

export function LoginPage({ navigate, lang = "en" }) {
  const { setState } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | submitting | success | error
  const [error, setError] = useState(null);
  const [mfaToast, setMfaToast] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setPhase("submitting");
    setError(null);
    setMfaToast(false);
    try {
      await apiLogin(email, password);
      const meBody = await apiMe();
      setState({ claims: meBody.claims, dbUser: meBody.db_user });
      setPhase("success");
      navigate("/");
    } catch (err) {
      setPhase("error");
      const status = err && err.status;
      const wwwAuth = err && err.problem && err.problem.www_authenticate;
      if (status === 401 && (wwwAuth || "").toLowerCase().includes("mfa")) {
        setMfaToast(true);
      } else if (status === 401) {
        setError({ status, problem: { title: tr(lang, "Невірний логін", "Invalid email or password"),
          detail: tr(lang, "Перевірте логін та пароль.", "Check your username and password.") } });
      } else if (status === 423) {
        setError({ status, problem: { title: tr(lang, "Акаунт заблоковано", "Account locked"),
          detail: tr(lang, "Забагато спроб. Спробуйте за хвилину.", "Too many failures. Try again in a minute.") } });
      } else {
        setError(err);
      }
    }
  };

  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        <a
          className="mk-auth-logo"
          href="#/welcome"
          onClick={(e) => { e.preventDefault(); navigate("/welcome"); }}
        >
          <Logo size={34} />
        </a>
        <h1 className="mk-auth-title">{tr(lang, "Вхід", "Sign in")}</h1>
        <p className="mk-auth-sub">{tr(lang, "Введіть облікові дані вашого тенанта.", "Use your tenant credentials.")}</p>

        <form className="mk-auth-form" onSubmit={onSubmit} noValidate>
          <label className="mk-auth-field">
            <span>{tr(lang, "Електронна пошта", "Email")}</span>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.example"
              required
              disabled={phase === "submitting"}
            />
          </label>

          <label className="mk-auth-field">
            <span>{tr(lang, "Пароль", "Password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={phase === "submitting"}
            />
          </label>

          {error && <ApiErrorView error={error} lang={lang} />}
          {mfaToast && (
            <div className="login-toast">
              <Icon name="shield" size={14} />
              <span>{tr(lang, "Потрібна MFA — зверніться до адміна.", "MFA required — contact admin.")}</span>
            </div>
          )}

          <button
            type="submit"
            className="mk-auth-btn primary"
            disabled={phase === "submitting" || !email || !password}
          >
            {phase === "submitting"
              ? (tr(lang, "Вхід…", "Signing in…"))
              : (tr(lang, "Увійти", "Sign in"))}
          </button>

          <div className="mk-auth-foot">
            <a
              className="mk-auth-link"
              href="#"
              onClick={(e) => { e.preventDefault(); setForgotOpen(true); }}
            >
              {tr(lang, "Забули пароль?", "Forgot password?")}
            </a>
          </div>
        </form>

        <div className="mk-auth-foot">
          <span>{tr(lang, "Немає акаунту?", "No account?")}</span>
          <a
            className="mk-auth-link"
            href="#/signup"
            onClick={(e) => { e.preventDefault(); navigate("/signup"); }}
          >
            {tr(lang, "Реєстрація", "Sign up")}
          </a>
        </div>
      </div>

      {forgotOpen && (
        <ForgotPasswordModal
          lang={lang}
          initialEmail={email}
          onClose={() => setForgotOpen(false)}
        />
      )}
    </div>
  );
}
