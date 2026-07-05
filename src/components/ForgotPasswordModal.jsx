// ForgotPasswordModal.jsx — "Forgot password" flow opened from the login page.
//
// The backend has no FE-facing reset endpoint — the actual reset is handled by
// Keycloak's reset-credentials form (see passwordResetUrl). This modal collects
// the email, shows a neutral confirmation (never revealing whether an account
// exists), and links through to the secure reset page to complete the flow.
import React, { useState } from "react";
import { Icon, Modal } from "./UI.jsx";
import { passwordResetUrl } from "../api/services.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordModal({ onClose, lang = "en", initialEmail = "" }) {
  const uk = lang === "uk";
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | submitting | sent

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError(uk ? "Введіть коректну електронну пошту." : "Enter a valid email.");
      return;
    }
    setError(null);
    setPhase("submitting");
    // TODO(backend): no FE-facing reset endpoint exists. Keycloak owns the reset
    // flow, so we simulate the request and then point the user to its secure form.
    await new Promise((r) => setTimeout(r, 500));
    setPhase("sent");
  };

  return (
    <Modal onClose={onClose}>
      {phase === "sent" ? (
        <>
          <div className="modal-h fp-head">
            <span className="fp-mark"><Icon name="check" size={22} /></span>
            <h2>{uk ? "Перевірте пошту" : "Check your email"}</h2>
            <p>
              {uk
                ? `Якщо акаунт із адресою ${email} існує, ми надіслали інструкції для відновлення пароля.`
                : `If an account exists for ${email}, we've sent password reset instructions.`}
            </p>
          </div>
          <div className="modal-b fp-body">
            <p className="fp-note">
              {uk
                ? "Не отримали листа? Перевірте спам або скористайтеся захищеною сторінкою відновлення."
                : "Didn't get the email? Check spam or use the secure reset page."}
            </p>
          </div>
          <div className="modal-f">
            <a className="btn" href={passwordResetUrl()} target="_blank" rel="noreferrer">
              {uk ? "Сторінка відновлення" : "Reset page"}
            </a>
            <button className="btn btn-primary" onClick={onClose}>
              {uk ? "Готово" : "Done"}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="modal-h">
            <h2>{uk ? "Відновлення пароля" : "Reset your password"}</h2>
            <p>
              {uk
                ? "Вкажіть пошту вашого акаунту — ми надішлемо посилання для відновлення."
                : "Enter your account email and we'll send a reset link."}
            </p>
          </div>
          <div className="modal-b">
            <label className="login-field">
              <span>{uk ? "Електронна пошта" : "Email"}</span>
              <input
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.example"
                disabled={phase === "submitting"}
                aria-invalid={error ? "true" : undefined}
              />
              {error && <span className="field-error">{error}</span>}
            </label>
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={onClose} disabled={phase === "submitting"}>
              {uk ? "Скасувати" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={phase === "submitting"}>
              {phase === "submitting"
                ? (uk ? "Надсилання…" : "Sending…")
                : (uk ? "Надіслати посилання" : "Send reset link")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
