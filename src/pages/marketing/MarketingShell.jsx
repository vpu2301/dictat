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
import { HealthBadge } from "../../components/HealthBadge.jsx";
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
  ar: {
    groups: {
      product:   { label: "المنتج", tagline: "من الكلمة المنطوقة إلى تقرير موقّع." },
      solutions: { label: "الحلول", tagline: "كاتب واحد لكل موقف — في الغرفة أو عبر الفيديو." },
    },
    cols: { platform: "المنصة", settings: "أين تعمل" },
    items: {
      scribe:       ["Scribe", "كاتب محيطي للمقابلات"],
      dictate:      ["Dictate", "إملاء التقارير بالقوالب"],
      templates:    ["القوالب", "قوالب الملاحظات حسب التخصص"],
      features:     ["جميع الميزات", "دورة التوثيق الكاملة"],
      inperson:     ["الزيارات الحضورية", "محادثة المريض داخل الغرفة"],
      telehealth:   ["الطب عن بُعد والفيديو", "استشارات عن بُعد عبر الإنترنت"],
      wardround:    ["الجولة الطبية وبجانب السرير", "ملاحظات التقدم اليومية للمرضى الداخليين"],
      procedures:   ["الإجراءات وغرفة العمليات", "سجلات الإجراءات والعمليات"],
    },
    cta: {
      product:   ["جرّبه على ملاحظاتك الخاصة", "ابدأ مجانًا. بدون بطاقة، بدون تثبيت.", "ابدأ مجانًا", "احجز عرضًا توضيحيًا"],
      solutions: ["غير متأكد أين يناسبك Klarnote؟", "سنرشدك عبر سير عملك.", "احجز عرضًا توضيحيًا", "تصفّح القوالب"],
    },
    flat: { pricing: "الأسعار", security: "الأمان" },
  },
  es: {
    groups: {
      product:   { label: "Producto", tagline: "De la palabra dicha al informe firmado." },
      solutions: { label: "Soluciones", tagline: "Un escriba para cada situación: en consulta o por vídeo." },
    },
    cols: { platform: "Plataforma", settings: "Dónde funciona" },
    items: {
      scribe:       ["Scribe", "Escriba ambiental para las consultas"],
      dictate:      ["Dictate", "Dictado de informes con plantillas"],
      templates:    ["Plantillas", "Plantillas de informe por especialidad"],
      features:     ["Todas las funciones", "El ciclo completo de documentación"],
      inperson:     ["Consultas presenciales", "La conversación con el paciente en la consulta"],
      telehealth:   ["Telemedicina y vídeo", "Consultas a distancia en línea"],
      wardround:    ["Pase de visita y cabecera", "Notas de evolución diarias"],
      procedures:   ["Procedimientos y quirófano", "Registros de procedimientos y cirugías"],
    },
    cta: {
      product:   ["Pruébelo con sus propios informes", "Empiece gratis. Sin tarjeta ni instalación.", "Empezar gratis", "Reservar una demo"],
      solutions: ["¿No sabe qué encaja con usted?", "Se lo mostramos sobre su propio flujo de trabajo.", "Reservar una demo", "Ver las plantillas"],
    },
    flat: { pricing: "Precios", security: "Seguridad" },
  },
  pt: {
    groups: {
      product:   { label: "Produto", tagline: "Da palavra dita ao relatório assinado." },
      solutions: { label: "Soluções", tagline: "Um escriba para cada situação — na consulta ou por vídeo." },
    },
    cols: { platform: "Plataforma", settings: "Onde funciona" },
    items: {
      scribe:       ["Scribe", "Escriba ambiental para as consultas"],
      dictate:      ["Dictate", "Ditado de relatórios com modelos"],
      templates:    ["Modelos", "Modelos de relatório por especialidade"],
      features:     ["Todas as funcionalidades", "O ciclo completo de documentação"],
      inperson:     ["Consultas presenciais", "A conversa com o doente no consultório"],
      telehealth:   ["Telemedicina e vídeo", "Consultas à distância online"],
      wardround:    ["Visita e cabeceira", "Notas de evolução diárias"],
      procedures:   ["Procedimentos e bloco operatório", "Registos de procedimentos e cirurgias"],
    },
    cta: {
      product:   ["Experimente com os seus próprios relatórios", "Comece gratuitamente. Sem cartão nem instalação.", "Começar gratuitamente", "Marcar uma demonstração"],
      solutions: ["Não sabe o que se adequa a si?", "Mostramos-lhe no seu próprio fluxo de trabalho.", "Marcar uma demonstração", "Ver os modelos"],
    },
    flat: { pricing: "Preços", security: "Segurança" },
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
  ar: [
    { label: "التوثيق", path: "/docs" },
    { label: "وثائق API", path: "/developers/api" },
    { label: "للمطوّرين", path: "/developers" },
    { label: "المدونة", path: "/blog" },
  ],
  es: [
    { label: "Documentación", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Para desarrolladores", path: "/developers" },
    { label: "Blog", path: "/blog" },
  ],
  pt: [
    { label: "Documentação", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Para programadores", path: "/developers" },
    { label: "Blogue", path: "/blog" },
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
  ar: {
    tag: "إملاء طبي بالصوت. لا تغادر البيانات بيئتك أبدًا.",
    cols: [
      { h: "المنتج", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "الميزات", path: "/features" },
        { label: "القوالب", path: "/templates" },
        { label: "الأسعار", path: "/pricing" },
        { label: "الأمان", path: "/security" },
      ] },
      { h: "الموارد", links: RESOURCE_LINKS.ar },
      { h: "الشركة", links: [
        { label: "من نحن", path: "/about" },
        { label: "تواصل معنا", path: "/contact" },
        { label: "الوظائف", path: "/careers" },
      ] },
      { h: "الشؤون القانونية", links: [
        { label: "الخصوصية", path: "/legal/privacy" },
        { label: "الشروط", path: "/legal/terms" },
        { label: "معالجة البيانات", path: "/legal/data" },
        { label: "الموافقة", path: "/legal/consent" },
      ] },
    ],
    rights: "جميع الحقوق محفوظة.",
    signin: "تسجيل الدخول",
    start: "إنشاء حساب",
    nav: { product: "المنتج", features: "الميزات", workflow: "كيف يعمل", security: "الأمان" },
  },
  es: {
    tag: "Dictado médico por voz. Los datos nunca salen de su entorno.",
    cols: [
      { h: "Producto", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funciones", path: "/features" },
        { label: "Plantillas", path: "/templates" },
        { label: "Precios", path: "/pricing" },
        { label: "Seguridad", path: "/security" },
      ] },
      { h: "Recursos", links: RESOURCE_LINKS.es },
      { h: "Empresa", links: [
        { label: "Quiénes somos", path: "/about" },
        { label: "Contacto", path: "/contact" },
        { label: "Empleo", path: "/careers" },
      ] },
      { h: "Legal", links: [
        { label: "Privacidad", path: "/legal/privacy" },
        { label: "Términos", path: "/legal/terms" },
        { label: "Tratamiento de datos", path: "/legal/data" },
        { label: "Consentimiento", path: "/legal/consent" },
      ] },
    ],
    rights: "Todos los derechos reservados.",
    signin: "Iniciar sesión",
    start: "Registrarse",
    nav: { product: "Producto", features: "Funciones", workflow: "Cómo funciona", security: "Seguridad" },
  },
  pt: {
    tag: "Ditado médico por voz. Os dados nunca saem do seu ambiente.",
    cols: [
      { h: "Produto", links: [
        { label: "Scribe", path: "/product/scribe" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Funcionalidades", path: "/features" },
        { label: "Modelos", path: "/templates" },
        { label: "Preços", path: "/pricing" },
        { label: "Segurança", path: "/security" },
      ] },
      { h: "Recursos", links: RESOURCE_LINKS.pt },
      { h: "Empresa", links: [
        { label: "Sobre nós", path: "/about" },
        { label: "Contacto", path: "/contact" },
        { label: "Carreiras", path: "/careers" },
      ] },
      { h: "Informação legal", links: [
        { label: "Privacidade", path: "/legal/privacy" },
        { label: "Termos", path: "/legal/terms" },
        { label: "Tratamento de dados", path: "/legal/data" },
        { label: "Consentimento", path: "/legal/consent" },
      ] },
    ],
    rights: "Todos os direitos reservados.",
    signin: "Iniciar sessão",
    start: "Registar-se",
    nav: { product: "Produto", features: "Funcionalidades", workflow: "Como funciona", security: "Segurança" },
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

/* Generic popover listbox — a custom menu instead of a bare <select> so it
   matches the mega-menu's look; the active option is accented and checked.
   Self-contained: owns its open state plus outside-click / Escape handling,
   and closes on choose. Used for the footer's language and country pickers. */
function PopSwitcher({ ariaLabel, trigger, options, activeKey, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (key) => { onPick(key); setOpen(false); };

  return (
    <div className={`lp-lang-menu${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className="lp-lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
        <Icon name="chevDown" size={12} />
      </button>
      <div className="lp-lang-pop" role="listbox" aria-label={ariaLabel} tabIndex={-1}>
        {options.map((o) => (
          <button
            type="button"
            key={o.key}
            role="option"
            aria-selected={o.key === activeKey}
            className={`lp-lang-opt${o.key === activeKey ? " is-active" : ""}`}
            onClick={() => pick(o.key)}
          >
            {o.lead && <span className="lp-lang-opt-lead" aria-hidden="true">{o.lead}</span>}
            <span className="lp-lang-opt-label" dir={o.rtl ? "rtl" : "ltr"}>{o.label}</span>
            {o.short && <span className="lp-lang-opt-short">{o.short}</span>}
            <Icon name="check" size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* Language switcher — each language shown in its own script. */
function LangSwitcher({ lang, setTweak }) {
  const current = LANGS.find((l) => l.code === lang) || LANGS[1];
  return (
    <PopSwitcher
      ariaLabel="Language"
      activeKey={lang}
      onPick={(code) => setTweak && setTweak("lang", code)}
      trigger={<>
        <Icon name="globe" size={15} />
        <span className="lp-lang-current">{current.short}</span>
      </>}
      options={LANGS.map((l) => ({ key: l.code, label: l.label, short: l.short, rtl: l.rtl }))}
    />
  );
}

/* Country / region registry for the footer picker. Endonyms on purpose —
   like the language list, every entry is self-identifying in its own
   language, so the list needs no translation. Stored as the `country`
   tweak; until the visitor picks one, the default follows the site
   language's home market. */
const COUNTRIES = [
  { code: "ua", flag: "🇺🇦", label: "Україна" },
  { code: "pl", flag: "🇵🇱", label: "Polska" },
  { code: "de", flag: "🇩🇪", label: "Deutschland" },
  { code: "ro", flag: "🇷🇴", label: "România" },
  { code: "cz", flag: "🇨🇿", label: "Česko" },
  { code: "rs", flag: "🇷🇸", label: "Srbija" },
  { code: "hu", flag: "🇭🇺", label: "Magyarország" },
  { code: "es", flag: "🇪🇸", label: "España" },
  { code: "pt", flag: "🇵🇹", label: "Portugal" },
  { code: "int", flag: "🌐", label: "International" },
];

const COUNTRY_FOR_LANG = {
  uk: "ua", pl: "pl", de: "de", ro: "ro", cs: "cz",
  sr: "rs", hu: "hu", es: "es", pt: "pt",
};

export function defaultCountry(lang) {
  return COUNTRY_FOR_LANG[lang] || "int";
}

function CountrySwitcher({ country, setTweak }) {
  const current = COUNTRIES.find((c) => c.code === country) || COUNTRIES[COUNTRIES.length - 1];
  return (
    <PopSwitcher
      ariaLabel="Country / Region"
      activeKey={current.code}
      onPick={(code) => setTweak && setTweak("country", code)}
      trigger={<>
        <span className="lp-lang-flag" aria-hidden="true">{current.flag}</span>
        <span className="lp-lang-current">{current.label}</span>
      </>}
      options={COUNTRIES.map((c) => ({ key: c.code, label: c.label, lead: c.flag }))}
    />
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
          {/* Live service status, where a visitor expects it: the footer. Same
              probe the clinician's account menu runs, same panel behind it. */}
          <HealthBadge lang={lang} />

          {/* Language + country moved here from the navbar (popups open upward). */}
          <div className="lp-footer-pickers">
            <LangSwitcher lang={lang} setTweak={setTweak} />
            <CountrySwitcher country={tweaks?.country || defaultCountry(lang)} setTweak={setTweak} />
          </div>
          <div className="lp-footer-bar-links">
            <a href="#/login" onClick={go("/login")}>{f.signin}</a>
            <a href="#/signup" onClick={go("/signup")}>{f.start}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
