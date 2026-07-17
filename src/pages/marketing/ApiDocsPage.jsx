// ApiDocsPage.jsx — In-site FastAPI documentation browser (/developers/api/:svc).
//
// Every backend service is FastAPI and serves its interactive Swagger UI at
// {base}/docs. This page embeds that UI in an iframe inside the marketing
// shell, with a service switcher, so the docs are browsable without leaving
// the website. The service slug lives in the route so links are shareable;
// footer "API Docs" links deep-link straight to a service.
import React from "react";
import { Icon } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import { SERVICES } from "../../api/services.js";

/* Slug → service registry entry + bilingual copy. Order matches the footer. */
export const API_DOC_SERVICES = [
  { key: "auth",         label: "Auth",         base: SERVICES.auth,         desc: { uk: "Сесії, користувачі, ролі", en: "Sessions, users, roles" } },
  { key: "asr",          label: "ASR",          base: SERVICES.asr,          desc: { uk: "Розпізнавання мовлення", en: "Speech recognition" } },
  { key: "dictation",    label: "Dictation",    base: SERVICES.dictation,    desc: { uk: "Сеанси диктування", en: "Dictation sessions" } },
  { key: "nlp",          label: "NLP",          base: SERVICES.nlp,          desc: { uk: "Структурування нотаток", en: "Note structuring" } },
  { key: "reports",      label: "Reports",      base: SERVICES.report,       desc: { uk: "Звіти та шаблони", en: "Reports & templates" } },
  { key: "autocomplete", label: "Autocomplete", base: SERVICES.autocomplete, desc: { uk: "Підказки термінів", en: "Term suggestions" } },
  { key: "signing",      label: "Signing",      base: SERVICES.signing,      desc: { uk: "Підписання через Дію", en: "Дія e-signature" } },
  { key: "core",         label: "Core",         base: SERVICES.core,         desc: { uk: "Пацієнти, прийоми, згоди", en: "Patients, encounters, consents" } },
];

export function ApiDocsPage({ svc, navigate, lang, tweaks, setTweak }) {
  const uk = lang === "uk";
  const active = API_DOC_SERVICES.find((s) => s.key === svc) || API_DOC_SERVICES[0];
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <header className="mk-hero">
        <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {uk ? "Для розробників" : "For developers"}</span>
        <h1 className="mk-hero-title">{uk ? "API документація" : "API Documentation"}</h1>
        <p className="mk-hero-sub">
          {uk
            ? "Інтерактивна документація FastAPI (Swagger UI) для кожного сервісу платформи. Оберіть сервіс, щоб переглянути й випробувати його ендпоїнти."
            : "Interactive FastAPI documentation (Swagger UI) for every platform service. Pick a service to browse and try its endpoints."}
        </p>
      </header>

      <section className="apidocs">
        <div className="apidocs-tabs" role="tablist" aria-label={uk ? "Сервіси" : "Services"}>
          {API_DOC_SERVICES.map((s) => (
            <a
              key={s.key}
              role="tab"
              aria-selected={s.key === active.key}
              className={`apidocs-tab${s.key === active.key ? " is-active" : ""}`}
              href={`#/developers/api/${s.key}`}
              onClick={go(`/developers/api/${s.key}`)}
            >
              <span className="apidocs-tab-label">{s.label}</span>
              <span className="apidocs-tab-desc">{s.desc[uk ? "uk" : "en"]}</span>
            </a>
          ))}
        </div>

        <div className="apidocs-bar">
          <span className="apidocs-bar-title">{active.label} API</span>
          <div className="apidocs-bar-links">
            <a href={`${active.base}/openapi.json`} target="_blank" rel="noreferrer">openapi.json</a>
            <a href={`${active.base}/docs`} target="_blank" rel="noreferrer">
              {uk ? "Відкрити в новій вкладці" : "Open in new tab"} <Icon name="arrowRight" size={13} />
            </a>
          </div>
        </div>

        <div className="apidocs-frame">
          {/* key forces a fresh iframe per service — no stale Swagger state */}
          <iframe
            key={active.key}
            src={`${active.base}/docs`}
            title={`${active.label} API — Swagger UI`}
          />
        </div>
        <p className="apidocs-note">
          {uk
            ? "Документація надається самим сервісом. Якщо сторінка порожня — сервіс недоступний із вашої мережі."
            : "Docs are served by the service itself. If this pane is blank, the service isn't reachable from your network."}
        </p>
      </section>
    </MarketingShell>
  );
}
