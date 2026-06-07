// LandingPage.jsx — Public marketing landing for Dictat.
// Sticky menu, hero, products, features, workflow, security, CTA, footer.
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React, { useEffect, useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";
import { FOOTER } from "./marketing/MarketingShell.jsx";

/* ── Copy ─────────────────────────────────────────────────────
   One bilingual dictionary keeps the marketing surface readable
   and easy to keep in sync between Ukrainian and English. */
const COPY = {
  uk: {
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека", signin: "Увійти", start: "Запросити доступ" },
    hero: {
      eyebrow: "Медичне диктування нового покоління",
      title: "Клінічна документація голосом — швидко, точно, безпечно",
      sub: "Dictat перетворює мову лікаря на структуровані медичні нотатки в реальному часі. Менше друку, більше часу для пацієнта.",
      ctaPrimary: "Почати безкоштовно",
      ctaSecondary: "Подивитися можливості",
      note: "Self-hosted моделі • Дані не залишають вашого розгортання",
    },
    trust: "Створено для клінік, лікарень і приватної практики",
    stats: [
      { v: "98%", l: "точність розпізнавання медичної мови" },
      { v: "3×", l: "швидше за ручне введення" },
      { v: "2 мови", l: "українська та англійська" },
      { v: "24/7", l: "доступ із будь-якого пристрою" },
    ],
    principlesTitle: "Збудовано на трьох непорушних принципах",
    principlesSub: "Це не маркетинг, а архітектурні обмеження — закладені в систему, а не дописані згори.",
    principles: [
      { icon: "home", t: "Суверенітет даних", d: "Усе ASR і генерація працюють на self-hosted відкритих моделях. Жодне аудіо, транскрипт чи нотатка не йдуть до сторонніх API." },
      { icon: "user", t: "Лікар у контурі", d: "Система готує чернетку, але не діагностує. Жоден документ не фіналізується автоматично — останнє слово за лікарем." },
      { icon: "layers", t: "Ізоляція тенантів", d: "Код ніколи не фільтрує за тенантом — це робить база даних через row-level security. Відсутній фільтр не може призвести до витоку." },
    ],
    productsTitle: "Два продукти — один робочий процес",
    productsSub: "Оберіть режим під свій сценарій: амбулаторний прийом або класичне диктування звітів.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Амбулаторний скрайб",
        body: "Веде прийом разом з вами: фіксує розмову з пацієнтом, формує структуровану нотатку та підказує наступні кроки.",
        points: ["Згода пацієнта та індикатор запису", "Профілі пацієнтів і таймлайн візитів", "Автоматична структура нотатки"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Диктування звітів",
        body: "Класичне диктування для радіології, патології та виписок із шаблонами, голосовими командами та порівнянням версій.",
        points: ["Шаблони звітів і голосові команди", "Порівняння змін та амендменти", "Експорт, друк і підписання"],
      },
    ],
    featuresTitle: "Усе для впевненої документації",
    featuresSub: "Від розпізнавання мови до підпису — повний цикл в одному застосунку.",
    features: [
      { icon: "mic", t: "Розпізнавання в реальному часі", d: "Потокове ASR із підсвічуванням слів низької впевненості для швидкої перевірки.", path: "/features/recognition" },
      { icon: "sparkle", t: "Розумне автодоповнення", d: "Контекстні підказки термінів, діагнозів і фраз під час диктування.", path: "/features/autocomplete" },
      { icon: "layers", t: "Шаблони та структури", d: "Готові структури нотаток і власні шаблони під спеціальність.", path: "/features/templates" },
      { icon: "history", t: "Версії та амендменти", d: "Повна історія змін, порівняння діфів і коректне внесення правок.", path: "/features/versions" },
      { icon: "sign", t: "Електронний підпис Дія", d: "Підписання документів через Дія з публічною перевіркою за посиланням.", path: "/features/signature" },
      { icon: "shield", t: "Аудит і відповідність", d: "Журнал подій, перевірка цілісності та рольовий доступ.", path: "/features/audit" },
    ],
    workflowTitle: "Від голосу до підписаного документа",
    workflow: [
      { n: "01", t: "Говоріть", d: "Почніть прийом або диктування — Dictat розпізнає мову в реальному часі." },
      { n: "02", t: "Перевірте", d: "Структурована нотатка з підсвіченими сумнівними місцями для швидкої правки." },
      { n: "03", t: "Підпишіть", d: "Підпишіть через Дія та поділіться посиланням для перевірки." },
    ],
    securityTitle: "Безпека та приватність за замовчуванням",
    securitySub: "Дані пацієнтів захищені на кожному етапі — від запису до архіву.",
    security: [
      { icon: "shield", t: "Рольовий доступ", d: "Доступ за ролями: лікар, адміністратор, аудитор." },
      { icon: "history", t: "Незмінний аудит", d: "Кожна дія фіксується з можливістю перевірки цілісності." },
      { icon: "check", t: "Згода пацієнта", d: "Явна згода перед записом і прозорий індикатор стану." },
    ],
    ctaTitle: "Готові повернути час лікарям?",
    ctaSub: "Спробуйте Dictat у вашій клініці вже сьогодні.",
    ctaPrimary: "Запросити доступ",
    ctaSecondary: "Увійти",
    footer: {
      tag: "Медичне диктування голосом.",
      cols: [
        { h: "Продукт", links: ["Scribe", "Dictate", "Можливості", "Безпека"] },
        { h: "Компанія", links: ["Про нас", "Контакти", "Кар'єра", "Блог"] },
        { h: "Правове", links: ["Конфіденційність", "Умови", "Обробка даних", "Згода"] },
      ],
      rights: "Усі права захищено.",
    },
  },
  en: {
    nav: { product: "Product", features: "Features", workflow: "How it works", security: "Security", signin: "Sign in", start: "Request access" },
    hero: {
      eyebrow: "Next-generation medical dictation",
      title: "Clinical documentation by voice — fast, accurate, secure",
      sub: "Dictat turns a clinician's speech into structured medical notes in real time. Less typing, more time for the patient.",
      ctaPrimary: "Get started free",
      ctaSecondary: "See features",
      note: "Self-hosted models • Data never leaves your deployment",
    },
    trust: "Built for clinics, hospitals and private practice",
    stats: [
      { v: "98%", l: "medical speech recognition accuracy" },
      { v: "3×", l: "faster than manual entry" },
      { v: "2 languages", l: "Ukrainian and English" },
      { v: "24/7", l: "access from any device" },
    ],
    principlesTitle: "Built on three non-negotiable principles",
    principlesSub: "Not marketing but architectural constraints — built into the system, not bolted on afterwards.",
    principles: [
      { icon: "home", t: "Data sovereignty", d: "All ASR and generation run on self-hosted, open-licensed models. No audio, transcript or note ever goes to a third-party API." },
      { icon: "user", t: "Clinician in the loop", d: "The system drafts, it does not diagnose. Nothing is finalized automatically — the clinician always has the last word." },
      { icon: "layers", t: "Tenant isolation", d: "Application code never filters by tenant — the database does, via row-level security. A missing filter can't leak data." },
    ],
    productsTitle: "Two products — one workflow",
    productsSub: "Pick the mode for your scenario: ambient encounters or classic report dictation.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Ambient scribe",
        body: "Runs the visit with you: captures the patient conversation, builds a structured note and suggests next steps.",
        points: ["Patient consent & recording indicator", "Patient profiles and visit timeline", "Automatic note structure"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Report dictation",
        body: "Classic dictation for radiology, pathology and discharge summaries with templates, voice commands and version diffs.",
        points: ["Report templates and voice commands", "Change diffs and amendments", "Export, print and sign"],
      },
    ],
    featuresTitle: "Everything for confident documentation",
    featuresSub: "From speech recognition to signature — the full cycle in one app.",
    features: [
      { icon: "mic", t: "Real-time recognition", d: "Streaming ASR with low-confidence words highlighted for quick review.", path: "/features/recognition" },
      { icon: "sparkle", t: "Smart autocomplete", d: "Context-aware suggestions for terms, diagnoses and phrases as you dictate.", path: "/features/autocomplete" },
      { icon: "layers", t: "Templates & structures", d: "Ready-made note structures and custom templates per specialty.", path: "/features/templates" },
      { icon: "history", t: "Versions & amendments", d: "Full change history, diff comparison and correct amendment flow.", path: "/features/versions" },
      { icon: "sign", t: "Дія e-signature", d: "Sign documents via Дія with public link verification.", path: "/features/signature" },
      { icon: "shield", t: "Audit & compliance", d: "Event log, integrity verification and role-based access.", path: "/features/audit" },
    ],
    workflowTitle: "From voice to a signed document",
    workflow: [
      { n: "01", t: "Speak", d: "Start an encounter or dictation — Dictat recognizes speech in real time." },
      { n: "02", t: "Review", d: "A structured note with uncertain spots highlighted for fast edits." },
      { n: "03", t: "Sign", d: "Sign via Дія and share a verification link." },
    ],
    securityTitle: "Security and privacy by default",
    securitySub: "Patient data is protected at every step — from recording to archive.",
    security: [
      { icon: "shield", t: "Role-based access", d: "Access by role: clinician, administrator, auditor." },
      { icon: "history", t: "Immutable audit", d: "Every action is logged with integrity verification." },
      { icon: "check", t: "Patient consent", d: "Explicit consent before recording with a clear status indicator." },
    ],
    ctaTitle: "Ready to give clinicians their time back?",
    ctaSub: "Try Dictat in your clinic today.",
    ctaPrimary: "Request access",
    ctaSecondary: "Sign in",
    footer: {
      tag: "Medical dictation by voice.",
      cols: [
        { h: "Product", links: ["Scribe", "Dictate", "Features", "Security"] },
        { h: "Company", links: ["About", "Contact", "Careers", "Blog"] },
        { h: "Legal", links: ["Privacy", "Terms", "Data processing", "Consent"] },
      ],
      rights: "All rights reserved.",
    },
  },
};

export function LandingPage({ navigate, lang = "en", tweaks, setTweak }) {
  const c = COPY[lang] || COPY.en;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Shrink/condense the menu once the user scrolls off the hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (path) => (e) => { e.preventDefault(); navigate(path); };
  const jump = (id) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleLang = () => setTweak && setTweak("lang", lang === "uk" ? "en" : "uk");

  return (
    <div className="lp">
      {/* ── Menu ───────────────────────────────────────────── */}
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
            <Logo size={28} />
            <span className="lp-brand-name">Dictat</span>
          </a>

          <nav className={`lp-links${menuOpen ? " is-open" : ""}`}>
            <a href="#product" onClick={jump("product")}>{c.nav.product}</a>
            <a href="#features" onClick={jump("features")}>{c.nav.features}</a>
            <a href="#workflow" onClick={jump("workflow")}>{c.nav.workflow}</a>
            <a href="#security" onClick={jump("security")}>{c.nav.security}</a>
          </nav>

          <div className="lp-nav-actions">
            <button className="lp-lang" onClick={toggleLang} title="Language">
              {lang === "uk" ? "EN" : "UA"}
            </button>
            <a className="btn btn-ghost lp-signin" href="#/login" onClick={go("/login")}>{c.nav.signin}</a>
            <a className="btn btn-primary" href="#/signup" onClick={go("/signup")}>{c.nav.start}</a>
            <button className="lp-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
              <Icon name={menuOpen ? "x" : "moreH"} size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="lp-main">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-hero-text">
            <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {c.hero.eyebrow}</span>
            <h1 className="lp-h1">{c.hero.title}</h1>
            <p className="lp-lead">{c.hero.sub}</p>
            <div className="lp-hero-cta">
              <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{c.hero.ctaPrimary}</a>
              <a className="btn lp-cta-lg" href="#features" onClick={jump("features")}>{c.hero.ctaSecondary}</a>
            </div>
            <p className="lp-hero-note"><Icon name="check" size={13} /> {c.hero.note}</p>
          </div>

          {/* Decorative product mock — pure CSS, no asset deps. */}
          <div className="lp-hero-art" aria-hidden="true">
            <div className="lp-mock">
              <div className="lp-mock-bar">
                <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
              </div>
              <div className="lp-mock-body">
                <div className="lp-mock-rec"><span className="lp-pulse" /> {lang === "uk" ? "Запис…" : "Recording…"}</div>
                <div className="lp-wave">
                  {[10, 18, 28, 16, 34, 22, 40, 26, 14, 30, 20, 36, 12, 24].map((h, i) => (
                    <span key={i} style={{ height: h }} />
                  ))}
                </div>
                <div className="lp-mock-lines">
                  <div className="lp-mock-line w90" />
                  <div className="lp-mock-line w70" />
                  <div className="lp-mock-line w80" />
                  <div className="lp-mock-line w50" />
                </div>
                <div className="lp-mock-chip"><Icon name="sign" size={13} /> Дія</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust + stats ────────────────────────────────── */}
        <section className="lp-trust">
          <p className="lp-trust-label">{c.trust}</p>
          <div className="lp-stats">
            {c.stats.map((s, i) => (
              <div className="lp-stat" key={i}>
                <div className="lp-stat-v">{s.v}</div>
                <div className="lp-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Principles (non-negotiables) ─────────────────── */}
        <section className="lp-section lp-section-alt" id="principles">
          <div className="lp-head">
            <h2 className="lp-h2">{c.principlesTitle}</h2>
            <p className="lp-sub">{c.principlesSub}</p>
          </div>
          <div className="lp-grid lp-grid-3">
            {c.principles.map((f, i) => (
              <div className="lp-feature" key={i}>
                <div className="lp-feature-icon"><Icon name={f.icon} size={18} /></div>
                <h3 className="lp-feature-t">{f.t}</h3>
                <p className="lp-feature-d">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Products ─────────────────────────────────────── */}
        <section className="lp-section" id="product">
          <div className="lp-head">
            <h2 className="lp-h2">{c.productsTitle}</h2>
            <p className="lp-sub">{c.productsSub}</p>
          </div>
          <div className="lp-products">
            {c.products.map((p, i) => (
              <article className="lp-product" key={i}>
                <div className="lp-product-icon"><Icon name={p.icon} size={22} /></div>
                <span className="lp-product-tag">{p.tag}</span>
                <h3 className="lp-product-title">{p.title}</h3>
                <p className="lp-product-body">{p.body}</p>
                <ul className="lp-product-points">
                  {p.points.map((pt, j) => (
                    <li key={j}><Icon name="check" size={14} /> {pt}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section className="lp-section lp-section-alt" id="features">
          <div className="lp-head">
            <h2 className="lp-h2">{c.featuresTitle}</h2>
            <p className="lp-sub">{c.featuresSub}</p>
          </div>
          <div className="lp-grid">
            {c.features.map((f, i) => (
              <a className="lp-feature mk-feature-link" href={`#${f.path}`} onClick={go(f.path)} key={i}>
                <div className="lp-feature-icon"><Icon name={f.icon} size={18} /></div>
                <h3 className="lp-feature-t">{f.t}</h3>
                <p className="lp-feature-d">{f.d}</p>
                <span className="mk-card-more">{lang === "uk" ? "Докладніше" : "Learn more"} <Icon name="arrowRight" size={14} /></span>
              </a>
            ))}
          </div>
          <div className="lp-section-cta">
            <a className="btn lp-cta-lg" href="#/features" onClick={go("/features")}>{lang === "uk" ? "Усі можливості" : "All features"}</a>
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────── */}
        <section className="lp-section" id="workflow">
          <div className="lp-head">
            <h2 className="lp-h2">{c.workflowTitle}</h2>
          </div>
          <div className="lp-steps">
            {c.workflow.map((s, i) => (
              <div className="lp-step" key={i}>
                <div className="lp-step-n">{s.n}</div>
                <h3 className="lp-step-t">{s.t}</h3>
                <p className="lp-step-d">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────── */}
        <section className="lp-section lp-section-alt" id="security">
          <div className="lp-head">
            <h2 className="lp-h2">{c.securityTitle}</h2>
            <p className="lp-sub">{c.securitySub}</p>
          </div>
          <div className="lp-grid lp-grid-3">
            {c.security.map((f, i) => (
              <div className="lp-feature" key={i}>
                <div className="lp-feature-icon"><Icon name={f.icon} size={18} /></div>
                <h3 className="lp-feature-t">{f.t}</h3>
                <p className="lp-feature-d">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="lp-cta">
          <h2 className="lp-cta-title">{c.ctaTitle}</h2>
          <p className="lp-cta-sub">{c.ctaSub}</p>
          <div className="lp-cta-actions">
            <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{c.ctaPrimary}</a>
            <a className="btn lp-cta-lg" href="#/login" onClick={go("/login")}>{c.ctaSecondary}</a>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
              <Logo size={26} />
              <span className="lp-brand-name">Dictat</span>
            </a>
            <p className="lp-footer-tag">{c.footer.tag}</p>
          </div>
          <div className="lp-footer-cols">
            {(FOOTER[lang] || FOOTER.en).cols.map((col, i) => (
              <div className="lp-footer-col" key={i}>
                <div className="lp-footer-h">{col.h}</div>
                {col.links.map((l, j) => (
                  <a href={`#${l.path}`} onClick={go(l.path)} key={j}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="lp-footer-bar">
          <span>© 2026 Dictat. {c.footer.rights}</span>
          <div className="lp-footer-bar-links">
            <a href="#/login" onClick={go("/login")}>{c.nav.signin}</a>
            <a href="#/signup" onClick={go("/signup")}>{c.nav.start}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
