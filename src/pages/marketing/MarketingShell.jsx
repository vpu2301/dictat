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
import { LANGS } from "../../i18n.js";

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
        { icon: "grid",     label: "Шаблони", desc: "Медичні шаблони за спеціальностями", path: "/templates" },
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
        { icon: "grid",     label: "Templates", desc: "Medical note templates by specialty", path: "/templates" },
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
  pl: {
    product: {
      label: "Produkt",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambientowy skryba do wizyt", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Dyktowanie raportów z szablonami", path: "/product/dictate" },
        { icon: "layers",   label: "Funkcje", desc: "Pełny cykl dokumentacji", path: "/features" },
        { icon: "grid",     label: "Szablony", desc: "Szablony notatek według specjalności", path: "/templates" },
      ],
    },
    company: {
      label: "Firma",
      items: [
        { icon: "home",  label: "O nas", desc: "Nasza misja i zespół", path: "/about" },
        { icon: "users", label: "Kariera", desc: "Dołącz do zespołu", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Aktualności i artykuły", path: "/blog" },
        { icon: "help",  label: "Kontakt", desc: "Porozmawiaj z nami", path: "/contact" },
      ],
    },
    flat: [{ label: "Cennik", path: "/pricing" }, { label: "Bezpieczeństwo", path: "/security" }],
  },
  de: {
    product: {
      label: "Produkt",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambienter Scribe für Konsultationen", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Befunddiktat mit Vorlagen", path: "/product/dictate" },
        { icon: "layers",   label: "Funktionen", desc: "Der komplette Dokumentationszyklus", path: "/features" },
        { icon: "grid",     label: "Vorlagen", desc: "Befundvorlagen nach Fachrichtung", path: "/templates" },
      ],
    },
    company: {
      label: "Unternehmen",
      items: [
        { icon: "home",  label: "Über uns", desc: "Unsere Mission und unser Team", path: "/about" },
        { icon: "users", label: "Karriere", desc: "Werden Sie Teil des Teams", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Neuigkeiten und Beiträge", path: "/blog" },
        { icon: "help",  label: "Kontakt", desc: "Sprechen Sie mit uns", path: "/contact" },
      ],
    },
    flat: [{ label: "Preise", path: "/pricing" }, { label: "Sicherheit", path: "/security" }],
  },
  ro: {
    product: {
      label: "Produs",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Scrib ambiental pentru consultații", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Dictarea rapoartelor cu șabloane", path: "/product/dictate" },
        { icon: "layers",   label: "Funcționalități", desc: "Ciclul complet de documentare", path: "/features" },
        { icon: "grid",     label: "Șabloane", desc: "Șabloane de note pe specialități", path: "/templates" },
      ],
    },
    company: {
      label: "Companie",
      items: [
        { icon: "home",  label: "Despre noi", desc: "Misiunea și echipa noastră", path: "/about" },
        { icon: "users", label: "Cariere", desc: "Alăturați-vă echipei", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Noutăți și articole", path: "/blog" },
        { icon: "help",  label: "Contact", desc: "Discutați cu noi", path: "/contact" },
      ],
    },
    flat: [{ label: "Prețuri", path: "/pricing" }, { label: "Securitate", path: "/security" }],
  },
  cs: {
    product: {
      label: "Produkt",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambientní zápis přímo z vyšetření", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Diktování zpráv se šablonami", path: "/product/dictate" },
        { icon: "layers",   label: "Funkce", desc: "Kompletní cyklus dokumentace", path: "/features" },
        { icon: "grid",     label: "Šablony", desc: "Šablony záznamů podle odbornosti", path: "/templates" },
      ],
    },
    company: {
      label: "Společnost",
      items: [
        { icon: "home",  label: "O nás", desc: "Naše poslání a tým", path: "/about" },
        { icon: "users", label: "Kariéra", desc: "Přidejte se k týmu", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Novinky a články", path: "/blog" },
        { icon: "help",  label: "Kontakt", desc: "Ozvěte se nám", path: "/contact" },
      ],
    },
    flat: [{ label: "Ceník", path: "/pricing" }, { label: "Zabezpečení", path: "/security" }],
  },
  sr: {
    product: {
      label: "Proizvod",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambijentalni zapisničar za preglede", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Diktiranje izveštaja sa šablonima", path: "/product/dictate" },
        { icon: "layers",   label: "Funkcije", desc: "Kompletan ciklus dokumentacije", path: "/features" },
        { icon: "grid",     label: "Šabloni", desc: "Šabloni zapisa po specijalnostima", path: "/templates" },
      ],
    },
    company: {
      label: "Kompanija",
      items: [
        { icon: "home",  label: "O nama", desc: "Naša misija i tim", path: "/about" },
        { icon: "users", label: "Karijera", desc: "Pridružite se timu", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Vesti i članci", path: "/blog" },
        { icon: "help",  label: "Kontakt", desc: "Razgovarajte sa nama", path: "/contact" },
      ],
    },
    flat: [{ label: "Cenovnik", path: "/pricing" }, { label: "Bezbednost", path: "/security" }],
  },
  hu: {
    product: {
      label: "Termék",
      items: [
        { icon: "waveform", label: "Scribe", desc: "Ambiens jegyzetelő a vizitekhez", path: "/product/scribe" },
        { icon: "fileText", label: "Dictate", desc: "Leletdiktálás sablonokkal", path: "/product/dictate" },
        { icon: "layers",   label: "Funkciók", desc: "A teljes dokumentációs ciklus", path: "/features" },
        { icon: "grid",     label: "Sablonok", desc: "Jegyzetsablonok szakterületenként", path: "/templates" },
      ],
    },
    company: {
      label: "Vállalat",
      items: [
        { icon: "home",  label: "Rólunk", desc: "Küldetésünk és csapatunk", path: "/about" },
        { icon: "users", label: "Karrier", desc: "Csatlakozzon csapatunkhoz", path: "/careers" },
        { icon: "book",  label: "Blog", desc: "Hírek és cikkek", path: "/blog" },
        { icon: "help",  label: "Kapcsolat", desc: "Beszéljen velünk", path: "/contact" },
      ],
    },
    flat: [{ label: "Árak", path: "/pricing" }, { label: "Biztonság", path: "/security" }],
  },
};

/* Footer "Developers" column — the developer hub (/developers, request access
   + API key), ONE "API Docs" entry into the all-services Swagger browser
   (/developers/api, ApiDocsPage.jsx) and the written docs (/docs). */
const DEV_LINKS = {
  uk: [
    { label: "Для розробників", path: "/developers" },
    { label: "API Docs",        path: "/developers/api" },
    { label: "Документація",    path: "/docs" },
  ],
  en: [
    { label: "Developers",     path: "/developers" },
    { label: "API Docs",       path: "/developers/api" },
    { label: "Documentation",  path: "/docs" },
  ],
  pl: [
    { label: "Dla deweloperów", path: "/developers" },
    { label: "API Docs",        path: "/developers/api" },
    { label: "Dokumentacja",    path: "/docs" },
  ],
  de: [
    { label: "Für Entwickler",  path: "/developers" },
    { label: "API Docs",        path: "/developers/api" },
    { label: "Dokumentation",   path: "/docs" },
  ],
  ro: [
    { label: "Pentru dezvoltatori", path: "/developers" },
    { label: "API Docs",            path: "/developers/api" },
    { label: "Documentație",        path: "/docs" },
  ],
  cs: [
    { label: "Pro vývojáře",   path: "/developers" },
    { label: "API Docs",       path: "/developers/api" },
    { label: "Dokumentace",    path: "/docs" },
  ],
  sr: [
    { label: "Za programere",  path: "/developers" },
    { label: "API Docs",       path: "/developers/api" },
    { label: "Dokumentacija",  path: "/docs" },
  ],
  hu: [
    { label: "Fejlesztőknek",  path: "/developers" },
    { label: "API Docs",       path: "/developers/api" },
    { label: "Dokumentáció",   path: "/docs" },
  ],
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
        { label: "Шаблони", path: "/templates" },
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
      { h: "Розробникам", links: DEV_LINKS.uk },
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
        { label: "Templates", path: "/templates" },
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
      { h: "Developers", links: DEV_LINKS.en },
    ],
    rights: "All rights reserved.",
    signin: "Sign in",
    start: "Sign up",
    nav: { product: "Product", features: "Features", workflow: "How it works", security: "Security" },
  },
  pl: {
    tag: "Medyczne dyktowanie głosem. Dane nigdy nie opuszczają Twojego wdrożenia.",
    cols: [
      { h: "Produkt", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funkcje", path: "/features" },
        { label: "Szablony", path: "/templates" },
        { label: "Cennik", path: "/pricing" },
        { label: "Bezpieczeństwo", path: "/security" },
      ] },
      { h: "Firma", links: [
        { label: "O nas", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Kariera", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Informacje prawne", links: [
        { label: "Prywatność", path: "/legal/privacy" },
        { label: "Regulamin", path: "/legal/terms" },
        { label: "Przetwarzanie danych", path: "/legal/data" },
        { label: "Zgoda", path: "/legal/consent" },
      ] },
      { h: "Dla deweloperów", links: DEV_LINKS.pl },
    ],
    rights: "Wszelkie prawa zastrzeżone.",
    signin: "Zaloguj się",
    start: "Zarejestruj się",
    nav: { product: "Produkt", features: "Funkcje", workflow: "Jak to działa", security: "Bezpieczeństwo" },
  },
  de: {
    tag: "Medizinisches Diktieren per Sprache. Daten verlassen niemals Ihre Umgebung.",
    cols: [
      { h: "Produkt", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funktionen", path: "/features" },
        { label: "Vorlagen", path: "/templates" },
        { label: "Preise", path: "/pricing" },
        { label: "Sicherheit", path: "/security" },
      ] },
      { h: "Unternehmen", links: [
        { label: "Über uns", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Karriere", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Rechtliches", links: [
        { label: "Datenschutz", path: "/legal/privacy" },
        { label: "Nutzungsbedingungen", path: "/legal/terms" },
        { label: "Datenverarbeitung", path: "/legal/data" },
        { label: "Einwilligung", path: "/legal/consent" },
      ] },
      { h: "Für Entwickler", links: DEV_LINKS.de },
    ],
    rights: "Alle Rechte vorbehalten.",
    signin: "Anmelden",
    start: "Registrieren",
    nav: { product: "Produkt", features: "Funktionen", workflow: "So funktioniert es", security: "Sicherheit" },
  },
  ro: {
    tag: "Dictare medicală prin voce. Datele nu părăsesc niciodată infrastructura dumneavoastră.",
    cols: [
      { h: "Produs", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funcționalități", path: "/features" },
        { label: "Șabloane", path: "/templates" },
        { label: "Prețuri", path: "/pricing" },
        { label: "Securitate", path: "/security" },
      ] },
      { h: "Companie", links: [
        { label: "Despre noi", path: "/about" },
        { label: "Contact", path: "/contact" },
        { label: "Cariere", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Aspecte juridice", links: [
        { label: "Confidențialitate", path: "/legal/privacy" },
        { label: "Termeni și condiții", path: "/legal/terms" },
        { label: "Prelucrarea datelor", path: "/legal/data" },
        { label: "Consimțământ", path: "/legal/consent" },
      ] },
      { h: "Pentru dezvoltatori", links: DEV_LINKS.ro },
    ],
    rights: "Toate drepturile rezervate.",
    signin: "Autentificare",
    start: "Înregistrare",
    nav: { product: "Produs", features: "Funcționalități", workflow: "Cum funcționează", security: "Securitate" },
  },
  cs: {
    tag: "Lékařské diktování hlasem. Data nikdy neopustí vaše nasazení.",
    cols: [
      { h: "Produkt", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funkce", path: "/features" },
        { label: "Šablony", path: "/templates" },
        { label: "Ceník", path: "/pricing" },
        { label: "Zabezpečení", path: "/security" },
      ] },
      { h: "Společnost", links: [
        { label: "O nás", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Kariéra", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Právní informace", links: [
        { label: "Ochrana soukromí", path: "/legal/privacy" },
        { label: "Podmínky", path: "/legal/terms" },
        { label: "Zpracování údajů", path: "/legal/data" },
        { label: "Souhlas", path: "/legal/consent" },
      ] },
      { h: "Pro vývojáře", links: DEV_LINKS.cs },
    ],
    rights: "Všechna práva vyhrazena.",
    signin: "Přihlásit se",
    start: "Registrovat se",
    nav: { product: "Produkt", features: "Funkce", workflow: "Jak to funguje", security: "Zabezpečení" },
  },
  sr: {
    tag: "Medicinsko diktiranje glasom. Podaci nikada ne napuštaju vaše okruženje.",
    cols: [
      { h: "Proizvod", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funkcije", path: "/features" },
        { label: "Šabloni", path: "/templates" },
        { label: "Cenovnik", path: "/pricing" },
        { label: "Bezbednost", path: "/security" },
      ] },
      { h: "Kompanija", links: [
        { label: "O nama", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Karijera", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Pravne informacije", links: [
        { label: "Privatnost", path: "/legal/privacy" },
        { label: "Uslovi korišćenja", path: "/legal/terms" },
        { label: "Obrada podataka", path: "/legal/data" },
        { label: "Saglasnost", path: "/legal/consent" },
      ] },
      { h: "Za programere", links: DEV_LINKS.sr },
    ],
    rights: "Sva prava zadržana.",
    signin: "Prijava",
    start: "Registracija",
    nav: { product: "Proizvod", features: "Funkcije", workflow: "Kako funkcioniše", security: "Bezbednost" },
  },
  hu: {
    tag: "Orvosi diktálás hanggal. Az adatok soha nem hagyják el az Ön környezetét.",
    cols: [
      { h: "Termék", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funkciók", path: "/features" },
        { label: "Sablonok", path: "/templates" },
        { label: "Árak", path: "/pricing" },
        { label: "Biztonság", path: "/security" },
      ] },
      { h: "Vállalat", links: [
        { label: "Rólunk", path: "/about" },
        { label: "Kapcsolat", path: "/contact" },
        { label: "Karrier", path: "/careers" },
        { label: "Blog", path: "/blog" },
      ] },
      { h: "Jogi információk", links: [
        { label: "Adatvédelem", path: "/legal/privacy" },
        { label: "Felhasználási feltételek", path: "/legal/terms" },
        { label: "Adatkezelés", path: "/legal/data" },
        { label: "Hozzájárulás", path: "/legal/consent" },
      ] },
      { h: "Fejlesztőknek", links: DEV_LINKS.hu },
    ],
    rights: "Minden jog fenntartva.",
    signin: "Bejelentkezés",
    start: "Regisztráció",
    nav: { product: "Termék", features: "Funkciók", workflow: "Hogyan működik", security: "Biztonság" },
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

  return (
    <div className="lp">
      {/* ── Menu ───────────────────────────────────────────── */}
      <header ref={headerRef} className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
            <Logo size={28} />
            <span className="lp-brand-name">Klarnote</span>
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
            <label className="lp-lang-select" title="Language">
              <span aria-hidden="true">{(LANGS.find((l) => l.code === lang) || LANGS[1]).short}</span>
              <Icon name="chevDown" size={12} />
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setTweak && setTweak("lang", e.target.value)}
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </label>
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
              <span className="lp-brand-name">Klarnote</span>
            </a>
            <p className="lp-footer-tag">{f.tag}</p>
          </div>
          <div className="lp-footer-cols">
            {f.cols.map((col, i) => (
              <div className="lp-footer-col" key={i}>
                <div className="lp-footer-h">{col.h}</div>
                {col.links.map((l, j) => l.href ? (
                  <a href={l.href} target="_blank" rel="noreferrer" key={j}>{l.label}</a>
                ) : (
                  <a href={`#${l.path}`} onClick={go(l.path)} key={j}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="lp-footer-bar">
          <span>© 2026 Klarnote. {f.rights}</span>
          <div className="lp-footer-bar-links">
            <a href="#/login" onClick={go("/login")}>{f.signin}</a>
            <a href="#/signup" onClick={go("/signup")}>{f.start}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
