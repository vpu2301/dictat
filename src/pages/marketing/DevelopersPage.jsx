// DevelopersPage.jsx — Developer hub (/developers).
//
// One entry point for everything technical on the public site: links to the
// in-site Swagger browser (/developers/api) and the written documentation
// (/docs), plus the API access & key request form. The platform is
// invite-only and keys are provisioned by the team, so — like /signup — the
// form is the sanctioned lead path: it composes a mail draft to
// ACCESS_REQUEST_EMAIL when configured (no backend endpoint exists).
import React, { useState } from "react";
import { Icon } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import { ACCESS_REQUEST_EMAIL } from "../../api/services.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AccessKeyForm({ lang }) {
  const uk = lang === "uk";
  const [form, setForm] = useState({ name: "", email: "", organization: "", useCase: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = uk ? "Вкажіть ім'я." : "Enter your name.";
    if (!EMAIL_RE.test(form.email)) next.email = uk ? "Невірна електронна пошта." : "Enter a valid email.";
    if (!form.organization.trim()) next.organization = uk ? "Вкажіть організацію." : "Enter your organization.";
    if (!form.useCase.trim()) next.useCase = uk ? "Опишіть інтеграцію." : "Describe your integration.";
    setErrors(next);
    if (Object.keys(next).length) return;

    if (ACCESS_REQUEST_EMAIL) {
      const subject = `API access & key request — ${form.organization.trim()}`;
      const body = [
        `Name: ${form.name.trim()}`,
        `Email: ${form.email.trim()}`,
        `Organization: ${form.organization.trim()}`,
        `\nIntegration / use case:\n${form.useCase.trim()}`,
      ].join("\n");
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mk-form mk-form-done" role="status">
        <span className="mk-form-mark"><Icon name="check" size={22} /></span>
        <h3>{uk ? "Запит отримано" : "Request received"}</h3>
        <p>
          {uk
            ? "Дякуємо! Ми переглянемо запит і надішлемо облікові дані та API-ключ на вказану пошту."
            : "Thanks! We'll review the request and send credentials and an API key to your email."}
        </p>
      </div>
    );
  }

  return (
    <form className="mk-form" onSubmit={onSubmit} noValidate id="access">
      <h3 className="mk-form-title">{uk ? "Запит доступу та API-ключа" : "Request access & an API key"}</h3>
      <p className="devs-form-sub">
        {uk
          ? "Платформа працює за запрошенням: ключі видає наша команда після короткої перевірки. Розкажіть, що ви інтегруєте."
          : "The platform is invite-only: keys are provisioned by our team after a short review. Tell us what you're integrating."}
      </p>
      <div className="mk-form-row">
        <label className="login-field">
          <span>{uk ? "Повне ім'я" : "Full name"}</span>
          <input value={form.name} onChange={set("name")} autoComplete="name"
            placeholder={uk ? "Др. Олена Коваль" : "Dr. Olena Koval"}
            aria-invalid={errors.name ? "true" : undefined} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className="login-field">
          <span>{uk ? "Робоча пошта" : "Work email"}</span>
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email"
            placeholder="you@clinic.example" aria-invalid={errors.email ? "true" : undefined} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
      </div>
      <label className="login-field">
        <span>{uk ? "Клініка / компанія" : "Clinic / company"}</span>
        <input value={form.organization} onChange={set("organization")} autoComplete="organization"
          placeholder={uk ? "Міська лікарня №1" : "City Hospital No. 1"}
          aria-invalid={errors.organization ? "true" : undefined} />
        {errors.organization && <span className="field-error">{errors.organization}</span>}
      </label>
      <label className="login-field">
        <span>{uk ? "Що ви будуєте" : "What are you building"}</span>
        <textarea rows={4} value={form.useCase} onChange={set("useCase")}
          placeholder={uk
            ? "Наприклад: інтеграція транскрипції в нашу МІС; потрібні ASR та Reports API."
            : "E.g. embedding transcription into our EHR; we need the ASR and Reports APIs."}
          aria-invalid={errors.useCase ? "true" : undefined} />
        {errors.useCase && <span className="field-error">{errors.useCase}</span>}
      </label>
      <button type="submit" className="btn btn-primary lp-cta-lg">
        {uk ? "Надіслати запит" : "Send request"}
      </button>
    </form>
  );
}

export function DevelopersPage({ navigate, lang = "en", tweaks, setTweak }) {
  const uk = lang === "uk";
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  const cards = [
    {
      icon: "layers",
      title: uk ? "API Docs (Swagger)" : "API Docs (Swagger)",
      desc: uk
        ? "Інтерактивний Swagger UI для всіх восьми сервісів платформи — переглядайте й випробовуйте ендпоїнти наживо."
        : "Interactive Swagger UI for all eight platform services — browse and try endpoints live.",
      path: "/developers/api",
    },
    {
      icon: "book",
      title: uk ? "Документація" : "Documentation",
      desc: uk
        ? "Посібники з автентифікації, транскрипції, звітів, моделі помилок і безпеки — з реальними прикладами запитів."
        : "Guides to authentication, transcription, reports, the error model and security — with real request samples.",
      path: "/docs",
    },
  ];

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <header className="mk-hero">
        <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {uk ? "Для розробників" : "For developers"}</span>
        <h1 className="mk-hero-title">{uk ? "Побудуйте на Klarnote" : "Build on Klarnote"}</h1>
        <p className="mk-hero-sub">
          {uk
            ? "REST і WebSocket API кожного сервісу, повна документація та ключі для інтеграції з вашою МІС."
            : "REST and WebSocket APIs for every service, full documentation, and keys to integrate with your EHR."}
        </p>
      </header>

      <section className="mk-section">
        <div className="lp-grid mk-grid-2">
          {cards.map((c, i) => (
            <a className="lp-feature mk-feature-link" href={`#${c.path}`} onClick={go(c.path)} key={i}>
              <div className="lp-feature-icon"><Icon name={c.icon} size={18} /></div>
              <h3 className="lp-feature-t">{c.title}</h3>
              <p className="lp-feature-d">{c.desc}</p>
              <span className="mk-card-more">{uk ? "Відкрити" : "Open"} <Icon name="arrowRight" size={14} /></span>
            </a>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <AccessKeyForm lang={lang} />
      </section>
    </MarketingShell>
  );
}
