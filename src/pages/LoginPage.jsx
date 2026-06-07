// LoginPage.jsx — /login. Username + password → access token + /auth/me.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal.jsx";
import { login as apiLogin, me as apiMe } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";

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
        setError({ status, problem: { title: lang === "uk" ? "Невірний логін" : "Invalid email or password",
          detail: lang === "uk" ? "Перевірте логін та пароль." : "Check your username and password." } });
      } else if (status === 423) {
        setError({ status, problem: { title: lang === "uk" ? "Акаунт заблоковано" : "Account locked",
          detail: lang === "uk" ? "Забагато спроб. Спробуйте за хвилину." : "Too many failures. Try again in a minute." } });
      } else {
        setError(err);
      }
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <Logo size={32} />
          <div>
            <div className="login-brand-name">Dictator</div>
            <div className="login-brand-tag">{lang === "uk" ? "Медичне диктування" : "Medical dictation"}</div>
          </div>
        </div>

        <h1 className="login-title">{lang === "uk" ? "Увійти" : "Sign in"}</h1>
        <p className="login-sub">{lang === "uk" ? "Введіть облікові дані вашого тенанта." : "Use your tenant credentials."}</p>

        <label className="login-field">
          <span>{lang === "uk" ? "Електронна пошта" : "Email"}</span>
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

        <label className="login-field">
          <span>{lang === "uk" ? "Пароль" : "Password"}</span>
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
            <span>{lang === "uk" ? "Потрібна MFA — зверніться до адміна." : "MFA required — contact admin."}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary login-submit" disabled={phase === "submitting"}>
          {phase === "submitting"
            ? (lang === "uk" ? "Вхід…" : "Signing in…")
            : (lang === "uk" ? "Увійти" : "Sign in")}
        </button>

        <div className="login-foot">
          <span>{lang === "uk" ? "Немає акаунту?" : "No account?"}</span>
          <a
            className="login-link"
            href="#/signup"
            onClick={(e) => { e.preventDefault(); navigate("/signup"); }}
          >
            {lang === "uk" ? "Запросити доступ" : "Request access"}
          </a>
        </div>
        <div className="login-foot">
          <a
            className="muted login-link"
            href="#"
            onClick={(e) => { e.preventDefault(); setForgotOpen(true); }}
          >
            {lang === "uk" ? "Забули пароль?" : "Forgot password?"}
          </a>
        </div>
      </form>

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
