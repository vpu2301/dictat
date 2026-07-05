// MarketingShell.jsx — Shared chrome (nav + footer) for every public page.
//
// The landing page and all marketing sub-pages (About, Contact, Careers,
// Blog, legal, feature/product/security detail) render inside this shell so
// they share one header + footer. The header is an Abridge-style mega-menu:
// two rich dropdowns (Product, Company) + a flat Security link, an indigo
// pill "Request access" CTA, a language toggle and a ghost Sign-in.
//
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React, { useEffect, useRef, useState } from "react";
import { Icon, Logo } from "../../components/UI.jsx";

/* ── Navigation model ──────────────────────────────────────────
   Shared by desktop dropdowns and the mobile accordion. Each menu
   group carries icon + label + short description per Abridge's
   mega-menu pattern; `flat` items render as plain top-level links. */
export const NAV = {
  uk: {
    product: {
      label: "Продукт",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Амбулаторний скрайб для прийомів", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Диктування звітів із шаблонами", path: "/product/dictate" },
        { icon: "layers",   label: "Можливості", desc: "Повний цикл документації", path: "/features" },
      ],
    },
    company: {
      label: "Компанія",
      items: [
        { icon: "home",  label: "Про нас", desc: "Місія та команда", path: "/about" },
        { icon: "users", label: "Кар'єра", desc: "Приєднуйтесь до нас", path: "/careers" },
        { icon: "book",  label: "Блог", desc: "Новини та статті", path: "/blog" },
        { icon: "help",  label: "Контакти", desc: "Зв'язатися з нами", path: "/contact" },
      ],
    },
    flat: [{ label: "Тарифи", path: "/pricing" }, { label: "Безпека", path: "/security" }],
  },
  en: {
    product: {
      label: "Product",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambient scribe for encounters", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Report dictation with templates", path: "/product/dictate" },
        { icon: "layers",   label: "Features", desc: "The full documentation cycle", path: "/features" },
      ],
    },
    company: {
      label: "Company",
      items: [
        { icon: "home",  label: "About", desc: "Our mission and team", path: "/about" },
        { icon: "users", label: "Careers", desc: "Join the team", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "News and writing", path: "/blog" },
        { icon: "help",  label: "Contact", desc: "Talk to us", path: "/contact" },
      ],
    },
    flat: [{ label: "Pricing", path: "/pricing" }, { label: "Security", path: "/security" }],
  },
};

/* The footer map is shared with the landing page so the columns stay in sync.
   Each link carries a real route (no jump-to-section stubs). */
export const FOOTER = {
  uk: {
    tag: "Медичне диктування голосом. Дані не залишають вашого розгортання.",
    cols: [
      { h: "Продукт", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Можливості", path: "/features" },
        { label: "Тарифи", path: "/pricing" },
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
    start: "Реєстрація",
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека" },
  },
  en: {
    tag: "Medical dictation by voice. Data never leaves your deployment.",
    cols: [
      { h: "Product", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Features", path: "/features" },
        { label: "Pricing", path: "/pricing" },
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
    start: "Sign up",
    nav: { product: "Product", features: "Features", workflow: "How it works", security: "Security" },
  },
};

/* One dropdown group (Product / Company). Opens on hover (desktop) or click
   (touch); the parent tracks which group is open so only one shows at a time. */
function NavGroup({ group, open, onOpen, onClose, onNavigate }) {
  const go = (path) => (e) => { e.preventDefault(); onClose(); onNavigate(path); };
  return (
    <div
      className={`lp-navgroup${open ? " is-open" : ""}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        className="lp-navtrigger"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {group.label}
        <Icon name="chevDown" size={15} />
      </button>
      <div className="lp-megamenu" role="menu">
        {group.items.map((it, i) => (
          <a className="lp-megaitem" href={`#${it.path}`} onClick={go(it.path)} key={i} role="menuitem">
            <span className="lp-megaitem-icon"><Icon name={it.icon} size={18} /></span>
            <span className="lp-megaitem-text">
              <span className="lp-megaitem-label">{it.label}</span>
              <span className="lp-megaitem-desc">{it.desc}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function MarketingShell({ navigate, lang = "en", tweaks, setTweak, children }) {
  const f = FOOTER[lang] || FOOTER.en;
  const n = NAV[lang] || NAV.en;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // mobile drawer
  const [openGroup, setOpenGroup] = useState(null);  // desktop dropdown
  const headerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sub-pages start at the top, not wherever the previous page was scrolled.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Close any open dropdown on Escape or an outside click.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setOpenGroup(null); setMenuOpen(false); } };
    const onClick = (e) => { if (headerRef.current && !headerRef.current.contains(e.target)) setOpenGroup(null); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, []);

  const go = (path) => (e) => { e.preventDefault(); setMenuOpen(false); setOpenGroup(null); navigate(path); };
  const toggleLang = () => setTweak && setTweak("lang", lang === "uk" ? "en" : "uk");

  return (
    <div className="lp">
      {/* ── Menu ───────────────────────────────────────────── */}
      <header ref={headerRef} className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
            <Logo size={28} />
            <span className="lp-brand-name">Dictat</span>
          </a>

          <nav className={`lp-links${menuOpen ? " is-open" : ""}`}>
            <NavGroup group={n.product} open={openGroup === "product"}
              onOpen={() => setOpenGroup("product")} onClose={() => setOpenGroup(null)} onNavigate={navigate} />
            {n.flat.map((l, i) => (
              <a className="lp-navlink" href={`#${l.path}`} onClick={go(l.path)} key={i}>{l.label}</a>
            ))}
            <NavGroup group={n.company} open={openGroup === "company"}
              onOpen={() => setOpenGroup("company")} onClose={() => setOpenGroup(null)} onNavigate={navigate} />
          </nav>

          <div className="lp-nav-actions">
            <button className="lp-lang" onClick={toggleLang} title="Language">
              {lang === "uk" ? "EN" : "UA"}
            </button>
            <a className="btn btn-ghost lp-signin" href="#/login" onClick={go("/login")}>{f.signin}</a>
            <a className="btn btn-primary lp-nav-cta" href="#/signup" onClick={go("/signup")}>{f.start}</a>
            <button className="lp-burger" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }} aria-label="Menu">
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
