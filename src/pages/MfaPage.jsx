// MfaPage.jsx — TOTP enrolment (#/mfa). Sprint 16, backend ADR-0039.
//
// Replaces the sprint-02 scaffold that rendered a disabled six-digit field and
// a note saying the endpoints did not exist yet. They exist now:
//
//   POST /auth/mfa/enrol   → { provisioning_uri, secret, issuer, account }
//   POST /auth/mfa/verify  → { enrolled, enrolled_at }
//   DELETE /auth/mfa/{sub} → admin reset (elsewhere: TenantMembersPage)
//
// THE SECRET NEVER LEAVES THIS COMPONENT. It arrives from `enrol`, lives in a
// state variable, is drawn into a <canvas> as a QR code, and is dropped when
// the component unmounts. It is not written to localStorage, sessionStorage,
// the URL, the console, or any store — see the note at the top of
// src/api/mfa.js, and e2e/mfa.spec.js which proves it by scraping for it.
//
// WHY THE PAGE IS NOT FEATURE-FLAGGED. `VITE_FEAT_MFA_ENROLMENT` gates where
// enrolment is ADVERTISED (the Profile → Security row). It must not gate the
// screen itself: a user sent here by the backend's 403 `mfa_enrolment_required`
// is a user who cannot do their job until they enrol, and bouncing them off a
// flagged-off page would strand them completely. A deployment that has not
// switched the endpoints on answers 403 to `enrol`, and this page says so in
// plain words — which is an honest empty state, not a dead end.

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../components/UI.jsx";
import { OtpInput, OTP_LENGTH } from "../components/OtpInput.jsx";
import { enrolMfa, verifyMfa, classifyEnrolError, classifyVerifyError } from "../api/mfa.js";
import { sanitizeMfaReturn } from "../auth/mfaGrace.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

// ── QR ─────────────────────────────────────────────────────────────────
//
// Drawn to a <canvas>, not an <img src="data:…">. Two reasons: the QR is
// generated in the browser from the provisioning URI so the secret never
// becomes a URL that could be logged or shared, and a canvas needs nothing
// from `img-src` at all.
//
// `qrcode` is already a dependency (the Дія signing flow uses it) and is
// imported lazily so its ~30 kB stays out of the initial bundle for the
// overwhelming majority of page loads that never come here.
function QrCanvas({ data, size = 200, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    if (!ref.current || !data) return undefined;
    import("qrcode")
      .then((QRCode) => {
        if (cancelled || !ref.current) return undefined;
        return QRCode.toCanvas(ref.current, data, {
          width: size,
          margin: 2,
          // The URI is long and phones scan it at arm's length off a monitor.
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
      })
      .catch(() => { if (!cancelled) onError?.(); });
    return () => { cancelled = true; };
  }, [data, size, onError]);

  return <canvas ref={ref} width={size} height={size} className="mfa-qr" aria-hidden="true" />;
}

// Base32 in groups of four — a human copying this by hand needs the grouping.
const groupSecret = (s) => String(s || "").replace(/(.{4})/g, "$1 ").trim();

export function MfaPage({ lang = "en", navigate, required = false, returnTo = "" }) {
  // Where "carry on" leads. Set by the fetch client when the grace 403
  // interrupted a specific screen (?return=…); sanitised because the value
  // rides in the URL. "/" means "no particular place" — the home screen.
  const backTo = sanitizeMfaReturn(returnTo);
  const { state: auth } = useAuth();
  const claims = auth?.claims || {};
  const dbUser = auth?.dbUser || {};
  const alreadyEnrolled = !!(claims.mfa_enrolled || dbUser.mfa_enrolled_at);

  // idle → enrolling → pending (secret in hand) → verifying → done
  const [phase, setPhase] = useState("idle");
  const [enrolment, setEnrolment] = useState(null); // { provisioning_uri, secret, issuer, account }
  const [failure, setFailure] = useState(null);     // classify* code
  const [otp, setOtp] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState(null);

  // The secret is dropped the moment this screen goes away — including a
  // navigation mid-enrolment. An abandoned enrolment is only PENDING backend
  // side, so nothing is broken by walking away; the next attempt mints a fresh
  // secret and the stale pending one is overwritten.
  useEffect(() => () => { setEnrolment(null); setOtp(""); }, []);

  const begin = useCallback(async () => {
    setPhase("enrolling");
    setFailure(null);
    setQrFailed(false);
    try {
      const body = await enrolMfa();
      setEnrolment(body);
      setPhase("pending");
    } catch (err) {
      setFailure(classifyEnrolError(err));
      setPhase("idle");
    }
  }, []);

  const verify = useCallback(async (code) => {
    setPhase("verifying");
    setFailure(null);
    try {
      const body = await verifyMfa(code);
      setEnrolledAt(body?.enrolled_at || null);
      // Drop the secret the instant it has served its purpose.
      setEnrolment(null);
      setOtp("");
      setPhase("done");
    } catch (err) {
      const code2 = classifyVerifyError(err);
      setFailure(code2);
      // A dead pending enrolment cannot be retried with another code — the
      // only way forward is a fresh secret, so drop back to the start.
      setPhase(code2 === "restart_enrolment" ? "idle" : "pending");
      setOtp("");
    }
  }, []);

  const copySecret = async () => {
    if (!enrolment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrolment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (permissions, insecure origin). The secret is on
      // screen; reveal it rather than pretending the copy worked.
      setShowSecret(true);
    }
  };

  // ── failure copy ─────────────────────────────────────────────────────
  const FAILURE_COPY = {
    not_enabled: {
      title: tr(lang, "Двофакторна автентифікація ще не увімкнена", "Two-factor authentication is not switched on yet"),
      detail: tr(lang,
        "Ця клініка ще не увімкнула MFA на сервері. Нічого робити не потрібно — коли адміністратор її увімкне, ви зможете зареєструвати застосунок тут.",
        "This deployment has not enabled MFA on the server yet. There is nothing to do — when an administrator switches it on, you will be able to enrol here."),
      tone: "info",
    },
    already_enrolled: {
      title: tr(lang, "Застосунок уже зареєстровано", "An authenticator is already enrolled"),
      detail: tr(lang,
        "Щоб зареєструвати інший пристрій, адміністратор клініки має спочатку скинути MFA — з міркувань безпеки повторна реєстрація без скидання неможлива.",
        "To enrol a different device, a clinic administrator must reset MFA first — re-enrolling without a reset is deliberately not possible."),
      tone: "warn",
    },
    unavailable: {
      title: tr(lang, "Сервіс тимчасово недоступний", "The service is temporarily unavailable"),
      detail: tr(lang,
        "Сховище ключів не відповідає, тому реєстрацію не завершено. Спробуйте за кілька хвилин.",
        "The key store is not responding, so enrolment could not start. Try again in a few minutes."),
      tone: "warn",
    },
    invalid_code: {
      title: tr(lang, "Невірний код", "That code was not right"),
      detail: tr(lang,
        "Перевірте, що час на телефоні синхронізовано, і введіть наступний код — вони змінюються кожні 30 секунд.",
        "Check that your phone's clock is synchronised, then enter the next code — they change every 30 seconds."),
      tone: "warn",
    },
    restart_enrolment: {
      title: tr(lang, "Реєстрацію потрібно почати спочатку", "Enrolment has to be restarted"),
      detail: tr(lang,
        "Незавершену реєстрацію більше не можна підтвердити. Натисніть «Почати реєстрацію» — ви отримаєте новий QR-код.",
        "The pending enrolment can no longer be confirmed. Press “Start enrolment” for a fresh QR code."),
      tone: "warn",
    },
    unauthenticated: {
      title: tr(lang, "Потрібно увійти знову", "You need to sign in again"),
      detail: tr(lang, "Сеанс завершився під час реєстрації.", "Your session ended during enrolment."),
      tone: "warn",
    },
    unknown: {
      title: tr(lang, "Не вдалося виконати дію", "That did not work"),
      detail: tr(lang, "Спробуйте ще раз. Якщо це повториться — зверніться до адміністратора.",
                       "Try again. If it keeps happening, contact your administrator."),
      tone: "warn",
    },
  };
  const problem = failure ? FAILURE_COPY[failure] || FAILURE_COPY.unknown : null;

  // The lost-phone answer, shown on every state of this screen. It is the one
  // question enrolment always raises and the one a support desk always gets.
  const recovery = (
    <div className="mfa-recovery">
      <Icon name="help" size={14} />
      <div>
        <strong>{tr(lang, "Втратили доступ до телефона?", "Lost access to your phone?")}</strong>
        <p>
          {tr(lang,
            "Резервних кодів немає — і це навмисно: аркуш паперу з кодами поруч із робочою станцією не є другим фактором. Замість цього адміністратор клініки скидає MFA (Учасники клініки → дії учасника → «Скинути MFA»). Скидання завершує всі ваші активні сеанси, після чого ви реєструєте новий пристрій тут.",
            "There are no recovery codes, deliberately: a printed sheet next to the workstation is not a second factor. Instead a clinic administrator resets MFA for you (Clinic members → the member's actions → “Reset MFA”). A reset ends all of your active sessions, and you then enrol a new device here.")}
        </p>
      </div>
    </div>
  );

  return (
    <div className="page mfa-page">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Двофакторна автентифікація", "Two-factor authentication")}</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            {tr(lang,
              "Одноразовий код із застосунку-автентифікатора на додачу до пароля.",
              "A one-time code from an authenticator app, on top of your password.")}
          </div>
        </div>
      </div>

      {/* Why you are here. Sent by the backend's 403 grace signal, not by a
          click — say so, or the screen reads as an interruption. */}
      {required && phase !== "done" && (
        <div className="mfa-note mfa-note-req" data-testid="mfa-required-note">
          <Icon name="shield" size={15} />
          <div>
            <strong>{tr(lang, "Для цієї дії потрібна двофакторна автентифікація", "That action requires two-factor authentication")}</strong>
            <p>{tr(lang,
              "Ваш обліковий запис ще не має другого фактора. Зареєструйте застосунок нижче — це займе хвилину, і ви зможете повернутися до роботи.",
              "Your account does not have a second factor yet. Enrol an authenticator below — it takes a minute, and then you can carry on.")}</p>
          </div>
        </div>
      )}

      {problem && (
        <div className={"mfa-note mfa-note-" + problem.tone} role="status" data-testid="mfa-problem">
          <Icon name={problem.tone === "info" ? "info" : "alert"} size={15} />
          <div>
            <strong>{problem.title}</strong>
            <p>{problem.detail}</p>
          </div>
        </div>
      )}

      {/* ── done ──────────────────────────────────────────────────── */}
      {phase === "done" ? (
        <div className="card mfa-card" data-testid="mfa-done">
          <div className="mfa-done-h">
            <Icon name="check" size={18} />
            <h2>{tr(lang, "Готово — застосунок зареєстровано", "Done — your authenticator is enrolled")}</h2>
          </div>
          <p className="muted">
            {tr(lang,
              "Наступного разу під час входу після пароля з'явиться поле для 6-значного коду.",
              "From your next sign-in, the password step is followed by a field for the 6-digit code.")}
          </p>
          {enrolledAt && (
            <p className="muted mono" style={{ fontSize: 12 }}>
              {tr(lang, "Зареєстровано", "Enrolled")}: {enrolledAt}
            </p>
          )}
          {navigate && (
            <div className="mfa-actions">
              <button type="button" className="btn accent" data-testid="mfa-carry-on"
                      onClick={() => navigate(backTo)}>
                {backTo !== "/"
                  ? tr(lang, "Повернутися до перерваної дії", "Return to what you were doing")
                  : tr(lang, "Продовжити роботу", "Carry on")}
              </button>
            </div>
          )}
          {recovery}
        </div>

      /* ── pending: QR + code ────────────────────────────────────── */
      ) : phase === "pending" || phase === "verifying" ? (
        <div className="card mfa-card" data-testid="mfa-enrol-step">
          <ol className="mfa-steps">
            <li>
              <strong>{tr(lang, "Відскануйте код", "Scan the code")}</strong>
              <p className="muted">
                {tr(lang,
                  "У застосунку-автентифікаторі (Google Authenticator, Microsoft Authenticator, 1Password, Aegis) додайте новий обліковий запис і наведіть камеру.",
                  "In your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Aegis) add an account and point the camera here.")}
              </p>
              <div className="mfa-qr-wrap">
                {qrFailed ? (
                  <div className="mfa-qr-fallback">
                    {tr(lang, "QR-код не вдалося намалювати — скористайтеся ручним введенням нижче.",
                               "The QR code could not be drawn — use manual entry below.")}
                  </div>
                ) : (
                  <QrCanvas data={enrolment?.provisioning_uri} onError={() => setQrFailed(true)} />
                )}
                <div className="mfa-qr-side">
                  <div className="mfa-kv">
                    <span>{tr(lang, "Обліковий запис", "Account")}</span>
                    <b>{enrolment?.account}</b>
                  </div>
                  <div className="mfa-kv">
                    <span>{tr(lang, "Видавець", "Issuer")}</span>
                    <b>{enrolment?.issuer}</b>
                  </div>
                </div>
              </div>
            </li>

            <li>
              <strong>{tr(lang, "Не можете сканувати?", "Cannot scan?")}</strong>
              <p className="muted">
                {tr(lang, "Введіть цей ключ у застосунку вручну.", "Type this key into the app by hand.")}
              </p>
              <div className="mfa-secret">
                <code data-testid="mfa-secret">
                  {showSecret
                    ? groupSecret(enrolment?.secret)
                    : "•••• •••• •••• •••• •••• •••• •••• ••••"}
                </code>
                <button type="button" className="btn ghost sm" onClick={() => setShowSecret((v) => !v)}>
                  <Icon name={showSecret ? "eyeOff" : "eye"} size={14} />
                  <span>{showSecret ? tr(lang, "Сховати", "Hide") : tr(lang, "Показати", "Show")}</span>
                </button>
                <button type="button" className="btn ghost sm" onClick={copySecret}>
                  <Icon name={copied ? "check" : "copy"} size={14} />
                  <span>{copied ? tr(lang, "Скопійовано", "Copied") : tr(lang, "Копіювати", "Copy")}</span>
                </button>
              </div>
              <p className="mfa-secret-warn">
                <Icon name="alert" size={13} />
                <span>
                  {tr(lang,
                    "Цей ключ — другий фактор. Він показується лише зараз, ніде не зберігається цим застосунком і не має потрапити в листування чи нотатки.",
                    "This key IS the second factor. It is shown only now, is stored nowhere by this app, and should not end up in an email or a note.")}
                </span>
              </p>
            </li>

            <li>
              <strong>{tr(lang, "Введіть код із застосунку", "Enter the code from the app")}</strong>
              <p className="muted">
                {tr(lang, "Реєстрація завершується, коли перший код підходить.",
                           "Enrolment completes when the first code checks out.")}
              </p>
              <OtpInput
                value={otp}
                onChange={(v) => { setOtp(v); if (failure === "invalid_code") setFailure(null); }}
                onComplete={(code) => { if (phase !== "verifying") verify(code); }}
                disabled={phase === "verifying"}
                invalid={failure === "invalid_code"}
                autoFocus
                label={tr(lang, "Код автентифікації", "Authentication code")}
              />
            </li>
          </ol>

          <div className="mfa-actions">
            <button
              type="button"
              className="btn accent"
              disabled={phase === "verifying" || otp.length !== OTP_LENGTH}
              onClick={() => verify(otp)}
            >
              {phase === "verifying"
                ? tr(lang, "Перевіряємо…", "Checking…")
                : tr(lang, "Завершити реєстрацію", "Finish enrolment")}
            </button>
            <button type="button" className="btn ghost" onClick={begin} disabled={phase === "verifying"}>
              {tr(lang, "Новий QR-код", "New QR code")}
            </button>
          </div>

          {recovery}
        </div>

      /* ── idle: start, or "you already have one" ────────────────── */
      ) : (
        <div className="card mfa-card" data-testid="mfa-start">
          {alreadyEnrolled ? (
            <>
              <div className="mfa-done-h">
                <Icon name="check" size={18} />
                <h2>{tr(lang, "Двофакторна автентифікація увімкнена", "Two-factor authentication is on")}</h2>
              </div>
              <p className="muted">
                {dbUser.mfa_enrolled_at
                  ? `${tr(lang, "Застосунок зареєстровано", "Authenticator enrolled")}: ${dbUser.mfa_enrolled_at}`
                  : tr(lang, "Для цього облікового запису вже зареєстровано застосунок.",
                             "This account already has an authenticator enrolled.")}
              </p>
            </>
          ) : (
            <>
              <h2>{tr(lang, "Зареєструйте застосунок-автентифікатор", "Enrol an authenticator app")}</h2>
              <p className="muted">
                {tr(lang,
                  "Пароль може витекти й ніхто цього не помітить. Код, який живе 30 секунд у вашому телефоні, — ні. Реєстрація займає близько хвилини.",
                  "A password can leak without anyone noticing. A code that lives for thirty seconds on your phone cannot. Enrolling takes about a minute.")}
              </p>
              <div className="mfa-actions">
                <button
                  type="button"
                  className="btn accent"
                  onClick={begin}
                  disabled={phase === "enrolling"}
                  data-testid="mfa-begin"
                >
                  {phase === "enrolling"
                    ? tr(lang, "Готуємо…", "Preparing…")
                    : tr(lang, "Почати реєстрацію", "Start enrolment")}
                </button>
              </div>
            </>
          )}
          {recovery}
        </div>
      )}
    </div>
  );
}
