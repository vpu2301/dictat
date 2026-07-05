// MarketingShell.jsx — Shared chrome (nav + footer) for ALL public marketing
// pages: the landing page, About, Contact, Careers, Blog, Pricing, the
// specialty pages, the legal pages and the feature/product/security detail
// pages all render inside this shell so they share one consistent header
// (with dropdown menus) and footer.
//
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React, { useEffect, useRef, useState } from "react";
import { Icon, Logo } from "../../components/UI.jsx";

/* ── Top navigation ───────────────────────────────────────────
   Heidi-style menu: dropdown groups with icon + one-line description,
   plus a direct Pricing link. Shared by the landing page and every
   marketing sub-page. */
export const NAV = {
  uk: {
    groups: [
      {
        id: "product", label: "Продукт",
        links: [
          { icon: "waveform", label: "Scribe", desc: "Амбулаторний скрайб для прийомів", path: "/product/scribe" },
          { icon: "fileText", label: "Dictate", desc: "Класичне диктування звітів", path: "/product/dictate" },
          { icon: "sparkle", label: "Можливості", desc: "Розпізнавання, шаблони, підпис", path: "/features" },
          { icon: "shield", label: "Безпека", desc: "Приватність, аудит, відповідність", path: "/security" },
        ],
      },
      {
        id: "specialties", label: "Спеціальності",
        links: [
          { icon: "home", label: "Сімейна медицина", desc: "Амбулаторні прийоми без паперів", path: "/specialties/general-practice" },
          { icon: "scan", label: "Радіологія", desc: "Висновки швидше, ніж друк", path: "/specialties/radiology" },
          { icon: "heart", label: "Психіатрія і психологія", desc: "Присутність замість конспекту", path: "/specialties/mental-health" },
          { icon: "scalpel", label: "Хірургія", desc: "Протоколи операцій голосом", path: "/specialties/surgery" },
          { icon: "users", label: "Педіатрія", desc: "Уся увага — дитині", path: "/specialties/pediatrics" },
          { icon: "waveform", label: "Кардіологія", desc: "Структуровані висновки обстежень", path: "/specialties/cardiology" },
          { icon: "grid", label: "Усі спеціальності", desc: "Як Dictat працює у вашій галузі", path: "/specialties" },
        ],
      },
      {
        id: "resources", label: "Ресурси",
        links: [
          { icon: "users", label: "Історії клієнтів", desc: "Клініки, які вже працюють з Dictat", path: "/customers" },
          { icon: "book", label: "Блог", desc: "Нотатки про продукт і галузь", path: "/blog" },
          { icon: "help", label: "Часті питання", desc: "Відповіді про продукт і дані", path: "/faq" },
          { icon: "inbox", label: "Контакти", desc: "Демо, продажі, підтримка", path: "/contact" },
        ],
      },
    ],
    pricing: { label: "Ціни", path: "/pricing" },
    signin: "Увійти",
    start: "Запросити доступ",
  },
  en: {
    groups: [
      {
        id: "product", label: "Product",
        links: [
          { icon: "waveform", label: "Scribe", desc: "Ambient scribe for visits", path: "/product/scribe" },
          { icon: "fileText", label: "Dictate", desc: "Classic report dictation", path: "/product/dictate" },
          { icon: "sparkle", label: "Features", desc: "Recognition, templates, signing", path: "/features" },
          { icon: "shield", label: "Security", desc: "Privacy, audit, compliance", path: "/security" },
        ],
      },
      {
        id: "specialties", label: "Specialties",
        links: [
          { icon: "home", label: "General practice", desc: "Ambulatory visits without paperwork", path: "/specialties/general-practice" },
          { icon: "scan", label: "Radiology", desc: "Reports faster than typing", path: "/specialties/radiology" },
          { icon: "heart", label: "Psychiatry & psychology", desc: "Presence instead of note-taking", path: "/specialties/mental-health" },
          { icon: "scalpel", label: "Surgery", desc: "Operative notes by voice", path: "/specialties/surgery" },
          { icon: "users", label: "Pediatrics", desc: "Full attention on the child", path: "/specialties/pediatrics" },
          { icon: "waveform", label: "Cardiology", desc: "Structured study reports", path: "/specialties/cardiology" },
          { icon: "grid", label: "All specialties", desc: "How Dictat works in your field", path: "/specialties" },
        ],
      },
      {
        id: "resources", label: "Resources",
        links: [
          { icon: "users", label: "Customer stories", desc: "Clinics already running on Dictat", path: "/customers" },
          { icon: "book", label: "Blog", desc: "Notes on the product and the field", path: "/blog" },
          { icon: "help", label: "FAQ", desc: "Answers about the product and data", path: "/faq" },
          { icon: "inbox", label: "Contact", desc: "Demos, sales, support", path: "/contact" },
        ],
      },
    ],
    pricing: { label: "Pricing", path: "/pricing" },
    signin: "Sign in",
    start: "Request access",
  },
};

/* The footer map is shared with the landing page so the columns stay in sync.
   Each link carries a real route (no jump-to-section stubs). */
export const FOOTER = {
  uk: {
    tag: "Медичне диктування голосом.",
    cols: [
      { h: "Продукт", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Можливості", path: "/features" },
        { label: "Безпека", path: "/security" },
        { label: "Ціни", path: "/pricing" },
      ] },
      { h: "Спеціальності", links: [
        { label: "Сімейна медицина", path: "/specialties/general-practice" },
        { label: "Радіологія", path: "/specialties/radiology" },
        { label: "Психіатрія", path: "/specialties/mental-health" },
        { label: "Хірургія", path: "/specialties/surgery" },
        { label: "Усі спеціальності", path: "/specialties" },
      ] },
      { h: "Ресурси", links: [
        { label: "Історії клієнтів", path: "/customers" },
        { label: "Блог", path: "/blog" },
        { label: "Часті питання", path: "/faq" },
        { label: "Контакти", path: "/contact" },
      ] },
      { h: "Компанія", links: [
        { label: "Про нас", path: "/about" },
        { label: "Кар'єра", path: "/careers" },
        { label: "Контакти", path: "/contact" },
      ] },
      { h: "Правове", links: [
        { label: "Конфіденційність", path: "/legal/privacy" },
        { label: "Умови", path: "/legal/terms" },
        { label: "Обробка даних", path: "/legal/data" },
        { label: "Згода", path: "/legal/consent" },
      ] },
    ],
    rights: "Усі права захищено.",
    signin: "Увійти",
    start: "Запросити доступ",
  },
  en: {
    tag: "Medical dictation by voice.",
    cols: [
      { h: "Product", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Features", path: "/features" },
        { label: "Security", path: "/security" },
        { label: "Pricing", path: "/pricing" },
      ] },
      { h: "Specialties", links: [
        { label: "General practice", path: "/specialties/general-practice" },
        { label: "Radiology", path: "/specialties/radiology" },
        { label: "Psychiatry", path: "/specialties/mental-health" },
        { label: "Surgery", path: "/specialties/surgery" },
        { label: "All specialties", path: "/specialties" },
      ] },
      { h: "Resources", links: [
        { label: "Customer stories", path: "/customers" },
        { label: "Blog", path: "/blog" },
        { label: "FAQ", path: "/faq" },
        { label: "Contact", path: "/contact" },
      ] },
      { h: "Company", links: [
        { label: "About", path: "/about" },
        { label: "Careers", path: "/careers" },
        { label: "Contact", path: "/contact" },
      ] },
      { h: "Legal", links: [
        { label: "Privacy", path: "/legal/privacy" },
        { label: "Terms", path: "/legal/terms" },
        { label: "Data processing", path: "/legal/data" },
        { label: "Consent", path: "/legal/consent" },
      ] },
    ],
    rights: "All rights reserved.",
    signin: "Sign in",
    start: "Request access",
  },
};

export function MarketingShell({ navigate, lang = "en", tweaks, setTweak, children }) {
  const nav = NAV[lang] || NAV.en;
  const f = FOOTER[lang] || FOOTER.en;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);      // mobile burger
  const [openGroup, setOpenGroup] = useState(null);     // which dropdown is open
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sub-pages start at the top, not wherever the previous page was scrolled.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Click outside / Escape closes any open dropdown.
  useEffect(() => {
    const onDown = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null); };
    const onKey = (e) => { if (e.key === "Escape") { setOpenGroup(null); setMenuOpen(false); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  const go = (path) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    setOpenGroup(null);
    navigate(path);
  };
  const toggleLang = () => setTweak && setTweak("lang", lang === "uk" ? "en" : "uk");

  return (
    <div className="lp">
      {/* ── Menu ───────────────────────────────────────────── */}
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`} ref={navRef}>
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
            <Logo size={28} />
            <span className="lp-brand-name">Dictat</span>
          </a>

          <nav className={`lp-links${menuOpen ? " is-open" : ""}`}>
            {nav.groups.map((g) => (
              <div className={`lp-menu${openGroup === g.id ? " is-open" : ""}`} key={g.id}>
                <button
                  className="lp-menu-btn"
                  aria-expanded={openGroup === g.id}
                  onClick={() => setOpenGroup((o) => (o === g.id ? null : g.id))}
                >
                  {g.label} <Icon name="chevDown" size={14} />
                </button>
                <div className="lp-menu-panel">
                  {g.links.map((l, i) => (
                    <a className="lp-menu-link" href={`#${l.path}`} onClick={go(l.path)} key={i}>
                      <span className="lp-menu-ic"><Icon name={l.icon} size={16} /></span>
                      <span className="lp-menu-txt">
                        <span className="lp-menu-t">{l.label}</span>
                        <span className="lp-menu-d">{l.desc}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <a className="lp-link-flat" href={`#${nav.pricing.path}`} onClick={go(nav.pricing.path)}>{nav.pricing.label}</a>
          </nav>

          <div className="lp-nav-actions">
            <button className="lp-lang" onClick={toggleLang} title="Language">
              {lang === "uk" ? "EN" : "UA"}
            </button>
            <a className="btn btn-ghost lp-signin" href="#/login" onClick={go("/login")}>{nav.signin}</a>
            <a className="btn btn-primary" href="#/signup" onClick={go("/signup")}>{nav.start}</a>
            <button className="lp-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
              <Icon name={menuOpen ? "x" : "moreH"} size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="lp-main">{children}</main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
              <Logo size={26} />
              <span className="lp-brand-name">Dictat</span>
            </a>
            <p className="lp-footer-tag">{f.tag}</p>
          </div>
          <div className="lp-footer-cols">
            {f.cols.map((col, i) => (
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
          <span>© 2026 Dictat. {f.rights}</span>
          <div className="lp-footer-bar-links">
            <a href="#/login" onClick={go("/login")}>{f.signin}</a>
            <a href="#/signup" onClick={go("/signup")}>{f.start}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
