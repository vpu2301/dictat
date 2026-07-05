// SignupPage.jsx — /signup. "Request access" lead form (doc 03 §4.1, option A).
//
// This platform is admin-invite-only: a tenant admin provisions users via
// POST /admin/users/invite, which is what sets their credentials. There is NO
// self-serve account creation, so this page does NOT collect a password — it
// captures a lead and (when VITE_ACCESS_REQUEST_EMAIL is set) composes a mail
// draft to the team. Real onboarding happens through the invite flow.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";
import { ACCESS_REQUEST_EMAIL } from "../api/services.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage({ navigate, lang = "en" }) {
  const uk = lang === "uk";
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    organization: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState("idle"); // idle | submitting | success
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.displayName.trim())
      next.displayName = uk ? "Вкажіть ім'я." : "Enter your name.";
    if (!EMAIL_RE.test(form.email))
      next.email = uk ? "Невірна електронна пошта." : "Enter a valid email.";
    if (!form.organization.trim())
      next.organization = uk ? "Вкажіть клініку." : "Enter your clinic.";
    return next;
  };

  // Lightweight lead submission: compose a mail draft to the configured
  // address. No backend endpoint exists (and none is in scope), so this is the
  // sanctioned "lead" path — see doc 03 §4.1. If no address is configured we
  // simply confirm receipt without composing anything.
  const sendLead = () => {
    if (!ACCESS_REQUEST_EMAIL) return;
    const subject = `Access request — ${form.organization.trim()}`;
    const body = [
      `Name: ${form.displayName.trim()}`,
      `Email: ${form.email.trim()}`,
      `Clinic / organization: ${form.organization.trim()}`,
      form.message.trim() ? `\nMessage:\n${form.message.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    // Opening a mail draft must not navigate the SPA away; mailto: is handled
    // by the OS mail client and leaves the page intact.
    window.location.href = href;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setPhase("submitting");
    sendLead();
    setPhase("success");
  };

  if (phase === "success") {
    return (
      <div className="login-shell">
        <div className="login-card" role="status">
          <div className="login-brand">
            <Logo size={32} />
            <div>
              <div className="login-brand-name">Dictator</div>
              <div className="login-brand-tag">
                {uk ? "Медичне диктування" : "Medical dictation"}
              </div>
            </div>
          </div>
          <div className="signup-success">
            <span className="signup-success-mark">
              <Icon name="check" size={22} />
            </span>
            <h1 className="login-title">
              {uk ? "Запит надіслано" : "Request received"}
            </h1>
            <p className="login-sub">
              {uk
                ? "Дякуємо! Наша команда зв'яжеться з вами. Доступ надає адміністратор вашої клініки через запрошення на пошту."
                : "Thanks! Our team will reach out shortly. Accounts are provisioned by your clinic's administrator via an email invite."}
            </p>
          </div>
          <button
            className="btn btn-primary login-submit"
            onClick={() => navigate("/login")}
          >
            {uk ? "До входу" : "Back to sign in"}
          </button>
        </div>
      </div>
    );
  }

  // Called directly (not as <Field/>) so it does NOT create a component
  // boundary — otherwise each keystroke would remount the input and drop focus.
  const field = ({ name, label, type = "text", autoComplete, placeholder }) => (
    <label className="login-field" key={name}>
      <span>{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        disabled={phase === "submitting"}
        aria-invalid={errors[name] ? "true" : undefined}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <Logo size={32} />
          <div>
            <div className="login-brand-name">Dictator</div>
            <div className="login-brand-tag">
              {uk ? "Медичне диктування" : "Medical dictation"}
            </div>
          </div>
        </div>

        <h1 className="login-title">{uk ? "Запит доступу" : "Request access"}</h1>
        <p className="login-sub">
          {uk
            ? "Розкажіть про себе — наша команда зв'яжеться та надішле запрошення. Самостійна реєстрація недоступна; акаунти створює адміністратор клініки."
            : "Tell us about yourself and our team will reach out with an invite. There is no self-serve sign-up — accounts are created by your clinic's administrator."}
        </p>

        {field({
          name: "displayName",
          label: uk ? "Повне ім'я" : "Full name",
          autoComplete: "name",
          placeholder: uk ? "Др. Олена Коваль" : "Dr. Olena Koval",
        })}
        {field({
          name: "email",
          label: uk ? "Електронна пошта" : "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@clinic.example",
        })}
        {field({
          name: "organization",
          label: uk ? "Клініка / організація" : "Clinic / organization",
          autoComplete: "organization",
          placeholder: uk ? "Міська лікарня №1" : "City Hospital No. 1",
        })}
        <label className="login-field">
          <span>{uk ? "Повідомлення (необов'язково)" : "Message (optional)"}</span>
          <textarea
            value={form.message}
            onChange={set("message")}
            rows={3}
            disabled={phase === "submitting"}
            placeholder={
              uk
                ? "Коротко про вашу клініку та потреби."
                : "A little about your clinic and what you need."
            }
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary login-submit"
          disabled={phase === "submitting"}
        >
          {phase === "submitting"
            ? uk
              ? "Надсилання…"
              : "Sending…"
            : uk
            ? "Надіслати запит"
            : "Request access"}
        </button>

        <div className="login-foot">
          <span>{uk ? "Вже маєте акаунт?" : "Already have an account?"}</span>
          <a
            className="login-link"
            onClick={(e) => {
              e.preventDefault();
              navigate("/login");
            }}
            href="#/login"
          >
            {uk ? "Увійти" : "Sign in"}
          </a>
        </div>
      </form>
    </div>
  );
}
