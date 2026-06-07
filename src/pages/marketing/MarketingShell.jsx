// MarketingShell.jsx — Shared chrome (nav + footer) for public marketing
// pages: the landing page sub-pages such as About, Contact, Careers, Blog,
// the legal pages and the feature/product/security detail pages all render
// inside this shell so they share one consistent header and footer.
//
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React, { useEffect, useState } from "react";
import { Icon, Logo } from "../../components/UI.jsx";

/* The footer map is shared with the landing page so the columns stay in sync.
   Each link carries a real route now (no more jump-to-section stubs). */
export const FOOTER = {
  uk: {
    tag: "Медичне диктування голосом.",
    cols: [
      { h: "Продукт", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Можливості", path: "/features" },
        { label: "Безпека", path: "/security" },
      ] },
      { h: "Компанія", links: [
        { label: "Про нас", path: "/about" },
        { label: "Контакти", path: "/contact" },
        { label: "Кар'єра", path: "/careers" },
        { label: "Блог", path: "/blog" },
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
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека" },
  },
  en: {
    tag: "Medical dictation by voice.",
    cols: [
      { h: "Product", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Features", path: "/features" },
        { label: "Security", path: "/security" },
      ] },
      { h: "Company", links: [
        { label: "About", path: "/about" },
        { label: "Contact", path: "/contact" },
        { label: "Careers", path: "/careers" },
        { label: "Blog", path: "/blog" },
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
    nav: { product: "Product", features: "Features", workflow: "How it works", security: "Security" },
  },
};

export function MarketingShell({ navigate, lang = "en", tweaks, setTweak, children }) {
  const f = FOOTER[lang] || FOOTER.en;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sub-pages start at the top, not wherever the previous page was scrolled.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const go = (path) => (e) => { e.preventDefault(); setMenuOpen(false); navigate(path); };
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
            <a href="#/product/scribe" onClick={go("/product/scribe")}>{f.nav.product}</a>
            <a href="#/features" onClick={go("/features")}>{f.nav.features}</a>
            <a href="#/welcome" onClick={go("/welcome")}>{f.nav.workflow}</a>
            <a href="#/security" onClick={go("/security")}>{f.nav.security}</a>
          </nav>

          <div className="lp-nav-actions">
            <button className="lp-lang" onClick={toggleLang} title="Language">
              {lang === "uk" ? "EN" : "UA"}
            </button>
            <a className="btn btn-ghost lp-signin" href="#/login" onClick={go("/login")}>{f.signin}</a>
            <a className="btn btn-primary" href="#/signup" onClick={go("/signup")}>{f.start}</a>
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
