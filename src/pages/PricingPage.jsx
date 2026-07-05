// PricingPage.jsx — /pricing. Heidi-style pricing, inside the marketing shell.
//
// Four plans (Free · Pro · Team · Enterprise) with a monthly/annual billing
// toggle, a "most popular" highlight, a feature-comparison matrix and an FAQ
// accordion. Bilingual (uk/en); prices are placeholders (₴ for uk, $ for en).
// This platform is admin-invite-only, so every CTA routes to /signup (the
// create-account / book-a-demo flow) — no self-serve checkout.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";

export function PricingPage({ navigate, lang = "en", tweaks, setTweak }) {
  const uk = lang === "uk";
  const t = (u, e) => (uk ? u : e);
  const [annual, setAnnual] = useState(true);
  const cur = uk ? "₴" : "$";
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  // Placeholder figures — swap before a real launch.
  const PLANS = [
    {
      id: "free", name: t("Безкоштовно", "Free"),
      tagline: t("Для окремого лікаря, щоб спробувати.", "For a solo clinician getting started."),
      monthly: 0, annual: 0, cta: t("Почати безкоштовно", "Get started free"), path: "/signup",
      features: [
        t("До 20 нотаток на місяць", "Up to 20 notes per month"),
        t("Диктування в реальному часі", "Real-time dictation"),
        t("Базові шаблони нотаток", "Basic note templates"),
        t("Експорт у PDF", "Export to PDF"),
      ],
    },
    {
      id: "pro", name: "Pro", popular: true,
      tagline: t("Для активної щоденної практики.", "For busy day-to-day practice."),
      monthly: uk ? 990 : 29, annual: uk ? 790 : 23, cta: t("Спробувати 14 днів", "Try 14 days free"), path: "/signup",
      features: [
        t("Необмежені нотатки", "Unlimited notes"),
        t("Усі шаблони та голосові команди", "All templates & voice commands"),
        t("Розумне автодоповнення", "Smart autocomplete"),
        t("Версії та амендменти", "Versions & amendments"),
        t("Електронний підпис Дія", "Дія e-signature"),
      ],
    },
    {
      id: "team", name: t("Команда", "Team"),
      tagline: t("Для клінік і груп лікарів.", "For clinics and clinician groups."),
      monthly: uk ? 2490 : 69, annual: uk ? 1990 : 55, cta: t("Спробувати 14 днів", "Try 14 days free"), path: "/signup",
      features: [
        t("Усе з Pro", "Everything in Pro"),
        t("Спільні шаблони закладу", "Shared organisation templates"),
        t("Ролі та керування доступом", "Roles & access management"),
        t("Аудит і журнал подій", "Audit log & event history"),
        t("Пріоритетна підтримка", "Priority support"),
      ],
    },
    {
      id: "ent", name: "Enterprise",
      tagline: t("Для лікарень і мереж.", "For hospitals and networks."),
      custom: true, cta: t("Зв'язатися з нами", "Talk to us"), path: "/signup",
      features: [
        t("Усе з Команди", "Everything in Team"),
        t("Self-hosted розгортання", "Self-hosted deployment"),
        t("SSO та інтеграції (HL7/FHIR)", "SSO & integrations (HL7/FHIR)"),
        t("Індивідуальні моделі ASR", "Custom ASR models"),
        t("Виділений менеджер", "Dedicated success manager"),
      ],
    },
  ];

  const priceOf = (p) => {
    if (p.custom) return null;
    const v = annual ? p.annual : p.monthly;
    return v === 0 ? "0" : `${cur}${v.toLocaleString(uk ? "uk-UA" : "en-US")}`;
  };

  // Feature-comparison matrix. Cell values: true (✓), false (—) or a string.
  const COMPARE = [
    { group: t("Документація", "Documentation"), rows: [
      { label: t("Нотаток на місяць", "Notes per month"), cells: ["20", "∞", "∞", "∞"] },
      { label: t("Шаблони та структури", "Templates & structures"), cells: [t("Базові", "Basic"), true, true, true] },
      { label: t("Голосові команди", "Voice commands"), cells: [false, true, true, true] },
      { label: t("Версії та амендменти", "Versions & amendments"), cells: [false, true, true, true] },
      { label: t("Підпис Дія", "Дія signature"), cells: [false, true, true, true] },
    ] },
    { group: t("Команда", "Team"), rows: [
      { label: t("Спільні шаблони", "Shared templates"), cells: [false, false, true, true] },
      { label: t("Ролі та доступ", "Roles & access"), cells: [false, false, true, true] },
      { label: t("Аудит подій", "Audit log"), cells: [false, false, true, true] },
    ] },
    { group: t("Платформа та безпека", "Platform & security"), rows: [
      { label: t("Self-hosted розгортання", "Self-hosted deployment"), cells: [false, false, false, true] },
      { label: t("SSO / SAML", "SSO / SAML"), cells: [false, false, false, true] },
      { label: t("Інтеграції HL7/FHIR", "HL7/FHIR integrations"), cells: [false, false, false, true] },
      { label: t("Підтримка", "Support"), cells: [t("Спільнота", "Community"), t("Email", "Email"), t("Пріоритетна", "Priority"), t("Виділена", "Dedicated")] },
    ] },
  ];

  const FAQ = [
    { q: t("Чи можна змінити тариф пізніше?", "Can I change plans later?"),
      a: t("Так — оновлюйте або знижуйте тариф будь-коли; зміни застосовуються з наступного циклу.", "Yes — upgrade or downgrade any time; changes apply from your next billing cycle.") },
    { q: t("Що означає self-hosted?", "What does self-hosted mean?"),
      a: t("Уся обробка ASR і генерація працюють у вашому розгортанні. Аудіо, транскрипти й нотатки не залишають вашої інфраструктури.", "All ASR and generation run inside your own deployment. Audio, transcripts and notes never leave your infrastructure.") },
    { q: t("Чи є безкоштовний період?", "Is there a free trial?"),
      a: t("Плани Pro і Команда мають 14 днів безкоштовно, без прив'язки картки.", "Pro and Team include a 14-day free trial, no card required.") },
    { q: t("Як створюються акаунти?", "How are accounts created?"),
      a: t("Акаунти надає адміністратор вашого закладу через запрошення на пошту — самостійна реєстрація для команд недоступна.", "Accounts are provisioned by your organisation's administrator via an email invite — there's no self-serve sign-up for teams.") },
    { q: t("Які способи оплати?", "What payment methods do you accept?"),
      a: t("Картки та банківський переказ для річних планів. Enterprise — за рахунком.", "Cards and bank transfer for annual plans. Enterprise is invoiced.") },
  ];

  const cell = (v) =>
    v === true ? <Icon name="check" size={16} /> :
    v === false ? <span className="mk-price-dash">—</span> :
    <span className="mk-price-cellv">{v}</span>;

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <section className="mk-price-hero">
        <span className="lp-eyebrow">{t("Тарифи", "Pricing")}</span>
        <h1 className="mk-hero-title">{t("Прості тарифи для кожної практики", "Simple pricing for every practice")}</h1>
        <p className="mk-price-sub">{t("Почніть безкоштовно. Оновлюйтесь, коли зростатимете. Скасувати можна будь-коли.", "Start free. Upgrade as you grow. Cancel any time.")}</p>

        <div className="mk-price-toggle" role="tablist" aria-label={t("Період оплати", "Billing period")}>
          <button role="tab" aria-selected={!annual} className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
            {t("Щомісяця", "Monthly")}
          </button>
          <button role="tab" aria-selected={annual} className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
            {t("Щороку", "Annual")} <span className="mk-price-save">−20%</span>
          </button>
        </div>
      </section>

      <section className="mk-price-grid">
        {PLANS.map((p) => (
          <div className={`mk-price-card${p.popular ? " is-popular" : ""}`} key={p.id}>
            {p.popular && <span className="mk-price-badge">{t("Найпопулярніший", "Most popular")}</span>}
            <div className="mk-price-name">{p.name}</div>
            <p className="mk-price-tag">{p.tagline}</p>
            <div className="mk-price-amount">
              {p.custom ? (
                <span className="mk-price-custom">{t("Індивідуально", "Custom")}</span>
              ) : (
                <>
                  <span className="mk-price-num">{priceOf(p)}</span>
                  <span className="mk-price-per">{t("/ місяць", "/ month")}</span>
                </>
              )}
            </div>
            <div className="mk-price-note">
              {p.custom ? t("Річний контракт", "Annual contract") :
                annual ? t("за річної оплати", "billed annually") : t("за щомісячної оплати", "billed monthly")}
            </div>
            <a className={`btn ${p.popular ? "btn-primary" : ""} mk-price-cta`} href={`#${p.path}`} onClick={go(p.path)}>
              {p.cta}
            </a>
            <ul className="mk-price-features">
              {p.features.map((f, i) => (
                <li key={i}><Icon name="check" size={15} /> {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mk-section">
        <div className="lp-head"><h2 className="lp-h2">{t("Порівняння можливостей", "Compare features")}</h2></div>
        <div className="mk-price-table-wrap">
          <table className="mk-price-table">
            <thead>
              <tr>
                <th />
                {PLANS.map((p) => <th key={p.id}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((grp, gi) => (
                <React.Fragment key={gi}>
                  <tr className="mk-price-grouprow"><td colSpan={5}>{grp.group}</td></tr>
                  {grp.rows.map((row, ri) => (
                    <tr key={ri}>
                      <td className="mk-price-rowlabel">{row.label}</td>
                      {row.cells.map((c, ci) => <td key={ci} className="mk-price-cell">{cell(c)}</td>)}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mk-section mk-faq">
        <div className="lp-head"><h2 className="lp-h2">{t("Питання та відповіді", "Questions & answers")}</h2></div>
        <div className="mk-faq-list">
          {FAQ.map((item, i) => (
            <details className="mk-faq-item" key={i}>
              <summary>{item.q} <Icon name="chevDown" size={18} /></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2 className="lp-cta-title">{t("Готові спробувати Dictat?", "Ready to try Dictat?")}</h2>
        <p className="lp-cta-sub">{t("Зареєструйтесь — і поверніть лікарям час для пацієнтів.", "Sign up and give clinicians their time back.")}</p>
        <div className="lp-cta-actions">
          <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{t("Зареєструватися", "Sign up")}</a>
          <a className="btn lp-cta-lg" href="#/contact" onClick={go("/contact")}>{t("Зв'язатися з нами", "Talk to us")}</a>
        </div>
      </section>
    </MarketingShell>
  );
}
