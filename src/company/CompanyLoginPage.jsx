// CompanyLoginPage.jsx — the Klarnote *staff* sign-in. Route #/company/login.
//
// Why a separate door at all: /login is the clinic's front desk. It says "use
// your tenant credentials", offers sign-up and password reset, and on success
// drops you into a clinician's workspace. Sending Klarnote's own staff through
// it is wrong in both directions — it tells our people they are customers, and
// it means a wrong-account login silently lands inside a tenant's clinical app.
//
// What this door does differently:
//   · it is branded as Klarnote staff access, with no tenant/marketing chrome,
//     no sign-up, and no "your clinic" language;
//   · it lands on /company, never on the clinical workspace;
//   · a non-staff account that signs in here is REFUSED and signed straight
//     back out, rather than being handed a working clinic session by the back
//     door. That is the part that actually matters.
//
// What it is NOT: a separate credential store. There is one Keycloak realm and
// one POST /auth/login in the backend — see docs/company-console.md for what a
// genuinely separate staff IdP would require. This is a separate entrance to
// the same building, and the refusal above is what makes that entrance mean
// something.

import React, { useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { login as apiLogin, me as apiMe, logout as apiLogout } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { isPlatformOwner, ownerEmailOf } from "./ownerAccess.js";
import { tr } from "../i18n.js";

export function CompanyLoginPage({ navigate, lang = "en" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const { state, setState, clear } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | submitting | error | refused
  const [error, setError] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [refusedEmail, setRefusedEmail] = useState("");

  // Already signed in as staff → this page has nothing to ask. Skip it.
  // Deliberately not a redirect for non-staff sessions: a clinician who lands
  // here should be told why they cannot come in, not bounced somewhere else.
  const alreadyStaff = isPlatformOwner(state);
  useEffect(() => {
    if (alreadyStaff) navigate("/company");
  }, [alreadyStaff, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setPhase("submitting");
    setError(null);
    setMfaRequired(false);

    try {
      await apiLogin(email, password);
      const meBody = await apiMe();
      const session = { claims: meBody.claims, dbUser: meBody.db_user };

      if (!isPlatformOwner(session)) {
        // Credentials were valid — this just is not a staff account. Drop the
        // session rather than leaving a live clinic token behind a staff login.
        setRefusedEmail(ownerEmailOf(session) || email);
        try { await apiLogout(); } catch { /* best effort — token is dropped either way */ }
        clear();
        setPhase("refused");
        setPassword("");
        return;
      }

      setState(session);
      navigate("/company");
    } catch (err) {
      setPhase("error");
      const status = err && err.status;
      const wwwAuth = (err && err.problem && err.problem.www_authenticate) || "";
      if (status === 401 && wwwAuth.toLowerCase().includes("mfa")) {
        setMfaRequired(true);
      } else if (status === 401) {
        setError({ status, problem: {
          title: T("Невірні дані", "Invalid email or password"),
          detail: T("Перевірте пошту та пароль.", "Check the email and password."),
        } });
      } else if (status === 423) {
        setError({ status, problem: {
          title: T("Акаунт заблоковано", "Account locked"),
          detail: T("Забагато невдалих спроб. Спробуйте за хвилину.", "Too many failed attempts. Try again in a minute."),
        } });
      } else {
        setError(err);
      }
    }
  };

  if (alreadyStaff) return null;

  return (
    <div className="colog">
      <div className="colog-card">
        <div className="colog-mark">
          <span className="colog-mark-badge"><Icon name="shield" size={16} /></span>
          <div>
            <strong>Klarnote</strong>
            <span>{T("Доступ для персоналу", "Staff access")}</span>
          </div>
        </div>

        <h1>{T("Консоль платформи", "Platform console")}</h1>
        <p className="colog-sub">
          {T("Внутрішній вхід для команди Klarnote. Це не вхід для клінік.",
             "Internal sign-in for the Klarnote team. This is not the clinic sign-in.")}
        </p>

        {phase === "refused" ? (
          <div className="colog-refused" role="alert">
            <span className="colog-refused-icon"><Icon name="alert" size={18} /></span>
            <h2>{T("Це не акаунт персоналу", "Not a staff account")}</h2>
            <p>
              {T("Дані входу вірні, але", "The credentials were valid, but")} <strong>{refusedEmail}</strong>{" "}
              {T("не має доступу до консолі платформи. Сесію завершено.",
                 "has no access to the platform console. The session has been ended.")}
            </p>
            <div className="colog-refused-actions">
              <button className="colog-btn" onClick={() => { setPhase("idle"); setRefusedEmail(""); }}>
                {T("Спробувати інший акаунт", "Try another account")}
              </button>
              <button className="colog-btn ghost" onClick={() => navigate("/login")}>
                {T("Вхід для клінік", "Clinic sign-in")}
              </button>
            </div>
          </div>
        ) : (
          <form className="colog-form" onSubmit={onSubmit} noValidate>
            <label className="colog-field">
              <span>{T("Робоча пошта", "Work email")}</span>
              <input
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@klarnote.com"
                required
                disabled={phase === "submitting"}
              />
            </label>

            <label className="colog-field">
              <span>{T("Пароль", "Password")}</span>
              <div className="colog-pw">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={phase === "submitting"}
                />
                <button
                  type="button"
                  className="colog-pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={phase === "submitting"}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? T("Сховати пароль", "Hide password") : T("Показати пароль", "Show password")}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
            </label>

            {error && <ApiErrorView error={error} lang={lang} />}
            {mfaRequired && (
              <div className="colog-note" role="alert">
                <Icon name="shield" size={14} />
                <span>{T("Потрібна багатофакторна автентифікація.", "Multi-factor authentication is required.")}</span>
              </div>
            )}

            <button
              type="submit"
              className="colog-btn primary"
              disabled={phase === "submitting" || !email || !password}
            >
              {phase === "submitting" ? T("Вхід…", "Signing in…") : T("Увійти", "Sign in")}
            </button>
          </form>
        )}

        <div className="colog-foot">
          <Icon name="info" size={12} />
          <span>
            {T("Шукаєте вхід для вашої клініки?", "Looking for your clinic sign-in?")}{" "}
            <a href="#/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>
              {T("Перейти сюди", "Go here")}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
