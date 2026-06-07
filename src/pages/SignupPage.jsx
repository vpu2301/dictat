// SignupPage.jsx — /signup. UI-only mock (no backend yet).
//
// This platform is admin-invite-only (a tenant admin invites users via
// POST /admin/users/invite). This page is a front-end prototype of a
// "request access" form: it validates locally and shows a success state.
// TODO(backend): wire to a real registration / access-request endpoint when
// one exists. Until then nothing is sent over the network.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage({ navigate, lang = "en" }) {
  const uk = lang === "uk";
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    organization: "",
    password: "",
    confirm: "",
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
    if (form.password.length < 8)
      next.password = uk ? "Мінімум 8 символів." : "At least 8 characters.";
    if (form.confirm !== form.password)
      next.confirm = uk ? "Паролі не збігаються." : "Passwords do not match.";
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setPhase("submitting");
    // TODO(backend): replace this simulated delay with the real request.
    await new Promise((r) => setTimeout(r, 600));
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
                ? "Дякуємо! Адміністратор вашого тенанта розгляне запит і надішле запрошення на вашу пошту."
                : "Thanks! Your tenant admin will review the request and send an invite to your email."}
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
            ? "Заповніть форму — адмін тенанта надішле запрошення."
            : "Fill in the form — a tenant admin will send you an invite."}
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
        {field({
          name: "password",
          label: uk ? "Пароль" : "Password",
          type: "password",
          autoComplete: "new-password",
        })}
        {field({
          name: "confirm",
          label: uk ? "Підтвердіть пароль" : "Confirm password",
          type: "password",
          autoComplete: "new-password",
        })}

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
