// SignupFlow.jsx — /signup. Heidi-style entry flow.
//
// A single self-contained wizard (no routing churn) with an internal step
// machine. "Sign up" in the marketing nav lands here on a chooser with two
// options — Create account or Book a demo — modelled on heidihealth.com:
//   choose ─┬─▶ acct1 ─▶ acct2 ─▶ done (create account)
//           └─▶ demo  ─────────▶ done (book a demo)
// Styled in the marketing Heidi palette (wrapped in `.lp`, `.mk-auth-*`), so
// the logged-in platform is untouched. This platform is admin-invite-only, so
// nothing is persisted — the flow captures intent and confirms receipt.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Provider marks — small inline SVGs (no icon-map entries needed). */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 27.9c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.7l7.3-5.8z" />
      <path fill="#EA4335" d="M24 10.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.5 30 2 24 2 15.4 2 7.9 6.9 4.3 14.3l7.3 5.7C13.3 14.8 18.2 10.9 24 10.9z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-92.6zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/* Designed dropdown — a styled trigger + a custom options panel (the native
   <select> can't have its open list styled). Matches the form's look, with
   hover + selected states, outside-click / Escape to close. */
function AuthSelect({ value, onChange, options, label }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className={`mk-auth-select${open ? " is-open" : ""}`} ref={ref}>
      <button type="button" className="mk-auth-select-btn" aria-haspopup="listbox"
        aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span>{value}</span>
        <Icon name="chevDown" size={16} />
      </button>
      {open && (
        <div className="mk-auth-select-panel" role="listbox">
          {options.map((o) => (
            <button type="button" key={o} role="option" aria-selected={o === value}
              className={`mk-auth-select-opt${o === value ? " is-sel" : ""}`}
              onClick={() => { onChange(o); setOpen(false); }}>
              <span>{o}</span>
              {o === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignupFlow({ navigate, lang = "en" }) {
  const uk = lang === "uk";
  const t = (u, e) => (uk ? u : e);
  const [step, setStep] = useState("choose");

  const SPECIALTIES = uk
    ? ["Загальна практика", "Радіологія", "Психічне здоров'я", "Хірургія", "Педіатрія", "Кардіологія", "Неврологія", "Інша"]
    : ["General practice", "Radiology", "Mental health", "Surgery", "Pediatrics", "Cardiology", "Neurology", "Other"];
  const ROLES = uk
    ? ["Окремий лікар", "Керівник практики", "Адміністратор", "Медсестра / медбрат", "Інше"]
    : ["Individual practitioner", "Practice lead", "Administrator", "Nurse", "Other"];
  const COUNTRIES = [
    { flag: "🇺🇦", name: t("Україна", "Ukraine") },
    { flag: "🇵🇱", name: t("Польща", "Poland") },
    { flag: "🇩🇪", name: t("Німеччина", "Germany") },
    { flag: "🇬🇧", name: t("Велика Британія", "United Kingdom") },
    { flag: "🇺🇸", name: t("США", "United States") },
  ].map((c) => `${c.flag}  ${c.name}`);
  const SIZES = [t("Тільки я", "Just me"), "2–5", "6–20", "21–50", "51+"];

  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "",
    specialty: SPECIALTIES[0], role: ROLES[0], country: COUNTRIES[0],
    phone: "", consent: false, org: "", size: SIZES[0],
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setV = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));   // for AuthSelect

  const emailOk = EMAIL_RE.test(form.email);
  const acct1Ok = form.firstName.trim() && form.lastName.trim() && form.consent;
  const acct2Ok = form.org.trim();

  const back = () => navigate("/welcome");

  /* ── Shared chrome ────────────────────────────────────────── */
  const Shell = ({ children, onBack, topBack }) => (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        {topBack && (
          <button className="mk-auth-back is-top" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {t("Назад", "Back")}
          </button>
        )}
        <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); back(); }}>
          <Logo size={34} />
        </a>
        {children}
        {!topBack && (
          <button className="mk-auth-back" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {t("Назад", "Back")}
          </button>
        )}
      </div>
    </div>
  );

  /* ── Confirmation ─────────────────────────────────────────── */
  if (step === "done-acct" || step === "done-demo") {
    const demo = step === "done-demo";
    return (
      <Shell onBack={back}>
        <div className="mk-auth-done">
          <span className="mk-auth-done-mark"><Icon name="check" size={24} /></span>
          <h1 className="mk-auth-title">{t("Готово!", "You're all set!")}</h1>
          <p className="mk-auth-sub">
            {demo
              ? t("Дякуємо! Наша команда зв'яжеться, щоб узгодити демо.", "Thanks! Our team will reach out to schedule your demo.")
              : t("Дякуємо за реєстрацію. Ми надішлемо запрошення на вашу пошту.", "Thanks for signing up. We'll send an invite to your email.")}
          </p>
        </div>
        <button className="mk-auth-btn primary" onClick={() => navigate("/login")}>
          {t("До входу", "Go to sign in")}
        </button>
      </Shell>
    );
  }

  /* ── Chooser ──────────────────────────────────────────────── */
  if (step === "choose") {
    return (
      <Shell onBack={back}>
        <h1 className="mk-auth-title">{t("Реєстрація", "Sign up")}</h1>
        <p className="mk-auth-sub">{t("Оберіть, з чого почати.", "Choose how you'd like to start.")}</p>
        <div className="mk-auth-choose">
          <button className="mk-auth-opt" onClick={() => setStep("acct1")}>
            <span className="mk-auth-opt-ic"><Icon name="user" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{t("Створити акаунт", "Create account")}</span>
              <span className="mk-auth-opt-d">{t("Налаштуйте акаунт Klarnote для вашої практики.", "Set up your Klarnote account.")}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
          <button className="mk-auth-opt" onClick={() => setStep("demo")}>
            <span className="mk-auth-opt-ic"><Icon name="calendar" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{t("Замовити демо", "Book a demo")}</span>
              <span className="mk-auth-opt-d">{t("Подивіться Klarnote разом із нашою командою.", "See Klarnote with our team.")}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Book a demo ──────────────────────────────────────────── */
  if (step === "demo") {
    return (
      <Shell onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{t("Замовити демо", "Book a demo")}</h1>
        <p className="mk-auth-sub">{t("Демо з нашою командою.", "Book a demo with our team.")}</p>
        <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); setStep("done-demo"); }}>
          <label className="mk-auth-field">
            <span>{t("Робоча електронна пошта", "Work email")}</span>
            <span className="mk-auth-input-wrap">
              <Icon name="inbox" size={16} />
              <input type="email" value={form.email} onChange={set("email")}
                placeholder="name@organisation.com" autoComplete="email" />
            </span>
          </label>
          <div className="mk-auth-or"><span>{t("або", "or")}</span></div>
          <button type="button" className="mk-auth-btn soft" onClick={() => setStep("acct1")}>
            <GoogleMark /> {t("Продовжити з Google", "Continue with Google")}
          </button>
          <button type="button" className="mk-auth-btn soft" onClick={() => setStep("acct1")}>
            <AppleMark /> {t("Продовжити з Apple", "Continue with Apple")}
          </button>
          <button type="submit" className="mk-auth-btn primary" disabled={!emailOk}>
            {t("Далі", "Continue")}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 1 (about you) ──────────────────── */
  if (step === "acct1") {
    return (
      <Shell onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{t("Розкажіть трохи про себе.", "Tell us a bit about yourself.")}</h1>
        <p className="mk-auth-sub">{t("Налаштуймо ваш акаунт.", "Let's set up your account.")}</p>
        <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); if (acct1Ok) setStep("acct2"); }}>
          <div className="mk-auth-row">
            <label className="mk-auth-field">
              <span>{t("Ім'я", "First name")} <em>*</em></span>
              <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
            </label>
            <label className="mk-auth-field">
              <span>{t("Прізвище", "Last name")} <em>*</em></span>
              <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
            </label>
          </div>
          <div className="mk-auth-field">
            <span>{t("Спеціальність", "Specialty")} <em>*</em></span>
            <AuthSelect value={form.specialty} onChange={setV("specialty")} options={SPECIALTIES}
              label={t("Спеціальність", "Specialty")} />
          </div>
          <div className="mk-auth-field">
            <span>{t("Ваша роль в організації", "Your role within the organisation")}</span>
            <AuthSelect value={form.role} onChange={setV("role")} options={ROLES}
              label={t("Ваша роль", "Your role")} />
          </div>
          <div className="mk-auth-field">
            <span>{t("Країна", "Country")} <em>*</em></span>
            <AuthSelect value={form.country} onChange={setV("country")} options={COUNTRIES}
              label={t("Країна", "Country")} />
          </div>
          <label className="mk-auth-field">
            <span>{t("Телефон (необов'язково)", "Phone number (optional)")}</span>
            <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel"
              placeholder={uk ? "+380 …" : "+380 …"} />
          </label>
          <label className="mk-auth-consent">
            <input type="checkbox" checked={form.consent} onChange={set("consent")} />
            <span>
              {t("Я прочитав(ла) ", "I have read the ")}
              <a href="#/legal/terms" onClick={(e) => e.stopPropagation()}>{t("Умови", "Terms")}</a>
              {t(" та ", " and ")}
              <a href="#/legal/privacy" onClick={(e) => e.stopPropagation()}>{t("Політику конфіденційності", "Privacy Policy")}</a>
              {t(" і погоджуюсь із ними.", " and agree to them.")}
            </span>
          </label>
          <button type="submit" className="mk-auth-btn primary" disabled={!acct1Ok}>
            {t("Далі", "Continue")}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 2 (organisation) ───────────────── */
  return (
    <Shell topBack onBack={() => setStep("acct1")}>
      <h1 className="mk-auth-title">{t("Розкажіть трохи про себе.", "Tell us a bit about yourself.")}</h1>
      <p className="mk-auth-sub">{t("Налаштуймо ваш акаунт.", "Let's set up your account.")}</p>
      <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); if (acct2Ok) setStep("done-acct"); }}>
        <label className="mk-auth-field">
          <span>{t("Назва організації", "Organisation name")} <em>*</em></span>
          <input value={form.org} onChange={set("org")} autoComplete="organization"
            placeholder={t("Міська лікарня №1", "City Hospital No. 1")} />
        </label>
        <div className="mk-auth-field">
          <span>{t("Кількість лікарів у закладі", "Number of clinicians in your practice")}</span>
          <div className="mk-auth-pills">
            {SIZES.map((s) => (
              <button type="button" key={s}
                className={`mk-auth-pill${form.size === s ? " is-on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, size: s }))}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="mk-auth-btn primary" disabled={!acct2Ok}>
          {t("Далі", "Continue")}
        </button>
      </form>
    </Shell>
  );
}
