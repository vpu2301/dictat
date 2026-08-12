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
import { AuthSelect } from "../SignupFlow.jsx";
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
        {/* ONE control, not eight. This was a 4x2 grid of bordered cards — a
            wall of buttons for what is a single choice, and the loudest thing
            on a page whose subject is the panel underneath. The site's own
            dropdown (the one the contact and signup forms use) says the same
            thing in one line and looks like the rest of the site. */}
        <div className="apidocs-pick">
          <label className="apidocs-pick-l" htmlFor="apidocs-svc">
            {uk ? "Сервіс" : "Service"}
          </label>
          <AuthSelect
            value={active.key}
            onChange={(key) => navigate(`/developers/api/${key}`)}
            opts={API_DOC_SERVICES.map((sv) => ({
              value: sv.key,
              label: `${sv.label} — ${sv.desc[lang] ?? sv.desc.en}`,
            }))}
            label={uk ? "Сервіс" : "Service"}
            placeholder={uk ? "Оберіть сервіс" : "Choose a service"}
          />
          {/* The one link worth keeping. `openapi.json` went with the button
              wall: Swagger prints that link itself, at the top of the panel
              below, so a second copy up here was the same link twice. */}
          <a className="apidocs-open" href={`${active.base}/docs`} target="_blank" rel="noreferrer">
            {uk ? "Відкрити окремо" : "Open on its own"}
            <Icon name="external" size={13} />
          </a>
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
            ? "Документація надається самим сервісом. Якщо панель порожня — сервіс недоступний із вашої мережі."
            : "Docs are served by the service itself. If this pane is blank, the service isn't reachable from your network."}
        </p>
      </section>
    </MarketingShell>
  );
}
