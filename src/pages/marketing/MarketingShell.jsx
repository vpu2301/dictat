// MarketingShell.jsx — Shared chrome (nav + footer) for every public page.
//
// The landing page and all marketing sub-pages (About, Contact, Careers,
// Blog, legal, feature/product/security detail) render inside this shell so
// they share one header + footer. The header is an Abridge-style mega-menu:
// two rich dropdowns (Product, Solutions) + flat Pricing and Security links,
// a sign-up CTA, a language toggle and a ghost Sign-in. Resources and Company
// live in the footer.
//
// Localised via the shared `lang` tweak; no auth required.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Logo } from "../../components/UI.jsx";
import { LANGS } from "../../i18n.js";

/* ── Navigation model ──────────────────────────────────────────
   Split in two so eight languages stay maintainable:

   NAV_STRUCT  — shape, icons and routes. Language-independent, written once.
   NAV_TEXT    — per-language strings keyed by the same keys. Items are
                 [label, description] tuples; CTAs are
                 [title, sub, primaryLabel, secondaryLabel].

   Every group renders as a mega-menu panel: an eyebrow + slogan, one or two
   labelled columns of icon/label/description items, and — for groups that
   declare a `cta` — a call-to-action strip pinned to the bottom. `flat`
   entries stay plain top-level links.
   Unknown languages fall back to English per key, so a new language can
   ship partially translated. */
const NAV_STRUCT = [
  {
    key: "product",
    cols: [
      /* Product answers "what do I get". Individual capabilities are
         deliberately NOT listed here — the /features hub covers them, and
         a menu that lists everything sells nothing. */
      { key: "platform", items: [
        { key: "scribe",       icon: "waveform", path: "/product/scribe" },
        { key: "dictate",      icon: "fileText", path: "/product/dictate" },
        { key: "templates",    icon: "grid",     path: "/templates" },
        { key: "features",     icon: "layers",   path: "/features" },
      ] },
    ],
    cta: { primary: "/signup", secondary: "/contact" },
  },
  {
    /* Solutions answers "does it work for my situation" — the question a
       clinician actually arrives with. Each case links to the note template
       that covers it, so the claim is backed by something concrete. */
    key: "solutions",
    cols: [
      { key: "settings", items: [
        { key: "inperson",   icon: "users",   path: "/templates/consultation-note" },
        { key: "telehealth", icon: "video",   path: "/templates/telehealth-visit" },
        { key: "wardround",  icon: "heart",   path: "/templates/progress-note" },
        { key: "procedures", icon: "scalpel", path: "/templates/procedure-note" },
      ] },
    ],
    cta: { primary: "/contact", secondary: "/templates" },
  },
  /* Resources and Company deliberately live in the footer, not up here: they
     are low-intent destinations, and the header stays focused on what the
     product is and whether it fits. See FOOTER's Resources / Company / Legal
     columns, which carry every one of those links. */
];

/* Top-level links that are not dropdowns. */
const NAV_FLAT = [
  { key: "pricing",  path: "/pricing" },
  { key: "security", path: "/security" },
];

const NAV_TEXT = {
  uk: {
    groups: {
      product:   { label: "Продукт", tagline: "Від сказаного слова до підписаного звіту." },
      solutions: { label: "Рішення", tagline: "Скрайб для будь-якого прийому — очно чи онлайн." },
    },
    cols: { platform: "Платформа", settings: "Де це працює" },
    items: {
      scribe:       ["Scribe", "Амбулаторний скрайб для прийомів"],
      dictate:      ["Dictate", "Диктування звітів із шаблонами"],
      templates:    ["Шаблони", "Медичні шаблони за спеціальностями"],
      features:     ["Усі можливості", "Повний цикл документації"],
      inperson:     ["Очні прийоми", "Розмова з пацієнтом у кабінеті"],
      telehealth:   ["Телемедицина та відео", "Дистанційні консультації онлайн"],
      wardround:    ["Обхід і біля ліжка", "Щоденні записи в стаціонарі"],
      procedures:   ["Процедури та операційна", "Протоколи втручань і операцій"],
    },
    cta: {
      product:   ["Спробуйте на власних нотатках", "Безкоштовний старт. Без картки та встановлення.", "Почати безкоштовно", "Замовити демо"],
      solutions: ["Не впевнені, що підійде саме вам?", "Покажемо на вашому робочому процесі.", "Замовити демо", "Переглянути шаблони"],
    },
    flat: { pricing: "Тарифи", security: "Безпека" },
  },
  en: {
    groups: {
      product:   { label: "Product", tagline: "From the spoken word to a signed report." },
      solutions: { label: "Solutions", tagline: "One scribe for every setting — in the room or on video." },
    },
    cols: { platform: "Platform", settings: "Where it works" },
    items: {
      scribe:       ["Scribe", "Ambient scribe for encounters"],
      dictate:      ["Dictate", "Report dictation with templates"],
      templates:    ["Templates", "Note templates by specialty"],
      features:     ["All features", "The full documentation cycle"],
      inperson:     ["In-person visits", "The patient conversation in the room"],
      telehealth:   ["Telehealth & video", "Remote consultations online"],
      wardround:    ["Ward round & bedside", "Daily inpatient progress notes"],
      procedures:   ["Procedures & theatre", "Procedure and operative records"],
    },
    cta: {
      product:   ["Try it on your own notes", "Free to start. No card, no install.", "Start free", "Book a demo"],
      solutions: ["Not sure where Klarnote fits?", "We'll walk you through your workflow.", "Book a demo", "Browse templates"],
    },
    flat: { pricing: "Pricing", security: "Security" },
  },
  pl: {
    groups: {
      product:   { label: "Produkt", tagline: "Od wypowiedzianego słowa do podpisanego raportu." },
      solutions: { label: "Rozwiązania", tagline: "Jeden skryba do każdej sytuacji — w gabinecie i online." },
    },
    cols: { platform: "Platforma", settings: "Gdzie działa" },
    items: {
      scribe:       ["Scribe", "Ambientowy skryba do wizyt"],
      dictate:      ["Dictate", "Dyktowanie raportów z szablonami"],
      templates:    ["Szablony", "Szablony notatek według specjalności"],
      features:     ["Wszystkie funkcje", "Pełny cykl dokumentacji"],
      inperson:     ["Wizyty osobiste", "Rozmowa z pacjentem w gabinecie"],
      telehealth:   ["Telemedycyna i wideo", "Konsultacje zdalne online"],
      wardround:    ["Obchód i przy łóżku", "Codzienne wpisy szpitalne"],
      procedures:   ["Zabiegi i blok operacyjny", "Protokoły zabiegów i operacji"],
    },
    cta: {
      product:   ["Wypróbuj na własnych notatkach", "Darmowy start. Bez karty i instalacji.", "Zacznij za darmo", "Umów demo"],
      solutions: ["Nie wiesz, co pasuje do Ciebie?", "Pokażemy to na Twoim procesie pracy.", "Umów demo", "Przeglądaj szablony"],
    },
    flat: { pricing: "Cennik", security: "Bezpieczeństwo" },
  },
  de: {
    groups: {
      product:   { label: "Produkt", tagline: "Vom gesprochenen Wort zum signierten Befund." },
      solutions: { label: "Lösungen", tagline: "Ein Scribe für jede Situation — vor Ort oder per Video." },
    },
    cols: { platform: "Plattform", settings: "Wo es funktioniert" },
    items: {
      scribe:       ["Scribe", "Ambienter Scribe für Konsultationen"],
      dictate:      ["Dictate", "Befunddiktat mit Vorlagen"],
      templates:    ["Vorlagen", "Befundvorlagen nach Fachrichtung"],
      features:     ["Alle Funktionen", "Der komplette Dokumentationszyklus"],
      inperson:     ["Präsenztermine", "Das Patientengespräch vor Ort"],
      telehealth:   ["Telemedizin & Video", "Fernkonsultationen online"],
      wardround:    ["Visite & am Krankenbett", "Tägliche Verlaufsnotizen"],
      procedures:   ["Eingriffe & OP", "Eingriffs- und OP-Berichte"],
    },
    cta: {
      product:   ["Testen Sie es mit Ihren eigenen Befunden", "Kostenlos starten. Ohne Karte, ohne Installation.", "Kostenlos starten", "Demo buchen"],
      solutions: ["Unsicher, was zu Ihnen passt?", "Wir zeigen es an Ihrem Arbeitsablauf.", "Demo buchen", "Vorlagen ansehen"],
    },
    flat: { pricing: "Preise", security: "Sicherheit" },
  },
  ro: {
    groups: {
      product:   { label: "Produs", tagline: "De la cuvântul rostit la raportul semnat." },
      solutions: { label: "Soluții", tagline: "Un scrib pentru orice context — în cabinet sau video." },
    },
    cols: { platform: "Platformă", settings: "Unde funcționează" },
    items: {
      scribe:       ["Scribe", "Scrib ambiental pentru consultații"],
      dictate:      ["Dictate", "Dictarea rapoartelor cu șabloane"],
      templates:    ["Șabloane", "Șabloane de note pe specialități"],
      features:     ["Toate funcționalitățile", "Ciclul complet de documentare"],
      inperson:     ["Consultații în cabinet", "Conversația cu pacientul la fața locului"],
      telehealth:   ["Telemedicină și video", "Consultații la distanță online"],
      wardround:    ["Vizită și la patul bolnavului", "Note zilnice de evoluție"],
      procedures:   ["Proceduri și sală de operație", "Protocoale de procedură și operatorii"],
    },
    cta: {
      product:   ["Încercați pe propriile note", "Start gratuit. Fără card, fără instalare.", "Începeți gratuit", "Programați o demonstrație"],
      solutions: ["Nu știți ce vi se potrivește?", "Vă arătăm pe fluxul dumneavoastră de lucru.", "Programați o demonstrație", "Vedeți șabloanele"],
    },
    flat: { pricing: "Prețuri", security: "Securitate" },
  },
  cs: {
    groups: {
      product:   { label: "Produkt", tagline: "Od vysloveného slova k podepsané zprávě." },
      solutions: { label: "Řešení", tagline: "Jeden zapisovatel pro každou situaci — v ordinaci i online." },
    },
    cols: { platform: "Platforma", settings: "Kde to funguje" },
    items: {
      scribe:       ["Scribe", "Ambientní skrib pro návštěvy"],
      dictate:      ["Dictate", "Diktování zpráv se šablonami"],
      templates:    ["Šablony", "Šablony nálezů podle oboru"],
      features:     ["Všechny funkce", "Kompletní cyklus dokumentace"],
      inperson:     ["Osobní návštěvy", "Rozhovor s pacientem v ordinaci"],
      telehealth:   ["Telemedicína a video", "Vzdálené konzultace online"],
      wardround:    ["Vizita a u lůžka", "Denní záznamy o průběhu"],
      procedures:   ["Výkony a operační sál", "Zápisy výkonů a operací"],
    },
    cta: {
      product:   ["Vyzkoušejte na vlastních nálezech", "Start zdarma. Bez karty a instalace.", "Začít zdarma", "Domluvit demo"],
      solutions: ["Nevíte, co se k vám hodí?", "Ukážeme to na vašem pracovním postupu.", "Domluvit demo", "Procházet šablony"],
    },
    flat: { pricing: "Ceník", security: "Zabezpečení" },
  },
  sr: {
    groups: {
      product:   { label: "Proizvod", tagline: "Od izgovorene reči do potpisanog izveštaja." },
      solutions: { label: "Rešenja", tagline: "Jedan skrajb za svaku situaciju — uživo ili video." },
    },
    cols: { platform: "Platforma", settings: "Gde funkcioniše" },
    items: {
      scribe:       ["Scribe", "Ambijentalni skrajb za preglede"],
      dictate:      ["Dictate", "Diktiranje izveštaja sa šablonima"],
      templates:    ["Šabloni", "Šabloni nalaza po specijalnosti"],
      features:     ["Sve funkcije", "Kompletan ciklus dokumentacije"],
      inperson:     ["Pregledi uživo", "Razgovor sa pacijentom u ordinaciji"],
      telehealth:   ["Telemedicina i video", "Konsultacije na daljinu onlajn"],
      wardround:    ["Vizita i uz krevet", "Dnevne beleške o toku lečenja"],
      procedures:   ["Procedure i operaciona sala", "Zapisi procedura i operacija"],
    },
    cta: {
      product:   ["Isprobajte na sopstvenim nalazima", "Besplatan početak. Bez kartice i instalacije.", "Počnite besplatno", "Zakažite demo"],
      solutions: ["Niste sigurni šta vam odgovara?", "Pokazaćemo na vašem toku rada.", "Zakažite demo", "Pregledajte šablone"],
    },
    flat: { pricing: "Cene", security: "Bezbednost" },
  },
  hu: {
    groups: {
      product:   { label: "Termék", tagline: "A kimondott szótól az aláírt leletig." },
      solutions: { label: "Megoldások", tagline: "Egy írnok minden helyzetre — a rendelőben vagy videón." },
    },
    cols: { platform: "Platform", settings: "Hol működik" },
    items: {
      scribe:       ["Scribe", "Ambientális jegyzetelő vizitekhez"],
      dictate:      ["Dictate", "Leletdiktálás sablonokkal"],
      templates:    ["Sablonok", "Leletsablonok szakterületenként"],
      features:     ["Összes funkció", "A teljes dokumentációs ciklus"],
      inperson:     ["Személyes vizitek", "A beteggel folytatott beszélgetés a rendelőben"],
      telehealth:   ["Telemedicina és videó", "Távkonzultációk online"],
      wardround:    ["Vizit és betegágy mellett", "Napi kórlefolyás-jegyzetek"],
      procedures:   ["Beavatkozások és műtő", "Beavatkozási és műtéti leírások"],
    },
    cta: {
      product:   ["Próbálja ki saját leletein", "Ingyenes kezdés. Kártya és telepítés nélkül.", "Kezdés ingyen", "Demó foglalása"],
      solutions: ["Nem biztos benne, mi illik Önhöz?", "Megmutatjuk a saját munkafolyamatán.", "Demó foglalása", "Sablonok böngészése"],
    },
    flat: { pricing: "Árak", security: "Biztonság" },
  },
};

/* Resolve NAV_STRUCT against one language, falling back to English per key so
   a partially translated language still renders a complete menu. */
export function buildNav(lang) {
  const t = NAV_TEXT[lang] || NAV_TEXT.en;
  const en = NAV_TEXT.en;
  const item = (k) => t.items[k] || en.items[k];
  const col = (k) => t.cols[k] || en.cols[k];

  return {
    groups: NAV_STRUCT.map((g) => {
      const meta = t.groups[g.key] || en.groups[g.key];
      const cta = g.cta ? (t.cta[g.key] || en.cta[g.key]) : null;
      return {
        key: g.key,
        label: meta.label,
        tagline: meta.tagline,
        cols: g.cols.map((c) => ({
          key: c.key,
          heading: col(c.key),
          items: c.items.map((it) => ({
            icon: it.icon, path: it.path,
            label: item(it.key)[0], desc: item(it.key)[1],
          })),
        })),
        cta: cta && {
          title: cta[0], sub: cta[1],
          primary: { label: cta[2], path: g.cta.primary },
          secondary: { label: cta[3], path: g.cta.secondary },
        },
      };
    }),
    flat: NAV_FLAT.map((l) => ({ label: (t.flat[l.key] || en.flat[l.key]), path: l.path })),
  };
}

/* Footer "Developers" column — the developer hub (/developers, request access
   + API key), ONE "API Docs" entry into the all-services Swagger browser
   (/developers/api, ApiDocsPage.jsx) and the written docs (/docs). */
const RESOURCE_LINKS = {
  uk: [
    { label: "Документація", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Для розробників", path: "/developers" },
    { label: "Блог", path: "/blog" },
  ],
  en: [
    { label: "Documentation", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Developers", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  pl: [
    { label: "Dokumentacja", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Dla deweloperów", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  de: [
    { label: "Dokumentation", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Für Entwickler", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  ro: [
    { label: "Documentație", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Pentru dezvoltatori", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  cs: [
    { label: "Dokumentace", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Pro vývojáře", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  sr: [
    { label: "Dokumentacija", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Za programere", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  hu: [
    { label: "Dokumentáció", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Fejlesztőknek", path: "/developers" },
    { label: "Blog", path: "/blog" },
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
      { h: "Ресурси", links: RESOURCE_LINKS.uk },
      { h: "Компанія", links: [
        { label: "Про нас", path: "/about" },
        { label: "Контакти", path: "/contact" },
        { label: "Кар'єра", path: "/careers" },
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
        { label: "Templates", path: "/templates" },
        { label: "Pricing", path: "/pricing" },
        { label: "Security", path: "/security" },
      ] },
      { h: "Resources", links: RESOURCE_LINKS.en },
      { h: "Company", links: [
        { label: "About", path: "/about" },
        { label: "Contact", path: "/contact" },
        { label: "Careers", path: "/careers" },
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
      { h: "Zasoby", links: RESOURCE_LINKS.pl },
      { h: "Firma", links: [
        { label: "O nas", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Kariera", path: "/careers" },
      ] },
      { h: "Informacje prawne", links: [
        { label: "Prywatność", path: "/legal/privacy" },
        { label: "Regulamin", path: "/legal/terms" },
        { label: "Przetwarzanie danych", path: "/legal/data" },
        { label: "Zgoda", path: "/legal/consent" },
      ] },
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
      { h: "Ressourcen", links: RESOURCE_LINKS.de },
      { h: "Unternehmen", links: [
        { label: "Über uns", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Karriere", path: "/careers" },
      ] },
      { h: "Rechtliches", links: [
        { label: "Datenschutz", path: "/legal/privacy" },
        { label: "Nutzungsbedingungen", path: "/legal/terms" },
        { label: "Datenverarbeitung", path: "/legal/data" },
        { label: "Einwilligung", path: "/legal/consent" },
      ] },
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
      { h: "Resurse", links: RESOURCE_LINKS.ro },
      { h: "Companie", links: [
        { label: "Despre noi", path: "/about" },
        { label: "Contact", path: "/contact" },
        { label: "Cariere", path: "/careers" },
      ] },
      { h: "Aspecte juridice", links: [
        { label: "Confidențialitate", path: "/legal/privacy" },
        { label: "Termeni și condiții", path: "/legal/terms" },
        { label: "Prelucrarea datelor", path: "/legal/data" },
        { label: "Consimțământ", path: "/legal/consent" },
      ] },
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
      { h: "Zdroje", links: RESOURCE_LINKS.cs },
      { h: "Společnost", links: [
        { label: "O nás", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Kariéra", path: "/careers" },
      ] },
      { h: "Právní informace", links: [
        { label: "Ochrana soukromí", path: "/legal/privacy" },
        { label: "Podmínky", path: "/legal/terms" },
        { label: "Zpracování údajů", path: "/legal/data" },
        { label: "Souhlas", path: "/legal/consent" },
      ] },
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
      { h: "Resursi", links: RESOURCE_LINKS.sr },
      { h: "Kompanija", links: [
        { label: "O nama", path: "/about" },
        { label: "Kontakt", path: "/contact" },
        { label: "Karijera", path: "/careers" },
      ] },
      { h: "Pravne informacije", links: [
        { label: "Privatnost", path: "/legal/privacy" },
        { label: "Uslovi korišćenja", path: "/legal/terms" },
        { label: "Obrada podataka", path: "/legal/data" },
        { label: "Saglasnost", path: "/legal/consent" },
      ] },
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
      { h: "Források", links: RESOURCE_LINKS.hu },
      { h: "Vállalat", links: [
        { label: "Rólunk", path: "/about" },
        { label: "Kapcsolat", path: "/contact" },
        { label: "Karrier", path: "/careers" },
      ] },
      { h: "Jogi információk", links: [
        { label: "Adatvédelem", path: "/legal/privacy" },
        { label: "Felhasználási feltételek", path: "/legal/terms" },
        { label: "Adatkezelés", path: "/legal/data" },
        { label: "Hozzájárulás", path: "/legal/consent" },
      ] },
    ],
    rights: "Minden jog fenntartva.",
    signin: "Bejelentkezés",
    start: "Regisztráció",
    nav: { product: "Termék", features: "Funkciók", workflow: "Hogyan működik", security: "Biztonság" },
  },
};

/* One dropdown panel (Product / Resources / Company). Opens on hover (desktop)
   or click (touch); the parent tracks which group is open so only one shows at
   a time. The panel is a slogan header + one or two labelled columns of
   icon/label/description items + a call-to-action strip along the bottom. */
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
        aria-haspopup="true"
        onClick={() => (open ? onClose() : onOpen())}
      >
        {group.label}
        <Icon name="chevDown" size={15} />
      </button>
      {/* --mega-cols drives both the panel width and the column count, so a
          group can gain or lose a column without touching the CSS. */}
      <div className="lp-megamenu" style={{ "--mega-cols": group.cols.length }} role="menu">
        <div className="lp-megahead">
          <span className="lp-megahead-eyebrow">{group.label}</span>
          <p className="lp-megahead-tagline">{group.tagline}</p>
        </div>

        <div className="lp-megacols">
          {group.cols.map((col) => (
            <div className="lp-megacol" key={col.key}>
              <div className="lp-megacol-h">{col.heading}</div>
              {col.items.map((it, i) => (
                <a className="lp-megaitem" href={`#${it.path}`} onClick={go(it.path)} key={i} role="menuitem">
                  <span className="lp-megaitem-icon"><Icon name={it.icon} size={19} /></span>
                  <span className="lp-megaitem-text">
                    <span className="lp-megaitem-label">{it.label}</span>
                    <span className="lp-megaitem-desc">{it.desc}</span>
                  </span>
                  <span className="lp-megaitem-arrow" aria-hidden="true"><Icon name="chevRight" size={15} /></span>
                </a>
              ))}
            </div>
          ))}
        </div>

        {group.cta && (
          <div className="lp-megacta">
            <div className="lp-megacta-text">
              <span className="lp-megacta-title">{group.cta.title}</span>
              <span className="lp-megacta-sub">{group.cta.sub}</span>
            </div>
            <div className="lp-megacta-actions">
              <a className="btn btn-primary lp-megacta-primary" href={`#${group.cta.primary.path}`} onClick={go(group.cta.primary.path)}>
                {group.cta.primary.label}
              </a>
              <a className="lp-megacta-secondary" href={`#${group.cta.secondary.path}`} onClick={go(group.cta.secondary.path)}>
                {group.cta.secondary.label}
                <Icon name="chevRight" size={14} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarketingShell({ navigate, lang = "en", tweaks, setTweak, children }) {
  const f = FOOTER[lang] || FOOTER.en;
  const n = useMemo(() => buildNav(lang), [lang]);
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
            {/* What it is, then whether it fits your situation, then the two
                high-intent flat links. */}
            {n.groups.map((g) => (
              <NavGroup key={g.key} group={g} open={openGroup === g.key}
                onOpen={() => setOpenGroup(g.key)} onClose={() => setOpenGroup(null)} onNavigate={navigate} />
            ))}
            {n.flat.map((l, i) => (
              <a className="lp-navlink" href={`#${l.path}`} onClick={go(l.path)} key={i}>{l.label}</a>
            ))}
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
