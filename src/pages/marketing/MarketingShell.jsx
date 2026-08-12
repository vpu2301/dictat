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
import { Icon } from "../../components/UI.jsx";
import { LANGS, tr } from "../../i18n.js";
import { submitLead } from "../../api/leads.js";
import { submitDemoRequest } from "../../api/demo.js";
import { rcmCountry } from "./rcm.js";
import { useMarketingMotion } from "./useMarketingMotion.js";

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
      /* The first column IS the positioning: the platform, then the three
         pillars in the order the loop runs them. A visitor who only ever
         opens this menu should still leave knowing what the category is.
         Individual capabilities stay off the menu — the /features hub covers
         them, and a menu that lists everything sells nothing. */
      { key: "loop", items: [
        { key: "platform",     icon: "shield",   path: "/platform" },
        { key: "scribe",       icon: "waveform", path: "/product/scribe" },
        { key: "evidentia",    icon: "book",     path: "/product/evidentia", soon: true },
        { key: "authorize",    icon: "sign",     path: "/product/authorize" },
        { key: "rcm",          icon: "card",     path: "/rcm", soon: true },
      ] },
      /* Dictate sits here rather than beside the pillars: report dictation is
         a capture MODE that feeds Listen, not a fourth product. */
      { key: "platform", items: [
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
      /* Countries, grouped the way a buyer thinks about them. These columns
         declare `from: "rcm"` and are filled from the registry in rcm.js
         rather than from NAV_TEXT: a country's name is already written in
         eleven languages there, and its menu description is a line of
         acronyms that must not be translated at all. Retyping either here
         would be 121 strings maintained in two places. */
      { key: "dach", from: "rcm", keys: ["de", "at", "ch"] },
      { key: "cee",  from: "rcm", keys: ["pl", "cz", "hu", "ro", "rs", "ua"] },
      { key: "gulf", from: "rcm", keys: ["ae", "sa"] },
    ],
    cta: { primary: "/contact", secondary: "/rcm" },
  },
  /* Resources and Company deliberately live in the footer, not up here: they
     are low-intent destinations, and the header stays focused on what the
     product is and whether it fits. See FOOTER's Resources / Company / Legal
     columns, which carry every one of those links. */
];

/* Top-level links that are not dropdowns.
   Validation sits first, ahead of price and even of security, and that order
   is the argument: a buyer evaluating a clinical scribe is being asked to
   trust a machine with the record, and the page that says which of our claims
   have actually been measured — and which have not — is the one they should
   reach without hunting for it. */
const NAV_FLAT = [
  { key: "validation", path: "/validation" },
  { key: "pricing",  path: "/pricing" },
  { key: "security", path: "/security" },
];

/* Badge for menu items whose page describes a direction rather than a shipped
   feature (`soon: true` above) — Evidentia and the coding/claims stack are in
   integration, and both pages already say so. The menu is where the visitor
   decides what to click, so the caveat belongs here too. Kept out of NAV_TEXT
   so one word does not have to be threaded through twelve language blocks. */
const SOON_LABEL = {
  uk: "Незабаром", en: "Soon", pl: "Wkrótce", de: "Bald", ro: "În curând",
  cs: "Brzy", sr: "Uskoro", hu: "Hamarosan", ar: "قريبًا", es: "Pronto",
  pt: "Em breve",
};

const NAV_TEXT = {
  uk: {
    groups: {
      product:   { label: "Продукт", tagline: "Від сказаного слова до підписаного звіту." },
      solutions: { label: "Рішення", tagline: "Скрайб для будь-якого прийому — і кодування за правилами вашої країни." },
    },
    cols: { loop: "Замкнений цикл", platform: "Платформа", settings: "Де це працює", dach: "Німецькомовні країни", cee: "Центральна та Східна Європа", gulf: "Затока" },
    items: {
      platform:     ["Платформа", "Слухає → перевіряє → засвідчує"],
      scribe:       ["Scribe", "Амбулаторний скрайб для прийомів"],
      dictate:      ["Dictate", "Диктування звітів — режим захоплення"],
      evidentia:    ["Evidentia", "Локалізовані докази до нотатки"],
      authorize:    ["Signing", "Кваліфікований підпис і перевірка"],
      templates:    ["Шаблони", "Медичні шаблони за спеціальностями"],
      features:     ["Усі можливості", "Повний цикл документації"],
      inperson:     ["Очні прийоми", "Розмова з пацієнтом у кабінеті"],
      telehealth:   ["Телемедицина та відео", "Дистанційні консультації онлайн"],
      wardround:    ["Обхід і біля ліжка", "Щоденні записи в стаціонарі"],
      procedures:   ["Процедури та операційна", "Протоколи втручань і операцій"],
      rcm:          ["Кодування та рахунки", "Коди й файл рахунку для вашої країни"],
    },
    cta: {
      product:   ["Спробуйте на власних нотатках", "Безкоштовний старт. Без картки та встановлення.", "Почати безкоштовно", "Замовити демо"],
      solutions: ["Не впевнені, що підійде саме вам?", "Покажемо на вашому робочому процесі.", "Замовити демо", "Усі країни"],
    },
    flat: { validation: "Валідація", pricing: "Тарифи", security: "Безпека" },
  },
  en: {
    groups: {
      product:   { label: "Product", tagline: "From the spoken word to a signed report." },
      solutions: { label: "Solutions", tagline: "One scribe for every setting — and coding under your country's own rules." },
    },
    cols: { loop: "The closed loop", platform: "Platform", settings: "Where it works", dach: "German-speaking", cee: "Central and Eastern Europe", gulf: "The Gulf" },
    items: {
      platform:     ["The platform", "Listen → Verify → Authorize"],
      scribe:       ["Scribe", "Ambient scribe for encounters"],
      dictate:      ["Dictate", "Report dictation — a capture mode"],
      evidentia:    ["Evidentia", "Localized evidence for the note"],
      authorize:    ["Signing", "Qualified signature and verification"],
      templates:    ["Templates", "Note templates by specialty"],
      features:     ["All features", "The full documentation cycle"],
      inperson:     ["In-person visits", "The patient conversation in the room"],
      telehealth:   ["Telehealth & video", "Remote consultations online"],
      wardround:    ["Ward round & bedside", "Daily inpatient progress notes"],
      procedures:   ["Procedures & theatre", "Procedure and operative records"],
      rcm:          ["Coding and claims", "Codes and a claim file for your country"],
    },
    cta: {
      product:   ["Try it on your own notes", "Free to start. No card, no install.", "Start free", "Book a demo"],
      solutions: ["Not sure where Klarnote fits?", "We'll walk you through your workflow.", "Book a demo", "All countries"],
    },
    flat: { validation: "Validation", pricing: "Pricing", security: "Security" },
  },
  pl: {
    groups: {
      product:   { label: "Produkt", tagline: "Od wypowiedzianego słowa do podpisanego raportu." },
      solutions: { label: "Rozwiązania", tagline: "Jeden skryba do każdej sytuacji — i kodowanie według zasad Twojego kraju." },
    },
    cols: { loop: "Zamknięta pętla", platform: "Platforma", settings: "Gdzie działa", dach: "Kraje niemieckojęzyczne", cee: "Europa Środkowo-Wschodnia", gulf: "Zatoka Perska" },
    items: {
      platform:     ["Platforma", "Słucha → weryfikuje → poświadcza"],
      scribe:       ["Scribe", "Ambientowy skryba do wizyt"],
      dictate:      ["Dictate", "Dyktowanie raportów — tryb przechwytywania"],
      evidentia:    ["Evidentia", "Zlokalizowane dowody do notatki"],
      authorize:    ["Signing", "Kwalifikowany podpis i weryfikacja"],
      templates:    ["Szablony", "Szablony notatek według specjalności"],
      features:     ["Wszystkie funkcje", "Pełny cykl dokumentacji"],
      inperson:     ["Wizyty osobiste", "Rozmowa z pacjentem w gabinecie"],
      telehealth:   ["Telemedycyna i wideo", "Konsultacje zdalne online"],
      wardround:    ["Obchód i przy łóżku", "Codzienne wpisy szpitalne"],
      procedures:   ["Zabiegi i blok operacyjny", "Protokoły zabiegów i operacji"],
      rcm:          ["Kodowanie i rozliczenia", "Kody i plik rozliczeniowy dla Twojego kraju"],
    },
    cta: {
      product:   ["Wypróbuj na własnych notatkach", "Darmowy start. Bez karty i instalacji.", "Zacznij za darmo", "Umów demo"],
      solutions: ["Nie wiesz, co pasuje do Ciebie?", "Pokażemy to na Twoim procesie pracy.", "Umów demo", "Wszystkie kraje"],
    },
    flat: { validation: "Walidacja", pricing: "Cennik", security: "Bezpieczeństwo" },
  },
  de: {
    groups: {
      product:   { label: "Produkt", tagline: "Vom gesprochenen Wort zum signierten Befund." },
      solutions: { label: "Lösungen", tagline: "Ein Scribe für jede Situation — und Kodierung nach den Regeln Ihres Landes." },
    },
    cols: { loop: "Der geschlossene Kreis", platform: "Plattform", settings: "Wo es funktioniert", dach: "DACH", cee: "Mittel- und Osteuropa", gulf: "Golfregion" },
    items: {
      platform:     ["Die Plattform", "Zuhören → Prüfen → Signieren"],
      scribe:       ["Scribe", "Ambienter Scribe für Konsultationen"],
      dictate:      ["Dictate", "Befunddiktat — ein Erfassungsmodus"],
      evidentia:    ["Evidentia", "Lokalisierte Evidenz zur Notiz"],
      authorize:    ["Signing", "Qualifizierte Signatur und Prüfung"],
      templates:    ["Vorlagen", "Befundvorlagen nach Fachrichtung"],
      features:     ["Alle Funktionen", "Der komplette Dokumentationszyklus"],
      inperson:     ["Präsenztermine", "Das Patientengespräch vor Ort"],
      telehealth:   ["Telemedizin & Video", "Fernkonsultationen online"],
      wardround:    ["Visite & am Krankenbett", "Tägliche Verlaufsnotizen"],
      procedures:   ["Eingriffe & OP", "Eingriffs- und OP-Berichte"],
      rcm:          ["Kodierung und Abrechnung", "Kodes und Abrechnungsdatei für Ihr Land"],
    },
    cta: {
      product:   ["Testen Sie es mit Ihren eigenen Befunden", "Kostenlos starten. Ohne Karte, ohne Installation.", "Kostenlos starten", "Demo buchen"],
      solutions: ["Unsicher, was zu Ihnen passt?", "Wir zeigen es an Ihrem Arbeitsablauf.", "Demo buchen", "Alle Länder"],
    },
    flat: { validation: "Validierung", pricing: "Preise", security: "Sicherheit" },
  },
  ro: {
    groups: {
      product:   { label: "Produs", tagline: "De la cuvântul rostit la raportul semnat." },
      solutions: { label: "Soluții", tagline: "Un scrib pentru orice context — și codificare după regulile țării dumneavoastră." },
    },
    cols: { loop: "Bucla închisă", platform: "Platformă", settings: "Unde funcționează", dach: "Spațiul germanofon", cee: "Europa Centrală și de Est", gulf: "Golful Persic" },
    items: {
      platform:     ["Platforma", "Ascultă → verifică → semnează"],
      scribe:       ["Scribe", "Scrib ambiental pentru consultații"],
      dictate:      ["Dictate", "Dictarea rapoartelor — un mod de captare"],
      evidentia:    ["Evidentia", "Dovezi localizate pentru notă"],
      authorize:    ["Signing", "Semnătură calificată și verificare"],
      templates:    ["Șabloane", "Șabloane de note pe specialități"],
      features:     ["Toate funcționalitățile", "Ciclul complet de documentare"],
      inperson:     ["Consultații în cabinet", "Conversația cu pacientul la fața locului"],
      telehealth:   ["Telemedicină și video", "Consultații la distanță online"],
      wardround:    ["Vizită și la patul bolnavului", "Note zilnice de evoluție"],
      procedures:   ["Proceduri și sală de operație", "Protocoale de procedură și operatorii"],
      rcm:          ["Codificare și decontare", "Coduri și fișier pentru țara dumneavoastră"],
    },
    cta: {
      product:   ["Încercați pe propriile note", "Start gratuit. Fără card, fără instalare.", "Începeți gratuit", "Programați o demonstrație"],
      solutions: ["Nu știți ce vi se potrivește?", "Vă arătăm pe fluxul dumneavoastră de lucru.", "Programați o demonstrație", "Toate țările"],
    },
    flat: { validation: "Validare", pricing: "Prețuri", security: "Securitate" },
  },
  cs: {
    groups: {
      product:   { label: "Produkt", tagline: "Od vysloveného slova k podepsané zprávě." },
      solutions: { label: "Řešení", tagline: "Jeden zapisovatel pro každou situaci — a kódování podle pravidel vaší země." },
    },
    cols: { loop: "Uzavřená smyčka", platform: "Platforma", settings: "Kde to funguje", dach: "Německy mluvící země", cee: "Střední a východní Evropa", gulf: "Perský záliv" },
    items: {
      platform:     ["Platforma", "Naslouchá → ověřuje → stvrzuje"],
      scribe:       ["Scribe", "Ambientní skrib pro návštěvy"],
      dictate:      ["Dictate", "Diktování zpráv — režim záznamu"],
      evidentia:    ["Evidentia", "Lokalizované důkazy k poznámce"],
      authorize:    ["Signing", "Kvalifikovaný podpis a ověření"],
      templates:    ["Šablony", "Šablony nálezů podle oboru"],
      features:     ["Všechny funkce", "Kompletní cyklus dokumentace"],
      inperson:     ["Osobní návštěvy", "Rozhovor s pacientem v ordinaci"],
      telehealth:   ["Telemedicína a video", "Vzdálené konzultace online"],
      wardround:    ["Vizita a u lůžka", "Denní záznamy o průběhu"],
      procedures:   ["Výkony a operační sál", "Zápisy výkonů a operací"],
      rcm:          ["Kódování a vyúčtování", "Kódy a dávka pro vaši zemi"],
    },
    cta: {
      product:   ["Vyzkoušejte na vlastních nálezech", "Start zdarma. Bez karty a instalace.", "Začít zdarma", "Domluvit demo"],
      solutions: ["Nevíte, co se k vám hodí?", "Ukážeme to na vašem pracovním postupu.", "Domluvit demo", "Všechny země"],
    },
    flat: { validation: "Validace", pricing: "Ceník", security: "Zabezpečení" },
  },
  sr: {
    groups: {
      product:   { label: "Proizvod", tagline: "Od izgovorene reči do potpisanog izveštaja." },
      solutions: { label: "Rešenja", tagline: "Jedan skrajb za svaku situaciju — i kodiranje po pravilima vaše zemlje." },
    },
    cols: { loop: "Zatvorena petlja", platform: "Platforma", settings: "Gde funkcioniše", dach: "Nemačko govorno područje", cee: "Centralna i istočna Evropa", gulf: "Zaliv" },
    items: {
      platform:     ["Platforma", "Sluša → proverava → overava"],
      scribe:       ["Scribe", "Ambijentalni skrajb za preglede"],
      dictate:      ["Dictate", "Diktiranje izveštaja — režim snimanja"],
      evidentia:    ["Evidentia", "Lokalizovani dokazi uz belešku"],
      authorize:    ["Signing", "Kvalifikovani potpis i provera"],
      templates:    ["Šabloni", "Šabloni nalaza po specijalnosti"],
      features:     ["Sve funkcije", "Kompletan ciklus dokumentacije"],
      inperson:     ["Pregledi uživo", "Razgovor sa pacijentom u ordinaciji"],
      telehealth:   ["Telemedicina i video", "Konsultacije na daljinu onlajn"],
      wardround:    ["Vizita i uz krevet", "Dnevne beleške o toku lečenja"],
      procedures:   ["Procedure i operaciona sala", "Zapisi procedura i operacija"],
      rcm:          ["Kodiranje i fakturisanje", "Šifre i faktura za vašu zemlju"],
    },
    cta: {
      product:   ["Isprobajte na sopstvenim nalazima", "Besplatan početak. Bez kartice i instalacije.", "Počnite besplatno", "Zakažite demo"],
      solutions: ["Niste sigurni šta vam odgovara?", "Pokazaćemo na vašem toku rada.", "Zakažite demo", "Sve zemlje"],
    },
    flat: { validation: "Validacija", pricing: "Cene", security: "Bezbednost" },
  },
  hu: {
    groups: {
      product:   { label: "Termék", tagline: "A kimondott szótól az aláírt leletig." },
      solutions: { label: "Megoldások", tagline: "Egy írnok minden helyzetre — és kódolás az Ön országának szabályai szerint." },
    },
    cols: { loop: "A zárt hurok", platform: "Platform", settings: "Hol működik", dach: "Német nyelvterület", cee: "Közép- és Kelet-Európa", gulf: "Öböl-térség" },
    items: {
      platform:     ["A platform", "Hallgat → ellenőriz → hitelesít"],
      scribe:       ["Scribe", "Ambientális jegyzetelő vizitekhez"],
      dictate:      ["Dictate", "Leletdiktálás — rögzítési mód"],
      evidentia:    ["Evidentia", "Lokalizált bizonyíték a jegyzethez"],
      authorize:    ["Signing", "Minősített aláírás és ellenőrzés"],
      templates:    ["Sablonok", "Leletsablonok szakterületenként"],
      features:     ["Összes funkció", "A teljes dokumentációs ciklus"],
      inperson:     ["Személyes vizitek", "A beteggel folytatott beszélgetés a rendelőben"],
      telehealth:   ["Telemedicina és videó", "Távkonzultációk online"],
      wardround:    ["Vizit és betegágy mellett", "Napi kórlefolyás-jegyzetek"],
      procedures:   ["Beavatkozások és műtő", "Beavatkozási és műtéti leírások"],
      rcm:          ["Kódolás és elszámolás", "Kódok és állomány az Ön országához"],
    },
    cta: {
      product:   ["Próbálja ki saját leletein", "Ingyenes kezdés. Kártya és telepítés nélkül.", "Kezdés ingyen", "Demó foglalása"],
      solutions: ["Nem biztos benne, mi illik Önhöz?", "Megmutatjuk a saját munkafolyamatán.", "Demó foglalása", "Minden ország"],
    },
    flat: { validation: "Validáció", pricing: "Árak", security: "Biztonság" },
  },
  ar: {
    groups: {
      product:   { label: "المنتج", tagline: "من الكلمة المنطوقة إلى تقرير موقّع." },
      solutions: { label: "الحلول", tagline: "كاتب واحد لكل موقف — وترميز وفق قواعد بلدك." },
    },
    cols: { loop: "الحلقة المغلقة", platform: "المنصة", settings: "أين تعمل", dach: "الدول الناطقة بالألمانية", cee: "أوروبا الوسطى والشرقية", gulf: "الخليج" },
    items: {
      platform:     ["المنصة", "يستمع ← يتحقّق ← يوثّق"],
      scribe:       ["Scribe", "كاتب محيطي للمقابلات"],
      dictate:      ["Dictate", "إملاء التقارير — وضع التقاط"],
      evidentia:    ["Evidentia", "أدلة محلية للملاحظة"],
      authorize:    ["Signing", "توقيع مؤهل وتحقق"],
      templates:    ["القوالب", "قوالب الملاحظات حسب التخصص"],
      features:     ["جميع الميزات", "دورة التوثيق الكاملة"],
      inperson:     ["الزيارات الحضورية", "محادثة المريض داخل الغرفة"],
      telehealth:   ["الطب عن بُعد والفيديو", "استشارات عن بُعد عبر الإنترنت"],
      wardround:    ["الجولة الطبية وبجانب السرير", "ملاحظات التقدم اليومية للمرضى الداخليين"],
      procedures:   ["الإجراءات وغرفة العمليات", "سجلات الإجراءات والعمليات"],
      rcm:          ["الترميز والمطالبات", "رموز وملف مطالبة لبلدك"],
    },
    cta: {
      product:   ["جرّبه على ملاحظاتك الخاصة", "ابدأ مجانًا. بدون بطاقة، بدون تثبيت.", "ابدأ مجانًا", "احجز عرضًا توضيحيًا"],
      solutions: ["غير متأكد أين يناسبك Klarnote؟", "سنرشدك عبر سير عملك.", "احجز عرضًا توضيحيًا", "كل البلدان"],
    },
    flat: { validation: "التحقق", pricing: "الأسعار", security: "الأمان" },
  },
  es: {
    groups: {
      product:   { label: "Producto", tagline: "De la palabra dicha al informe firmado." },
      solutions: { label: "Soluciones", tagline: "Un escriba para cada situación: en consulta, por vídeo y con la codificación de su país." },
    },
    cols: { loop: "El ciclo cerrado", platform: "Plataforma", settings: "Dónde funciona", dach: "Países germanófonos", cee: "Europa Central y del Este", gulf: "El Golfo" },
    items: {
      platform:     ["La plataforma", "Escucha → verifica → autoriza"],
      scribe:       ["Scribe", "Escriba ambiental para las consultas"],
      dictate:      ["Dictate", "Dictado de informes — un modo de captura"],
      evidentia:    ["Evidentia", "Evidencia localizada para la nota"],
      authorize:    ["Signing", "Firma cualificada y verificación"],
      templates:    ["Plantillas", "Plantillas de informe por especialidad"],
      features:     ["Todas las funciones", "El ciclo completo de documentación"],
      inperson:     ["Consultas presenciales", "La conversación con el paciente en la consulta"],
      telehealth:   ["Telemedicina y vídeo", "Consultas a distancia en línea"],
      wardround:    ["Pase de visita y cabecera", "Notas de evolución diarias"],
      procedures:   ["Procedimientos y quirófano", "Registros de procedimientos y cirugías"],
      rcm:          ["Codificación y facturación", "Códigos y fichero para su país"],
    },
    cta: {
      product:   ["Pruébelo con sus propios informes", "Empiece gratis. Sin tarjeta ni instalación.", "Empezar gratis", "Reservar una demo"],
      solutions: ["¿No sabe qué encaja con usted?", "Se lo mostramos sobre su propio flujo de trabajo.", "Reservar una demo", "Todos los países"],
    },
    flat: { validation: "Validación", pricing: "Precios", security: "Seguridad" },
  },
  pt: {
    groups: {
      product:   { label: "Produto", tagline: "Da palavra dita ao relatório assinado." },
      solutions: { label: "Soluções", tagline: "Um escriba para cada situação — e codificação segundo as regras do seu país." },
    },
    cols: { loop: "O ciclo fechado", platform: "Plataforma", settings: "Onde funciona", dach: "Países germanófonos", cee: "Europa Central e de Leste", gulf: "O Golfo" },
    items: {
      platform:     ["A plataforma", "Ouve → verifica → autoriza"],
      scribe:       ["Scribe", "Escriba ambiental para as consultas"],
      dictate:      ["Dictate", "Ditado de relatórios — um modo de captação"],
      evidentia:    ["Evidentia", "Evidência localizada para a nota"],
      authorize:    ["Signing", "Assinatura qualificada e verificação"],
      templates:    ["Modelos", "Modelos de relatório por especialidade"],
      features:     ["Todas as funcionalidades", "O ciclo completo de documentação"],
      inperson:     ["Consultas presenciais", "A conversa com o doente no consultório"],
      telehealth:   ["Telemedicina e vídeo", "Consultas à distância online"],
      wardround:    ["Visita e cabeceira", "Notas de evolução diárias"],
      procedures:   ["Procedimentos e bloco operatório", "Registos de procedimentos e cirurgias"],
      rcm:          ["Codificação e faturação", "Códigos e ficheiro para o seu país"],
    },
    cta: {
      product:   ["Experimente com os seus próprios relatórios", "Comece gratuitamente. Sem cartão nem instalação.", "Começar gratuitamente", "Marcar uma demonstração"],
      solutions: ["Não sabe o que se adequa a si?", "Mostramos-lhe no seu próprio fluxo de trabalho.", "Marcar uma demonstração", "Todos os países"],
    },
    flat: { validation: "Validação", pricing: "Preços", security: "Segurança" },
  },
  lt: {
    groups: {
      product:   { label: "Produktas", tagline: "Nuo ištarto žodžio iki pasirašyto protokolo." },
      solutions: { label: "Sprendimai", tagline: "Vienas asistentas visoms situacijoms — ir kodavimas pagal jūsų šalies taisykles." },
    },
    cols: { loop: "Uždaras ciklas", platform: "Platforma", settings: "Kur tai veikia", dach: "Vokiškai kalbančios šalys", cee: "Vidurio ir Rytų Europa", gulf: "Persijos įlanka" },
    items: {
      platform:     ["Platforma", "Klauso → tikrina → patvirtina"],
      scribe:       ["Scribe", "Aplinkos asistentas vizitams"],
      dictate:      ["Dictate", "Protokolų diktavimas — fiksavimo režimas"],
      evidentia:    ["Evidentia", "Lokalizuoti įrodymai įrašui"],
      authorize:    ["Signing", "Kvalifikuotas parašas ir patikra"],
      templates:    ["Šablonai", "Įrašų šablonai pagal specialybę"],
      features:     ["Visos galimybės", "Visas dokumentavimo ciklas"],
      inperson:     ["Vizitai kabinete", "Pokalbis su pacientu kabinete"],
      telehealth:   ["Nuotolinės konsultacijos", "Nuotoliniai vizitai internetu"],
      wardround:    ["Vizitacija prie lovos", "Kasdieniai stacionaro eigos įrašai"],
      procedures:   ["Procedūros ir operacinė", "Procedūrų ir operacijų protokolai"],
      rcm:          ["Kodavimas ir sąskaitos", "Kodai ir sąskaitos failas jūsų šaliai"],
    },
    cta: {
      product:   ["Išbandykite su savo įrašais", "Pradėti nemokama. Be kortelės ir be diegimo.", "Pradėti nemokamai", "Užsisakyti demonstraciją"],
      solutions: ["Nesate tikri, kas jums tinka?", "Parodysime jūsų pačių darbo sraute.", "Užsisakyti demonstraciją", "Visos šalys"],
    },
    flat: { validation: "Validavimas", pricing: "Kainos", security: "Sauga" },
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
          items: c.from === "rcm"
            ? c.keys.map((k) => {
                const country = rcmCountry(k, lang);
                return { icon: "globe", path: country.path, label: country.label, desc: country.short };
              })
            : c.items.map((it) => ({
                icon: it.icon, path: it.path,
                label: item(it.key)[0], desc: item(it.key)[1],
                soon: it.soon ? (SOON_LABEL[lang] || SOON_LABEL.en) : null,
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
  lt: [
    { label: "Dokumentacija", path: "/docs" },
    { label: "API Docs", path: "/developers/api" },
    { label: "Kūrėjams", path: "/developers" },
    { label: "Tinklaraštis", path: "/blog" },
  ],
};

/* The footer map is shared with the landing page so the columns stay in sync.
   Each link carries a real route (no jump-to-section stubs). */
export const FOOTER = {
  uk: {
    tag: "Суверенна платформа амбієнтної довіри. Дані не залишають вашого розгортання.",
    cols: [
      { h: "Продукт", links: [
        { label: "Платформа", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Кодування та рахунки", path: "/rcm" },
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
    tag: "Sovereign Ambient Trust Platform. Data never leaves your deployment.",
    cols: [
      { h: "Product", links: [
        { label: "Platform", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Coding and claims", path: "/rcm" },
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
    tag: "Suwerenna platforma zaufania ambientowego. Dane nigdy nie opuszczają Twojego wdrożenia.",
    cols: [
      { h: "Produkt", links: [
        { label: "Platforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kodowanie i rozliczenia", path: "/rcm" },
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
    tag: "Souveräne Ambient-Trust-Plattform. Daten verlassen niemals Ihre Umgebung.",
    cols: [
      { h: "Produkt", links: [
        { label: "Plattform", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kodierung und Abrechnung", path: "/rcm" },
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
    tag: "Platformă suverană de încredere ambientală. Datele nu părăsesc niciodată infrastructura dumneavoastră.",
    cols: [
      { h: "Produs", links: [
        { label: "Platforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Codificare și decontare", path: "/rcm" },
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
    tag: "Suverénní platforma ambientní důvěry. Data nikdy neopustí vaše nasazení.",
    cols: [
      { h: "Produkt", links: [
        { label: "Platforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kódování a vyúčtování", path: "/rcm" },
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
    tag: "Suverena platforma ambijentalnog poverenja. Podaci nikada ne napuštaju vaše okruženje.",
    cols: [
      { h: "Proizvod", links: [
        { label: "Platforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kodiranje i fakturisanje", path: "/rcm" },
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
    tag: "Szuverén ambiens bizalmi platform. Az adatok soha nem hagyják el az Ön környezetét.",
    cols: [
      { h: "Termék", links: [
        { label: "Platform", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kódolás és elszámolás", path: "/rcm" },
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
    tag: "منصة الثقة المحيطية السيادية. لا تغادر البيانات بيئتك أبدًا.",
    cols: [
      { h: "المنتج", links: [
        { label: "المنصة", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "الترميز والمطالبات", path: "/rcm" },
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
    tag: "Plataforma soberana de confianza ambiental. Los datos nunca salen de su entorno.",
    cols: [
      { h: "Producto", links: [
        { label: "Plataforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Codificación y facturación", path: "/rcm" },
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
    tag: "Plataforma soberana de confiança ambiental. Os dados nunca saem do seu ambiente.",
    cols: [
      { h: "Produto", links: [
        { label: "Plataforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Codificação e faturação", path: "/rcm" },
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
  lt: {
    tag: "Suvereni aplinkos pasitikėjimo platforma. Duomenys niekada nepalieka jūsų aplinkos.",
    cols: [
      { h: "Produktas", links: [
        { label: "Platforma", path: "/platform" },
        { label: "Scribe", path: "/product/scribe" },
        { label: "Evidentia", path: "/product/evidentia" },
        { label: "Signing", path: "/product/authorize" },
        { label: "Kodavimas ir sąskaitos", path: "/rcm" },
        { label: "Dictate", path: "/product/dictate" },
        { label: "Galimybės", path: "/features" },
        { label: "Šablonai", path: "/templates" },
        { label: "Kainos", path: "/pricing" },
        { label: "Sauga", path: "/security" },
      ] },
      { h: "Ištekliai", links: RESOURCE_LINKS.lt },
      { h: "Įmonė", links: [
        { label: "Apie mus", path: "/about" },
        { label: "Kontaktai", path: "/contact" },
        { label: "Karjera", path: "/careers" },
      ] },
      { h: "Teisinė informacija", links: [
        { label: "Privatumas", path: "/legal/privacy" },
        { label: "Naudojimo sąlygos", path: "/legal/terms" },
        { label: "Duomenų tvarkymas", path: "/legal/data" },
        { label: "Sutikimas", path: "/legal/consent" },
      ] },
    ],
    rights: "Visos teisės saugomos.",
    signin: "Prisijungti",
    start: "Registruotis",
    nav: { product: "Produktas", features: "Galimybės", workflow: "Kaip tai veikia", security: "Sauga" },
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
          group can gain or lose a column without touching the CSS. Past three
          columns the panel would run off a 1280px desktop, so the columns get
          narrower instead of the panel getting wider — Solutions carries four
          since the country lists arrived, and their descriptions are short
          strings of acronyms that read fine at the tighter width. */}
      <div
        className={`lp-megamenu${group.cols.length > 3 ? " is-wide" : ""}`}
        style={{ "--mega-cols": group.cols.length, "--mega-colw": group.cols.length > 3 ? "252px" : "340px" }}
        role="menu"
      >
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
                    <span className="lp-megaitem-label">
                      {it.label}
                      {it.soon && <span className="lp-megaitem-soon">{it.soon}</span>}
                    </span>
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
   language's home market.

   NO FLAGS. They were emoji, and emoji flags are a poor fit here for
   reasons that compound: they render as two-letter boxes on Windows, they
   are the one glyph in the row whose size and baseline the font does not
   control, and a flag names a state while these entries name a MARKET —
   "International" never had one to show, so the row was inconsistent from
   the start. The endonym already identifies the entry. */
const COUNTRIES = [
  { code: "ua", label: "Україна" },
  { code: "pl", label: "Polska" },
  { code: "de", label: "Deutschland" },
  { code: "ro", label: "România" },
  { code: "cz", label: "Česko" },
  { code: "rs", label: "Srbija" },
  { code: "hu", label: "Magyarország" },
  { code: "lt", label: "Lietuva" },
  { code: "es", label: "España" },
  { code: "pt", label: "Portugal" },
  { code: "int", label: "International" },
];

const COUNTRY_FOR_LANG = {
  uk: "ua", pl: "pl", de: "de", ro: "ro", cs: "cz",
  sr: "rs", hu: "hu", lt: "lt", es: "es", pt: "pt",
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
        <Icon name="globe" size={15} />
        <span className="lp-lang-current">{current.label}</span>
      </>}
      options={COUNTRIES.map((c) => ({ key: c.code, label: c.label }))}
    />
  );
}

// ── Accent switch ─────────────────────────────────────────────────────────
// The site's two colour accents (gradient CTA, hero wash) hang off one flag,
// so the monochrome version is always one step away: load `/?accent=off` once
// and the browser remembers, `/?accent=on` brings it back, and
// `tweaks.lpAccent` outranks both. The flag drives the
// `.lp[data-accent="on"]` block at the bottom of app-extra.css.
//
// The switch reads the *search* string, not the hash: the router matches on
// the whole hash route, so `#/welcome?accent=off` would be a 404.
const ACCENT_KEY = "lp.accent";

export function readAccent(tweaks) {
  if (tweaks && tweaks.lpAccent) return tweaks.lpAccent === "off" ? "off" : "on";
  try {
    const m = /[?&]accent=(on|off)/.exec(window.location.search || "");
    if (m) { localStorage.setItem(ACCENT_KEY, m[1]); return m[1]; }
    return localStorage.getItem(ACCENT_KEY) === "off" ? "off" : "on";
  } catch (e) {
    return "on";   // private mode / no storage — show the designed look
  }
}

/* Newsletter subscribe — in the footer, on every marketing page.
 *
 * WHY HERE. The footer's first column held a logo and one line of tagline and
 * then ~200px of nothing, on every page; and a newsletter belongs where a
 * reader lands when they have finished reading rather than in a banner that
 * interrupts them on arrival. No modal, no scroll-triggered overlay: this is a
 * medical product and the front page is read by clinicians at work.
 *
 * It sends down the same pathway the contact form and the demo request use
 * (SignupFlow.finish): marketing-service confirms by email in the reader's own
 * language, HubSpot keeps the address with its consent artefact. Neither can
 * delay or fail the other, and neither throws.
 *
 * NOT double opt-in yet. The confirmation says "you're subscribed" rather than
 * "click to confirm", which is the honest description of what happens: the
 * address is on the list the moment it is submitted. Once there is a newsletter
 * actually going out, a subscribers table with a confirm token is the right
 * shape — see infra/postgres/migrations/0079's note.
 */
const SUBSCRIBE = {
  h:      { uk: "Щомісячний лист", en: "The monthly note", pl: "Miesięczny newsletter", de: "Der Monatsbrief", ro: "Buletinul lunar", cs: "Měsíční newsletter", sr: "Mesečni bilten", hu: "A havi levél", ar: "الرسالة الشهرية", es: "La nota mensual", pt: "A nota mensal", lt: "Mėnesinis laiškas" },
  sub:    { uk: "Що вийшло нового й чого ми навчилися. Раз на місяць.", en: "What shipped and what we learned. Once a month.", pl: "Co nowego i czego się nauczyliśmy. Raz w miesiącu.", de: "Was neu ist und was wir gelernt haben. Einmal im Monat.", ro: "Ce e nou și ce am învățat. O dată pe lună.", cs: "Co je nového a co jsme se naučili. Raz za měsíc.", sr: "Šta je novo i šta smo naučili. Jednom mesečno.", hu: "Mi újult meg és mit tanultunk. Havonta egyszer.", ar: "ما الجديد وما تعلّمناه. مرة كل شهر.", es: "Qué hay de nuevo y qué aprendimos. Una vez al mes.", pt: "O que é novo e o que aprendemos. Uma vez por mês.", lt: "Kas nauja ir ko išmokome. Kartą per mėnesį." },
  ph:     { uk: "you@clinic.com", en: "you@clinic.com", pl: "you@clinic.com", de: "you@clinic.com", ro: "you@clinic.com", cs: "you@clinic.com", sr: "you@clinic.com", hu: "you@clinic.com", ar: "you@clinic.com", es: "you@clinic.com", pt: "you@clinic.com", lt: "you@clinic.com" },
  cta:    { uk: "Підписатися", en: "Subscribe", pl: "Zapisz się", de: "Abonnieren", ro: "Abonare", cs: "Odebírat", sr: "Pretplati se", hu: "Feliratkozás", ar: "اشترك", es: "Suscribirse", pt: "Subscrever", lt: "Prenumeruoti" },
  bad:    { uk: "Невірна пошта.", en: "Enter a valid email.", pl: "Podaj poprawny adres.", de: "Gültige Adresse eingeben.", ro: "Introduceți un e-mail valid.", cs: "Zadejte platný e-mail.", sr: "Unesite ispravnu e-adresu.", hu: "Adjon meg érvényes címet.", ar: "أدخل بريدًا صالحًا.", es: "Introduzca un correo válido.", pt: "Indique um e-mail válido.", lt: "Įveskite tinkamą el. paštą." },
  done:   { uk: "Готово — лист із підтвердженням уже в дорозі.", en: "Done — a confirmation is on its way.", pl: "Gotowe — potwierdzenie jest w drodze.", de: "Fertig — die Bestätigung ist unterwegs.", ro: "Gata — confirmarea este pe drum.", cs: "Hotovo — potvrzení je na cestě.", sr: "Gotovo — potvrda je na putu.", hu: "Kész — a visszaigazolás úton van.", ar: "تم — رسالة التأكيد في الطريق.", es: "Listo: la confirmación va en camino.", pt: "Pronto — a confirmação está a caminho.", lt: "Atlikta — patvirtinimas jau pakeliui." },
  note:   { uk: "Одна відписка — і все. Ми не передаємо адресу нікому.", en: "One click unsubscribes. We never pass your address on.", pl: "Jedno kliknięcie wypisuje. Nie przekazujemy adresu nikomu.", de: "Ein Klick zum Abmelden. Wir geben Ihre Adresse nicht weiter.", ro: "Un clic vă dezabonează. Nu transmitem adresa nimănui.", cs: "Jedno kliknutí a odhlásíte se. Adresu nikomu nepředáváme.", sr: "Jedan klik i odjavljeni ste. Adresu ne dajemo nikome.", hu: "Egy klikk a leiratkozás. Címét nem adjuk ki senkinek.", ar: "نقرة واحدة لإلغاء الاشتراك. لا نشارك عنوانك مع أحد.", es: "Un clic para darse de baja. Nunca cedemos su dirección.", pt: "Um clique cancela. Nunca cedemos o seu endereço.", lt: "Vienas paspaudimas — ir atsisakote. Adreso niekam neperduodame." },
  consent:{ uk: "Підписуючись, ви погоджуєтеся отримувати щомісячний лист і на обробку адреси для цього — див. Політику приватності.", en: "By subscribing you agree to receive the monthly note and to us processing your address for it — see the Privacy Policy.", pl: "Zapisując się, zgadzasz się na otrzymywanie miesięcznego newslettera i przetwarzanie adresu w tym celu — zobacz Politykę prywatności.", de: "Mit dem Abonnieren stimmen Sie dem Empfang des Monatsbriefs und der Verarbeitung Ihrer Adresse dafür zu — siehe Datenschutzerklärung.", ro: "Prin abonare acceptați să primiți buletinul lunar și prelucrarea adresei în acest scop — vedeți Politica de confidențialitate.", cs: "Odebíráním souhlasíte se zasíláním měsíčního newsletteru a se zpracováním adresy k tomuto účelu — viz Zásady ochrany osobních údajů.", sr: "Pretplatom prihvatate da primate mesečni bilten i obradu adrese u tu svrhu — vidite Politiku privatnosti.", hu: "A feliratkozással hozzájárul a havi levél fogadásához és címének e célú kezeléséhez — lásd az Adatvédelmi szabályzatot.", ar: "بالاشتراك توافق على استلام الرسالة الشهرية وعلى معالجة عنوانك لهذا الغرض — راجع سياسة الخصوصية.", es: "Al suscribirse acepta recibir la nota mensual y que tratemos su dirección para ello — consulte la Política de privacidad.", pt: "Ao subscrever aceita receber a nota mensal e que tratemos o seu endereço para esse fim — consulte a Política de Privacidade.", lt: "Prenumeruodami sutinkate gauti mėnesinį laišką ir kad jūsų adresą tvarkytume šiam tikslui — žr. Privatumo politiką." },
};

function FooterSubscribe({ lang }) {
  const L = (m) => m[lang] ?? m.en;
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState("idle");   // idle | bad | done

  const submit = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setState("bad"); return; }
    // Thanked immediately: neither call can fail in a way the reader could act
    // on, and a spinner on a footer field is a cost with no benefit.
    setState("done");
    const pageUri = typeof window !== "undefined" ? window.location.href : "";
    Promise.all([
      submitLead({ email: value, consent: true },
        { consentText: L(SUBSCRIBE.consent), pageName: "Klarnote — newsletter", pageUri }),
      submitDemoRequest({ email: value }, { lang, pageUri, kind: "subscribe" }),
    ]).catch((err) => console.error("subscribe.submit_error", err));
  };

  if (state === "done") {
    return (
      <div className="lp-nl is-done" role="status">
        <span className="lp-nl-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
        <p className="lp-nl-doneline">{L(SUBSCRIBE.done)}</p>
      </div>
    );
  }

  return (
    <form className="lp-nl" onSubmit={submit} noValidate>
      <div className="lp-nl-h">{L(SUBSCRIBE.h)}</div>
      <p className="lp-nl-s">{L(SUBSCRIBE.sub)}</p>
      <div className="lp-nl-row">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "bad") setState("idle"); }}
          placeholder={L(SUBSCRIBE.ph)}
          aria-label={L(SUBSCRIBE.h)}
          aria-invalid={state === "bad" ? "true" : undefined}
        />
        <button type="submit" aria-label={L(SUBSCRIBE.cta)}>
          <span>{L(SUBSCRIBE.cta)}</span>
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
      <p className="lp-nl-note">{state === "bad" ? L(SUBSCRIBE.bad) : L(SUBSCRIBE.note)}</p>
    </form>
  );
}

export function MarketingShell({ navigate, lang = "en", tweaks, setTweak, children, className = "" }) {
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

  // Scroll reveal, stat count-up, card spotlight and the read-progress bar.
  // Keyed on `children` so a navigation's new blocks get picked up; everything
  // it does is progressive enhancement (see useMarketingMotion.js).
  useMarketingMotion(children);

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
    // `className` is a page-level hook: only /contact uses one so far, to turn
    // its stacked hero+form into two columns that fit one screen.
    <div className={`lp${className ? ` ${className}` : ""}`} data-accent={readAccent(tweaks)}>
      {/* Read progress. Empty and 2px tall until useMarketingMotion starts
          writing --lp-progress to it; decorative, so it is hidden from AT. */}
      <div className="lp-progress" aria-hidden="true"><i /></div>

      {/* ── Menu ───────────────────────────────────────────── */}
      <header ref={headerRef} className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          {/* Wordmark only — no tile. The public site's brand is the name set
              in Galgo, the same display face the headlines use; see
              `.lp .lp-brand-name` in app-extra.css. The `<Logo>` tile is still
              the platform sidebar's mark, which is why it is not deleted. */}
          <a className="lp-brand" href="#/welcome" onClick={go("/welcome")}>
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
              <span className="lp-brand-name">Klarnote</span>
            </a>
            <p className="lp-footer-tag">{f.tag}</p>
            <FooterSubscribe lang={lang} />
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
          {/* Service status, where a visitor expects it: the footer. It links
              to a page rather than opening a drop-up — a status read is
              something you link to, reload and keep open beside the thing that
              is failing, and it also keeps the probe off every other public
              page, which a live pill here could not. */}
          <a className="lp-footer-status" href="#/status" onClick={go("/status")}>
            <Icon name="activity" size={13} />
            {tr(lang, "Стан сервісів", "Service status")}
          </a>

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
