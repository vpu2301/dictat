// LoginPage.jsx — /login. Username + password (+ TOTP) → access token + /auth/me.
//
// Sprint 16 adds two things to this screen, both of which are about telling
// the truth at the one moment a clinician is least able to guess it:
//
//  · the SECOND STEP. `POST /auth/login` takes the TOTP code in the same call
//    (ADR-0039), so the form submits, is challenged, grows a code field, and
//    submits again. The password is kept in state across that — retyping it
//    because the second factor was requested is pure friction.
//  · the ENDING BANNER. Arriving here mid-shift is not the same event as
//    opening the app in the morning, and "your session was ended by an
//    administrator" is not an error the user should have to infer from a
//    401 problem body. src/auth/sessionEnd.js carries the reason across the
//    redirect and this screen puts it into words.
import React, { useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { OtpInput, OTP_LENGTH } from "../components/OtpInput.jsx";
import { login as apiLogin, me as apiMe } from "../api/endpoints.js";
import { isOtpChallenge, otpErrorCode } from "../api/mfa.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { SESSION_END, peekSessionEndReason, takeSessionEndReason } from "../auth/sessionEnd.js";
import { SocialAuthButtons } from "../components/SocialAuth.jsx";
import { clearSocialCallback, readSocialCallback, socialErrorFor } from "../auth/socialLogin.js";
import { tr } from "../i18n.js";

// How a session ended, in the words of the person it happened to. `signed_out`
// is absent on purpose: someone who just clicked "sign out" is not owed an
// explanation of why they are looking at a login form.
function endedCopy(reason, lang) {
  switch (reason) {
    case SESSION_END.REVOKED:
      return {
        icon: "shield",
        title: tr(lang, "Сеанс завершено", "Session ended"),
        detail: tr(lang,
          "Цей сеанс було завершено — вихід на іншому пристрої, дія адміністратора або скидання MFA. Увійдіть знову.",
          "This session was ended — a sign-out on another device, an administrator action, or an MFA reset. Please sign in again."),
      };
    case SESSION_END.REPLAY:
      return {
        icon: "alert",
        title: tr(lang, "Сеанс перервано з міркувань безпеки", "Session ended for security"),
        detail: tr(lang,
          "Виявлено повторне використання токена оновлення, тому всі сеанси було завершено. Якщо ви не виходили з системи, повідомте адміністратора.",
          "A refresh token was replayed, so every session was ended. If this was not you, tell your administrator."),
      };
    case SESSION_END.EXPIRED:
      return {
        icon: "clock",
        title: tr(lang, "Термін сеансу минув", "Session expired"),
        detail: tr(lang, "Ви були неактивні надто довго. Увійдіть знову.", "You were away too long. Please sign in again."),
      };
    default:
      return null;
  }
}

export function LoginPage({ navigate, lang = "en" }) {
  const { setState } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /* Set when the browser comes back from a provider having failed. The success
     path never reaches this component — App routes ?social=ok through the
     callback screen, which lands the user in the workspace. */
  const [socialError, setSocialError] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | submitting | success | error
  const [error, setError] = useState(null);
  // Second factor. `otpStep` flips once the backend has said it wants one;
  // until then the field does not exist, because most deployments have MFA off
  // and an always-present code box is a question with no answer.
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(null); // otp_invalid | otp_unavailable

  // Why the session ended, if it did.
  //
  // READ purely during render, CLEARED in an effect — and the split is not
  // stylistic. Consuming it in the `useState` initializer looks tidier and is
  // wrong: React.StrictMode invokes that initializer twice in development, so
  // the first call took the reason and the second, whose result React actually
  // keeps, found nothing. The banner silently never rendered. A state
  // initializer must be pure; the taking is a side effect and belongs in an
  // effect, where a double-invoke is harmless.
  const [ended] = useState(() => endedCopy(peekSessionEndReason(), lang));
  /* A failed federated attempt returns to whichever page started it. Read the
     marker once and strip it, so a reload does not replay a stale error. */
  useEffect(() => {
    const back = readSocialCallback();
    if (back && !back.ok) setSocialError(socialErrorFor(back.reason, lang));
    if (back) clearSocialCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Consume it: a reload, or a second visit to this screen, must not
    // re-announce an ending the user has already read and acted on.
    takeSessionEndReason();
  }, []);

  const submit = async (code) => {
    setPhase("submitting");
    setError(null);
    setOtpError(null);
    try {
      await apiLogin(email, password, code);
      const meBody = await apiMe();
      setState({ claims: meBody.claims, dbUser: meBody.db_user });
      setPhase("success");
      navigate("/");
    } catch (err) {
      setPhase("error");
      const status = err && err.status;
      const otpCode = otpErrorCode(err);

      if (otpCode === "otp_unavailable") {
        // The secret store is down and the backend fails closed. Asking for
        // another code would loop forever — say what is actually wrong.
        setOtpStep(true);
        setOtpError("otp_unavailable");
      } else if (isOtpChallenge(err)) {
        // Either "we want a code" or "that code was wrong". Both land on the
        // second step; only the second one is an error worth colouring red.
        setOtpStep(true);
        setOtp("");
        setOtpError(otpCode === "otp_invalid" ? "otp_invalid" : null);
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

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (otpStep && otp.length !== OTP_LENGTH) return;
    submit(otpStep ? otp : undefined);
  };

  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        <a
          className="mk-auth-logo"
          href="#/welcome"
          onClick={(e) => { e.preventDefault(); navigate("/welcome"); }}
        >
          <span className="lp-brand-name">Klarnote</span>
        </a>
        <h1 className="mk-auth-title">{tr(lang, "Вхід", "Sign in")}</h1>
        <p className="mk-auth-sub">{tr(lang, "Введіть облікові дані вашого тенанта.", "Use your tenant credentials.")}</p>

        {ended && (
          <div className="login-ended" role="status" data-testid="session-ended">
            <Icon name={ended.icon} size={15} />
            <div>
              <strong>{ended.title}</strong>
              <p>{ended.detail}</p>
            </div>
          </div>
        )}

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
            <div className="mk-auth-pw">
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
                className="mk-auth-pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={phase === "submitting"}
                aria-pressed={showPassword}
                aria-label={showPassword
                  ? tr(lang, "Сховати пароль", "Hide password")
                  : tr(lang, "Показати пароль", "Show password")}
                title={showPassword
                  ? tr(lang, "Сховати пароль", "Hide password")
                  : tr(lang, "Показати пароль", "Show password")}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
              </button>
            </div>
          </label>

          {otpStep && (
            <div className="mk-auth-field mk-auth-otp" data-testid="login-otp-step">
              <span>{tr(lang, "Код автентифікації", "Authentication code")}</span>
              <OtpInput
                value={otp}
                onChange={(v) => { setOtp(v); if (otpError === "otp_invalid") setOtpError(null); }}
                // Six digits in means there is nothing left to decide. Making
                // the clinician then reach for a button is friction for its
                // own sake — and this form is used dozens of times a day.
                onComplete={(code) => { if (phase !== "submitting") submit(code); }}
                disabled={phase === "submitting" || otpError === "otp_unavailable"}
                invalid={otpError === "otp_invalid"}
                autoFocus
                label={tr(lang, "Код автентифікації", "Authentication code")}
              />
              <p className="mk-auth-hint">
                {otpError === "otp_invalid"
                  ? tr(lang, "Невірний код. Перевірте, що годинник на телефоні точний, і спробуйте наступний код.",
                             "That code was not right. Check your phone's clock is accurate and try the next code.")
                  : otpError === "otp_unavailable"
                    ? tr(lang, "Перевірка коду зараз недоступна. Зверніться до адміністратора клініки — він може скинути MFA.",
                               "Code verification is unavailable right now. Ask your clinic administrator — they can reset MFA.")
                    : tr(lang, "Введіть 6-значний код із застосунку-автентифікатора.",
                               "Enter the 6-digit code from your authenticator app.")}
              </p>
            </div>
          )}

          {error && <ApiErrorView error={error} lang={lang} />}

          <button
            type="submit"
            className="mk-auth-btn primary"
            disabled={
              phase === "submitting" ||
              !email || !password ||
              (otpStep && (otp.length !== OTP_LENGTH || otpError === "otp_unavailable"))
            }
          >
            {phase === "submitting"
              ? (tr(lang, "Вхід…", "Signing in…"))
              : otpStep
                ? (tr(lang, "Підтвердити", "Verify"))
                : (tr(lang, "Увійти", "Sign in"))}
          </button>

          <div className="mk-auth-foot">
            <a
              className="mk-auth-link"
              data-testid="forgot-password-link"
              href="#/forgot-password"
              onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}
            >
              {tr(lang, "Забули пароль?", "Forgot password?")}
            </a>
          </div>
        </form>

        {/* Federated sign-in. Outside the <form> on purpose: these navigate the
            whole page away and must never be swept up by an Enter keypress in
            the password field. Hidden during the MFA step — the second factor
            belongs to the credential already being verified, and offering a
            different identity halfway through is a way to lose the flow. */}
        {!otpStep && (
          <>
            {socialError && (
              <div className="mk-auth-social-error" role="alert" data-testid="social-error">
                <Icon name="alert" size={15} />
                <span>
                  {socialError.message}
                  {socialError.action === "request" && (
                    <>
                      {" "}
                      <a className="mk-auth-link" href="#/signup"
                        onClick={(e) => { e.preventDefault(); navigate("/signup"); }}>
                        {tr(lang, "Запросити доступ", "Request access")}
                      </a>
                    </>
                  )}
                </span>
              </div>
            )}
            <SocialAuthButtons lang={lang} />
          </>
        )}

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

    </div>
  );
}
