// LandingPage.jsx — Public marketing landing for Klarnote.
//
// Hero, trust, THE CLOSED LOOP, where-it-works, features, the moat, security,
// CTA. Localised into eleven languages via the shared `lang` tweak; no auth.
//
// The loop and moat sections do NOT keep their copy here. They read from
// marketing/positioning.js, which is the single source for the category story
// (Sovereign Ambient Trust Platform: Listen → Verify → Authorize) shared with
// /platform and the three pillar pages under /product. The sections this page
// used to carry — "two products" and a 01/02/03 workflow — were folded into
// that loop: they told the same sequence twice and neither named the category.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";
import { positioning, pillars, moatItems } from "./marketing/positioning.js";
import { WorkflowGraph } from "./marketing/WorkflowGraph.jsx";
import { VoiceReadout } from "./marketing/VoiceReadout.jsx";
import { DICTATIONS, HERO_SEQUENCE } from "./marketing/dictations.js";
import { tr } from "../i18n.js";

/* ── Copy ─────────────────────────────────────────────────────
   One dictionary per language keeps the marketing surface readable
   and easy to keep in sync across the eleven we ship. */
const COPY = {
  uk: {
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека", signin: "Увійти", start: "Запросити доступ" },
    hero: {
      title: "Розмова з пацієнтом стає перевіреним і підписаним медичним записом",
      sub: "Klarnote слухає прийом, звіряє нотатку з локалізованою клінічною доказовою базою та доводить її до кваліфікованого електронного підпису — в одному безперервному процесі, на вашій інфраструктурі.",
      ctaPrimary: "Почати безкоштовно",
      ctaSecondary: "Подивитися можливості",
      note: "Self-hosted моделі • Дані не залишають вашого розгортання • Підпис КЕП",
    },
    trust: "Створено для клінік, лікарень і приватної практики",
    stats: [
      { v: "98%", l: "точність розпізнавання медичної мови" },
      { v: "3×", l: "швидше за ручне введення" },
      { v: "12 мов", l: "інтерфейс; диктування — укр., англ., нім." },
      { v: "24/7", l: "доступ із будь-якого пристрою" },
    ],
    settingsTitle: "Один скрайб — будь-яка ситуація",
    settingsSub: "Очний прийом, відеоконсультація, обхід чи операційна — Klarnote слухає й документує всюди.",
    settings: [
      { icon: "users", t: "Очні прийоми", d: "Розмова з пацієнтом у кабінеті — скрайб працює у фоні.", path: "/templates/consultation-note" },
      { icon: "video", t: "Телемедицина та відео", d: "Дистанційні консультації: спосіб зв’язку, згода й межі огляду фіксуються автоматично.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Обхід і біля ліжка", d: "Щоденні записи про стан пацієнта в стаціонарі.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Процедури та операційна", d: "Протоколи втручань і операцій без пауз на друк.", path: "/templates/procedure-note" },
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
    securityTitle: "Безпека та приватність за замовчуванням",
    securitySub: "Дані пацієнтів захищені на кожному етапі — від запису до архіву.",
    security: [
      { icon: "shield", t: "Рольовий доступ", d: "Доступ за ролями: лікар, адміністратор, аудитор." },
      { icon: "history", t: "Незмінний аудит", d: "Кожна дія фіксується з можливістю перевірки цілісності." },
      { icon: "check", t: "Згода пацієнта", d: "Явна згода перед записом і прозорий індикатор стану." },
    ],
    ctaTitle: "Готові повернути час лікарям?",
    ctaSub: "Спробуйте Klarnote у вашій клініці вже сьогодні.",
    ctaPrimary: "Зареєструватися",
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
      title: "The consultation becomes an evidence-checked, legally signed medical record",
      sub: "Klarnote listens to the visit, verifies the note against localized clinical evidence, and carries it through a qualified electronic signature — one continuous workflow, on infrastructure you control.",
      ctaPrimary: "Get started free",
      ctaSecondary: "See features",
      note: "Self-hosted models • Data never leaves your deployment • QES/КЕП signing",
    },
    trust: "Built for clinics, hospitals and private practice",
    stats: [
      { v: "98%", l: "medical speech recognition accuracy" },
      { v: "3×", l: "faster than manual entry" },
      { v: "12 languages", l: "interface; dictation in UK, EN, DE" },
      { v: "24/7", l: "access from any device" },
    ],
    settingsTitle: "One scribe, every setting",
    settingsSub: "In the room, on a video call, on the ward round or in theatre — Klarnote listens and documents everywhere.",
    settings: [
      { icon: "users", t: "In-person visits", d: "The patient conversation in the room, with the scribe running in the background.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telehealth & video", d: "Remote consultations: modality, consent and examination limits captured automatically.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Ward round & bedside", d: "Daily inpatient progress notes as you move between beds.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Procedures & theatre", d: "Procedure and operative records without stopping to type.", path: "/templates/procedure-note" },
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
    securityTitle: "Security and privacy by default",
    securitySub: "Patient data is protected at every step — from recording to archive.",
    security: [
      { icon: "shield", t: "Role-based access", d: "Access by role: clinician, administrator, auditor." },
      { icon: "history", t: "Immutable audit", d: "Every action is logged with integrity verification." },
      { icon: "check", t: "Patient consent", d: "Explicit consent before recording with a clear status indicator." },
    ],
    ctaTitle: "Ready to give clinicians their time back?",
    ctaSub: "Try Klarnote in your clinic today.",
    ctaPrimary: "Sign up",
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
  pl: {
    nav: { product: "Produkt", features: "Funkcje", workflow: "Jak to działa", security: "Bezpieczeństwo", signin: "Zaloguj się", start: "Poproś o dostęp" },
    hero: {
      title: "Rozmowa z pacjentem staje się zweryfikowaną i prawnie podpisaną dokumentacją",
      sub: "Klarnote słucha wizyty, weryfikuje notatkę wobec zlokalizowanych dowodów klinicznych i doprowadza ją do kwalifikowanego podpisu elektronicznego — w jednym ciągłym przepływie, na Twojej infrastrukturze.",
      ctaPrimary: "Zacznij za darmo",
      ctaSecondary: "Zobacz funkcje",
      note: "Modele we własnej infrastrukturze • Dane nie opuszczają Twojego wdrożenia • Podpis QES/КЕП",
    },
    trust: "Stworzone dla klinik, szpitali i prywatnej praktyki",
    stats: [
      { v: "98%", l: "dokładności rozpoznawania mowy medycznej" },
      { v: "3×", l: "szybciej niż wprowadzanie ręczne" },
      { v: "12 języków", l: "interfejs; dyktowanie: UK, EN, DE" },
      { v: "24/7", l: "dostęp z dowolnego urządzenia" },
    ],
    settingsTitle: "Jeden skryba, każda sytuacja",
    settingsSub: "W gabinecie, na wideorozmowie, na obchodzie czy na bloku — Klarnote słucha i dokumentuje wszędzie.",
    settings: [
      { icon: "users", t: "Wizyty osobiste", d: "Rozmowa z pacjentem w gabinecie, skryba działa w tle.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedycyna i wideo", d: "Konsultacje zdalne: sposób kontaktu, zgoda i granice badania zapisywane automatycznie.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Obchód i przy łóżku", d: "Codzienne wpisy o stanie pacjenta w szpitalu.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Zabiegi i blok operacyjny", d: "Protokoły zabiegów i operacji bez przerw na pisanie.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Wszystko dla pewnej dokumentacji",
    featuresSub: "Od rozpoznawania mowy po podpis — pełny cykl w jednej aplikacji.",
    features: [
      { icon: "mic", t: "Rozpoznawanie w czasie rzeczywistym", d: "Strumieniowe ASR z podświetlaniem słów o niskiej pewności do szybkiej weryfikacji.", path: "/features/recognition" },
      { icon: "sparkle", t: "Inteligentne autouzupełnianie", d: "Kontekstowe podpowiedzi terminów, rozpoznań i fraz podczas dyktowania.", path: "/features/autocomplete" },
      { icon: "layers", t: "Szablony i struktury", d: "Gotowe struktury notatek i własne szablony dla każdej specjalizacji.", path: "/features/templates" },
      { icon: "history", t: "Wersje i korekty", d: "Pełna historia zmian, porównywanie różnic i poprawny proces wprowadzania korekt.", path: "/features/versions" },
      { icon: "sign", t: "Podpis elektroniczny Дія", d: "Podpisywanie dokumentów przez Дія z publiczną weryfikacją przez link.", path: "/features/signature" },
      { icon: "shield", t: "Audyt i zgodność", d: "Dziennik zdarzeń, weryfikacja integralności i dostęp oparty na rolach.", path: "/features/audit" },
    ],
    securityTitle: "Bezpieczeństwo i prywatność w standardzie",
    securitySub: "Dane pacjentów są chronione na każdym etapie — od nagrania po archiwum.",
    security: [
      { icon: "shield", t: "Dostęp oparty na rolach", d: "Dostęp według ról: lekarz, administrator, audytor." },
      { icon: "history", t: "Niezmienny audyt", d: "Każde działanie jest rejestrowane z możliwością weryfikacji integralności." },
      { icon: "check", t: "Zgoda pacjenta", d: "Wyraźna zgoda przed nagraniem i czytelny wskaźnik stanu." },
    ],
    ctaTitle: "Gotowi oddać lekarzom ich czas?",
    ctaSub: "Wypróbuj Klarnote w swojej klinice już dziś.",
    ctaPrimary: "Zarejestruj się",
    ctaSecondary: "Zaloguj się",
    footer: {
      tag: "Dyktowanie medyczne głosem.",
      cols: [
        { h: "Produkt", links: ["Scribe", "Dictate", "Funkcje", "Bezpieczeństwo"] },
        { h: "Firma", links: ["O nas", "Kontakt", "Kariera", "Blog"] },
        { h: "Informacje prawne", links: ["Prywatność", "Regulamin", "Przetwarzanie danych", "Zgoda"] },
      ],
      rights: "Wszelkie prawa zastrzeżone.",
    },
  },
  de: {
    nav: { product: "Produkt", features: "Funktionen", workflow: "So funktioniert es", security: "Sicherheit", signin: "Anmelden", start: "Zugang anfragen" },
    hero: {
      title: "Aus dem Gespräch wird eine evidenzgeprüfte, rechtsverbindlich signierte Akte",
      sub: "Klarnote hört der Sprechstunde zu, prüft die Notiz gegen lokalisierte klinische Evidenz und führt sie bis zur qualifizierten elektronischen Signatur — ein durchgehender Ablauf, auf Ihrer eigenen Infrastruktur.",
      ctaPrimary: "Kostenlos starten",
      ctaSecondary: "Funktionen ansehen",
      note: "Selbst gehostete Modelle • Daten verlassen Ihre Installation nicht • QES/КЕП-Signatur",
    },
    trust: "Entwickelt für Kliniken, Krankenhäuser und Privatpraxen",
    stats: [
      { v: "98%", l: "Erkennungsgenauigkeit bei medizinischer Sprache" },
      { v: "3×", l: "schneller als manuelle Eingabe" },
      { v: "12 Sprachen", l: "Oberfläche; Diktat: UK, EN, DE" },
      { v: "24/7", l: "Zugriff von jedem Gerät" },
    ],
    settingsTitle: "Ein Scribe, jede Situation",
    settingsSub: "Im Sprechzimmer, im Videogespräch, bei der Visite oder im OP — Klarnote hört zu und dokumentiert überall.",
    settings: [
      { icon: "users", t: "Präsenztermine", d: "Das Patientengespräch vor Ort, der Scribe läuft im Hintergrund.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedizin & Video", d: "Fernkonsultationen: Modalität, Einwilligung und Untersuchungsgrenzen werden automatisch erfasst.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Visite & am Krankenbett", d: "Tägliche Verlaufsnotizen auf dem Weg von Bett zu Bett.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Eingriffe & OP", d: "Eingriffs- und OP-Berichte, ohne zum Tippen zu unterbrechen.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Alles für eine verlässliche Dokumentation",
    featuresSub: "Von der Spracherkennung bis zur Signatur — der komplette Zyklus in einer Anwendung.",
    features: [
      { icon: "mic", t: "Erkennung in Echtzeit", d: "Streaming-ASR mit Hervorhebung von Wörtern geringer Konfidenz zur schnellen Prüfung.", path: "/features/recognition" },
      { icon: "sparkle", t: "Intelligente Autovervollständigung", d: "Kontextbezogene Vorschläge für Begriffe, Diagnosen und Formulierungen während des Diktierens.", path: "/features/autocomplete" },
      { icon: "layers", t: "Vorlagen & Strukturen", d: "Vorgefertigte Notizstrukturen und eigene Vorlagen je Fachrichtung.", path: "/features/templates" },
      { icon: "history", t: "Versionen & Nachträge", d: "Vollständige Änderungshistorie, Diff-Vergleich und korrekter Nachtragsprozess.", path: "/features/versions" },
      { icon: "sign", t: "Дія-E-Signatur", d: "Dokumente über Дія signieren, mit öffentlicher Verifizierung per Link.", path: "/features/signature" },
      { icon: "shield", t: "Audit & Compliance", d: "Ereignisprotokoll, Integritätsprüfung und rollenbasierter Zugriff.", path: "/features/audit" },
    ],
    securityTitle: "Sicherheit und Datenschutz als Standard",
    securitySub: "Patientendaten sind bei jedem Schritt geschützt — von der Aufnahme bis zum Archiv.",
    security: [
      { icon: "shield", t: "Rollenbasierter Zugriff", d: "Zugriff nach Rollen: Arzt, Administrator, Auditor." },
      { icon: "history", t: "Unveränderliches Audit", d: "Jede Aktion wird protokolliert und ist auf Integrität prüfbar." },
      { icon: "check", t: "Patienteneinwilligung", d: "Ausdrückliche Einwilligung vor der Aufnahme mit klarer Statusanzeige." },
    ],
    ctaTitle: "Bereit, Ärztinnen und Ärzten ihre Zeit zurückzugeben?",
    ctaSub: "Testen Sie Klarnote noch heute in Ihrer Klinik.",
    ctaPrimary: "Registrieren",
    ctaSecondary: "Anmelden",
    footer: {
      tag: "Medizinisches Diktieren per Stimme.",
      cols: [
        { h: "Produkt", links: ["Scribe", "Dictate", "Funktionen", "Sicherheit"] },
        { h: "Unternehmen", links: ["Über uns", "Kontakt", "Karriere", "Blog"] },
        { h: "Rechtliches", links: ["Datenschutz", "Nutzungsbedingungen", "Datenverarbeitung", "Einwilligung"] },
      ],
      rights: "Alle Rechte vorbehalten.",
    },
  },
  ro: {
    nav: { product: "Produs", features: "Funcționalități", workflow: "Cum funcționează", security: "Securitate", signin: "Autentificare", start: "Solicită acces" },
    hero: {
      title: "Consultația devine un document medical verificat și semnat legal",
      sub: "Klarnote ascultă consultația, verifică nota față de dovezi clinice localizate și o duce până la semnătura electronică calificată — un singur flux continuu, pe infrastructura dumneavoastră.",
      ctaPrimary: "Începe gratuit",
      ctaSecondary: "Vezi funcționalitățile",
      note: "Modele găzduite local • Datele nu părăsesc instalarea dumneavoastră • Semnătură QES/КЕП",
    },
    trust: "Creat pentru clinici, spitale și cabinete private",
    stats: [
      { v: "98%", l: "acuratețe în recunoașterea limbajului medical" },
      { v: "3×", l: "mai rapid decât introducerea manuală" },
      { v: "12 limbi", l: "interfață; dictare: UK, EN, DE" },
      { v: "24/7", l: "acces de pe orice dispozitiv" },
    ],
    settingsTitle: "Un singur scrib, orice context",
    settingsSub: "În cabinet, în apel video, la vizită sau în sala de operație — Klarnote ascultă și documentează peste tot.",
    settings: [
      { icon: "users", t: "Consultații în cabinet", d: "Conversația cu pacientul la fața locului, cu scribul rulând în fundal.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicină și video", d: "Consultații la distanță: modalitatea, consimțământul și limitele examinării captate automat.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Vizită și la patul bolnavului", d: "Note zilnice de evoluție pe măsură ce treceți de la un pat la altul.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Proceduri și sală de operație", d: "Protocoale de procedură și operatorii fără pauze pentru tastare.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Totul pentru o documentație sigură",
    featuresSub: "De la recunoașterea vorbirii până la semnătură — ciclul complet într-o singură aplicație.",
    features: [
      { icon: "mic", t: "Recunoaștere în timp real", d: "ASR în flux continuu, cu evidențierea cuvintelor cu încredere scăzută pentru verificare rapidă.", path: "/features/recognition" },
      { icon: "sparkle", t: "Autocompletare inteligentă", d: "Sugestii contextuale de termeni, diagnostice și fraze în timp ce dictați.", path: "/features/autocomplete" },
      { icon: "layers", t: "Șabloane și structuri", d: "Structuri de notițe predefinite și șabloane personalizate pentru fiecare specialitate.", path: "/features/templates" },
      { icon: "history", t: "Versiuni și amendamente", d: "Istoric complet al modificărilor, comparare a diferențelor și flux corect de amendare.", path: "/features/versions" },
      { icon: "sign", t: "Semnătură electronică Дія", d: "Semnați documente prin Дія, cu verificare publică prin link.", path: "/features/signature" },
      { icon: "shield", t: "Audit și conformitate", d: "Jurnal de evenimente, verificarea integrității și acces bazat pe roluri.", path: "/features/audit" },
    ],
    securityTitle: "Securitate și confidențialitate în mod implicit",
    securitySub: "Datele pacienților sunt protejate la fiecare pas — de la înregistrare până la arhivare.",
    security: [
      { icon: "shield", t: "Acces bazat pe roluri", d: "Acces în funcție de rol: medic, administrator, auditor." },
      { icon: "history", t: "Audit imuabil", d: "Fiecare acțiune este înregistrată, cu posibilitatea verificării integrității." },
      { icon: "check", t: "Consimțământul pacientului", d: "Consimțământ explicit înainte de înregistrare, cu un indicator de stare clar." },
    ],
    ctaTitle: "Sunteți gata să le redați medicilor timpul?",
    ctaSub: "Încercați Klarnote în clinica dumneavoastră chiar astăzi.",
    ctaPrimary: "Înregistrare",
    ctaSecondary: "Autentificare",
    footer: {
      tag: "Dictare medicală prin voce.",
      cols: [
        { h: "Produs", links: ["Scribe", "Dictate", "Funcționalități", "Securitate"] },
        { h: "Companie", links: ["Despre noi", "Contact", "Cariere", "Blog"] },
        { h: "Juridic", links: ["Confidențialitate", "Termeni", "Prelucrarea datelor", "Consimțământ"] },
      ],
      rights: "Toate drepturile rezervate.",
    },
  },
  cs: {
    nav: { product: "Produkt", features: "Funkce", workflow: "Jak to funguje", security: "Zabezpečení", signin: "Přihlásit se", start: "Požádat o přístup" },
    hero: {
      title: "Z rozhovoru s pacientem se stává ověřený a právně podepsaný záznam",
      sub: "Klarnote naslouchá návštěvě, ověřuje poznámku vůči lokalizovaným klinickým důkazům a dovede ji ke kvalifikovanému elektronickému podpisu — jeden souvislý postup, na vaší infrastruktuře.",
      ctaPrimary: "Začněte zdarma",
      ctaSecondary: "Prohlédnout funkce",
      note: "Vlastní modely • Data neopouštějí vaše nasazení • Podpis QES/КЕП",
    },
    trust: "Vytvořeno pro kliniky, nemocnice i soukromé praxe",
    stats: [
      { v: "98%", l: "přesnost rozpoznávání lékařské řeči" },
      { v: "3×", l: "rychlejší než ruční zápis" },
      { v: "12 jazyků", l: "rozhraní; diktování: UK, EN, DE" },
      { v: "24/7", l: "přístup z jakéhokoli zařízení" },
    ],
    settingsTitle: "Jeden zapisovatel, každá situace",
    settingsSub: "V ordinaci, na videohovoru, na vizitě i na sále — Klarnote naslouchá a dokumentuje všude.",
    settings: [
      { icon: "users", t: "Osobní návštěvy", d: "Rozhovor s pacientem v ordinaci, zapisovatel běží na pozadí.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicína a video", d: "Vzdálené konzultace: způsob kontaktu, souhlas i meze vyšetření se zaznamenají automaticky.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Vizita a u lůžka", d: "Denní záznamy o průběhu při přechodu mezi lůžky.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Výkony a operační sál", d: "Zápisy výkonů a operací bez přerušování psaním.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Vše pro spolehlivou dokumentaci",
    featuresSub: "Od rozpoznávání řeči po podpis — celý cyklus v jedné aplikaci.",
    features: [
      { icon: "mic", t: "Rozpoznávání v reálném čase", d: "Streamované ASR se zvýrazněním slov s nízkou spolehlivostí pro rychlou kontrolu.", path: "/features/recognition" },
      { icon: "sparkle", t: "Chytré automatické doplňování", d: "Kontextové návrhy termínů, diagnóz a frází přímo při diktování.", path: "/features/autocomplete" },
      { icon: "layers", t: "Šablony a struktury", d: "Předpřipravené struktury záznamů a vlastní šablony pro každou odbornost.", path: "/features/templates" },
      { icon: "history", t: "Verze a dodatky", d: "Kompletní historie změn, porovnání rozdílů a správný postup pro dodatky.", path: "/features/versions" },
      { icon: "sign", t: "Elektronický podpis Дія", d: "Podepisujte dokumenty přes Дія s veřejným ověřením pomocí odkazu.", path: "/features/signature" },
      { icon: "shield", t: "Audit a compliance", d: "Protokol událostí, ověřování integrity a přístup podle rolí.", path: "/features/audit" },
    ],
    securityTitle: "Zabezpečení a soukromí ve výchozím nastavení",
    securitySub: "Data pacientů jsou chráněna v každém kroku — od nahrávání po archivaci.",
    security: [
      { icon: "shield", t: "Přístup podle rolí", d: "Přístup podle role: lékař, administrátor, auditor." },
      { icon: "history", t: "Neměnný audit", d: "Každá akce je zaznamenána s ověřením integrity." },
      { icon: "check", t: "Souhlas pacienta", d: "Výslovný souhlas před nahráváním s jasným indikátorem stavu." },
    ],
    ctaTitle: "Připraveni vrátit lékařům jejich čas?",
    ctaSub: "Vyzkoušejte Klarnote ve své klinice ještě dnes.",
    ctaPrimary: "Registrace",
    ctaSecondary: "Přihlásit se",
    footer: {
      tag: "Lékařské diktování hlasem.",
      cols: [
        { h: "Produkt", links: ["Scribe", "Dictate", "Funkce", "Zabezpečení"] },
        { h: "Společnost", links: ["O nás", "Kontakt", "Kariéra", "Blog"] },
        { h: "Právní informace", links: ["Ochrana soukromí", "Podmínky", "Zpracování údajů", "Souhlas"] },
      ],
      rights: "Všechna práva vyhrazena.",
    },
  },
  sr: {
    nav: { product: "Proizvod", features: "Funkcije", workflow: "Kako funkcioniše", security: "Bezbednost", signin: "Prijava", start: "Zatražite pristup" },
    hero: {
      title: "Razgovor sa pacijentom postaje proveren i pravno potpisan medicinski zapis",
      sub: "Klarnote sluša pregled, proverava belešku uz lokalizovane kliničke dokaze i vodi je do kvalifikovanog elektronskog potpisa — jedan neprekidan tok, na vašoj infrastrukturi.",
      ctaPrimary: "Počnite besplatno",
      ctaSecondary: "Pogledajte funkcije",
      note: "Sopstveno hostovani modeli • Podaci ne napuštaju vašu instalaciju • Potpis QES/КЕП",
    },
    trust: "Napravljeno za klinike, bolnice i privatne prakse",
    stats: [
      { v: "98%", l: "tačnost prepoznavanja medicinskog govora" },
      { v: "3×", l: "brže od ručnog unosa" },
      { v: "12 jezika", l: "interfejs; diktiranje: UK, EN, DE" },
      { v: "24/7", l: "pristup sa bilo kog uređaja" },
    ],
    settingsTitle: "Jedan skrajb, svaka situacija",
    settingsSub: "U ordinaciji, na video pozivu, u viziti ili u operacionoj sali — Klarnote sluša i dokumentuje svuda.",
    settings: [
      { icon: "users", t: "Pregledi uživo", d: "Razgovor sa pacijentom u ordinaciji, skrajb radi u pozadini.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicina i video", d: "Konsultacije na daljinu: način kontakta, saglasnost i granice pregleda beleže se automatski.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Vizita i uz krevet", d: "Dnevne beleške o toku lečenja dok prelazite od kreveta do kreveta.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Procedure i operaciona sala", d: "Zapisi procedura i operacija bez pauze za kucanje.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Sve za pouzdanu dokumentaciju",
    featuresSub: "Od prepoznavanja govora do potpisa — ceo ciklus u jednoj aplikaciji.",
    features: [
      { icon: "mic", t: "Prepoznavanje u realnom vremenu", d: "Striming ASR sa isticanjem reči niske pouzdanosti radi brze provere.", path: "/features/recognition" },
      { icon: "sparkle", t: "Pametno automatsko dovršavanje", d: "Kontekstualni predlozi termina, dijagnoza i fraza dok diktirate.", path: "/features/autocomplete" },
      { icon: "layers", t: "Šabloni i strukture", d: "Gotove strukture beleški i prilagođeni šabloni za svaku specijalnost.", path: "/features/templates" },
      { icon: "history", t: "Verzije i amandmani", d: "Potpuna istorija izmena, poređenje razlika i ispravan tok amandmana.", path: "/features/versions" },
      { icon: "sign", t: "Elektronski potpis Дія", d: "Potpisujte dokumente preko sistema Дія, uz javnu verifikaciju putem linka.", path: "/features/signature" },
      { icon: "shield", t: "Revizija i usklađenost", d: "Dnevnik događaja, provera integriteta i pristup zasnovan na ulogama.", path: "/features/audit" },
    ],
    securityTitle: "Bezbednost i privatnost podrazumevano",
    securitySub: "Podaci pacijenata zaštićeni su u svakom koraku — od snimanja do arhive.",
    security: [
      { icon: "shield", t: "Pristup zasnovan na ulogama", d: "Pristup prema ulozi: lekar, administrator, revizor." },
      { icon: "history", t: "Nepromenljiva revizija", d: "Svaka radnja se beleži uz proveru integriteta." },
      { icon: "check", t: "Saglasnost pacijenta", d: "Izričita saglasnost pre snimanja, sa jasnim indikatorom statusa." },
    ],
    ctaTitle: "Spremni da lekarima vratite njihovo vreme?",
    ctaSub: "Isprobajte Klarnote u svojoj klinici već danas.",
    ctaPrimary: "Registracija",
    ctaSecondary: "Prijava",
    footer: {
      tag: "Medicinsko diktiranje glasom.",
      cols: [
        { h: "Proizvod", links: ["Scribe", "Dictate", "Funkcije", "Bezbednost"] },
        { h: "Kompanija", links: ["O nama", "Kontakt", "Karijera", "Blog"] },
        { h: "Pravno", links: ["Privatnost", "Uslovi korišćenja", "Obrada podataka", "Saglasnost"] },
      ],
      rights: "Sva prava zadržana.",
    },
  },
  hu: {
    nav: { product: "Termék", features: "Funkciók", workflow: "Hogyan működik", security: "Biztonság", signin: "Bejelentkezés", start: "Hozzáférés igénylése" },
    hero: {
      title: "A beteggel folytatott beszélgetésből ellenőrzött, jogilag aláírt dokumentum lesz",
      sub: "A Klarnote végighallgatja a vizitet, lokalizált klinikai bizonyítékokkal veti össze a jegyzetet, és elviszi a minősített elektronikus aláírásig — egyetlen folyamatos munkamenetben, az Ön infrastruktúráján.",
      ctaPrimary: "Kezdje ingyen",
      ctaSecondary: "Funkciók megtekintése",
      note: "Saját üzemeltetésű modellek • Az adat nem hagyja el a telepítését • QES/КЕП aláírás",
    },
    trust: "Klinikák, kórházak és magánpraxisok számára készült",
    stats: [
      { v: "98%", l: "pontosság az orvosi beszéd felismerésében" },
      { v: "3×", l: "gyorsabb, mint a kézi bevitel" },
      { v: "12 nyelv", l: "felület; diktálás: UK, EN, DE" },
      { v: "24/7", l: "hozzáférés bármilyen eszközről" },
    ],
    settingsTitle: "Egy írnok, minden helyzet",
    settingsSub: "A rendelőben, videohíváson, viziten vagy a műtőben — a Klarnote mindenhol figyel és dokumentál.",
    settings: [
      { icon: "users", t: "Személyes vizitek", d: "A beteggel folytatott beszélgetés a rendelőben, az írnok a háttérben fut.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicina és videó", d: "Távkonzultációk: a kapcsolat módja, a beleegyezés és a vizsgálat korlátai automatikusan rögzülnek.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Vizit és betegágy mellett", d: "Napi kórlefolyás-jegyzetek, ahogy ágytól ágyig halad.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Beavatkozások és műtő", d: "Beavatkozási és műtéti leírások gépelési szünetek nélkül.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Minden a megbízható dokumentációhoz",
    featuresSub: "A beszédfelismeréstől az aláírásig — a teljes ciklus egyetlen alkalmazásban.",
    features: [
      { icon: "mic", t: "Valós idejű felismerés", d: "Streamelt beszédfelismerés az alacsony megbízhatóságú szavak kiemelésével a gyors ellenőrzéshez.", path: "/features/recognition" },
      { icon: "sparkle", t: "Intelligens automatikus kiegészítés", d: "Kontextusfüggő javaslatok kifejezésekre, diagnózisokra és mondatokra diktálás közben.", path: "/features/autocomplete" },
      { icon: "layers", t: "Sablonok és struktúrák", d: "Kész feljegyzésstruktúrák és egyéni sablonok szakterületenként.", path: "/features/templates" },
      { icon: "history", t: "Verziók és módosítások", d: "Teljes változástörténet, különbségek összehasonlítása és szabályos módosítási folyamat.", path: "/features/versions" },
      { icon: "sign", t: "Дія e-aláírás", d: "Írjon alá dokumentumokat a Дія rendszeren keresztül, nyilvános linkes ellenőrzéssel.", path: "/features/signature" },
      { icon: "shield", t: "Audit és megfelelőség", d: "Eseménynapló, integritás-ellenőrzés és szerepkör-alapú hozzáférés.", path: "/features/audit" },
    ],
    securityTitle: "Biztonság és adatvédelem alapértelmezésben",
    securitySub: "A betegadatok minden lépésben védettek — a felvételtől az archiválásig.",
    security: [
      { icon: "shield", t: "Szerepkör-alapú hozzáférés", d: "Hozzáférés szerepkör szerint: orvos, adminisztrátor, auditor." },
      { icon: "history", t: "Módosíthatatlan audit", d: "Minden művelet naplózásra kerül, integritás-ellenőrzéssel." },
      { icon: "check", t: "Betegbeleegyezés", d: "Kifejezett beleegyezés a felvétel előtt, egyértelmű állapotjelzővel." },
    ],
    ctaTitle: "Készen áll rá, hogy visszaadja az orvosok idejét?",
    ctaSub: "Próbálja ki a Klarnote-ot a klinikáján még ma.",
    ctaPrimary: "Regisztráció",
    ctaSecondary: "Bejelentkezés",
    footer: {
      tag: "Orvosi diktálás hanggal.",
      cols: [
        { h: "Termék", links: ["Scribe", "Dictate", "Funkciók", "Biztonság"] },
        { h: "Vállalat", links: ["Rólunk", "Kapcsolat", "Karrier", "Blog"] },
        { h: "Jogi információk", links: ["Adatvédelem", "Feltételek", "Adatkezelés", "Beleegyezés"] },
      ],
      rights: "Minden jog fenntartva.",
    },
  },
  ar: {
    nav: { product: "المنتج", features: "الميزات", workflow: "كيف يعمل", security: "الأمان", signin: "تسجيل الدخول", start: "طلب وصول" },
    hero: {
      title: "تتحوّل استشارة المريض إلى سجل طبي مُتحقَّق منه ومُوقَّع قانونيًا",
      sub: "يستمع Klarnote إلى الزيارة، ويطابق الملاحظة مع أدلة سريرية محلية، ويصل بها إلى توقيع إلكتروني مؤهل — في سير عمل واحد متصل، وعلى بنيتك التحتية.",
      ctaPrimary: "ابدأ مجانًا",
      ctaSecondary: "استعرض الميزات",
      note: "نماذج مستضافة ذاتيًا • البيانات لا تغادر تثبيتك • توقيع QES/КЕП",
    },
    trust: "مصمّم للعيادات والمستشفيات والممارسة الخاصة",
    stats: [
      { v: "98%", l: "دقة التعرف على الكلام الطبي" },
      { v: "3×", l: "أسرع من الإدخال اليدوي" },
      { v: "12 لغة", l: "الواجهة؛ الإملاء بالأوكرانية والإنجليزية والألمانية" },
      { v: "24/7", l: "الوصول من أي جهاز" },
    ],
    settingsTitle: "مدوّن واحد، لكل الأماكن",
    settingsSub: "في الغرفة، أو في مكالمة فيديو، أو أثناء جولة العنبر، أو في غرفة العمليات — يستمع Klarnote ويوثّق في كل مكان.",
    settings: [
      { icon: "users", t: "الزيارات الحضورية", d: "محادثة المريض في الغرفة، مع عمل المدوّن في الخلفية.", path: "/templates/consultation-note" },
      { icon: "video", t: "الرعاية عن بُعد والفيديو", d: "الاستشارات عن بُعد: تُلتقط الوسيلة والموافقة وحدود الفحص تلقائيًا.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "جولة العنبر وبجانب السرير", d: "ملاحظات تقدّم يومية للمرضى المنومين وأنت تنتقل بين الأسرّة.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "الإجراءات وغرفة العمليات", d: "سجلات الإجراءات والعمليات دون التوقف للكتابة.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "كل ما يلزم لتوثيق واثق",
    featuresSub: "من التعرف على الكلام إلى التوقيع — الدورة الكاملة في تطبيق واحد.",
    features: [
      { icon: "mic", t: "تعرّف في الوقت الفعلي", d: "تعرّف متدفق على الكلام مع إبراز الكلمات منخفضة الثقة للمراجعة السريعة.", path: "/features/recognition" },
      { icon: "sparkle", t: "إكمال تلقائي ذكي", d: "اقتراحات واعية بالسياق للمصطلحات والتشخيصات والعبارات أثناء الإملاء.", path: "/features/autocomplete" },
      { icon: "layers", t: "القوالب والبنى", d: "بنى ملاحظات جاهزة وقوالب مخصصة لكل تخصص.", path: "/features/templates" },
      { icon: "history", t: "الإصدارات والتعديلات", d: "سجل تغييرات كامل ومقارنة الفروق ومسار تعديل صحيح.", path: "/features/versions" },
      { icon: "sign", t: "التوقيع الإلكتروني عبر Дія", d: "وقّع المستندات عبر Дія مع التحقق برابط عام.", path: "/features/signature" },
      { icon: "shield", t: "التدقيق والامتثال", d: "سجل الأحداث والتحقق من السلامة والوصول المستند إلى الأدوار.", path: "/features/audit" },
    ],
    securityTitle: "الأمان والخصوصية افتراضيًا",
    securitySub: "بيانات المريض محمية في كل خطوة — من التسجيل إلى الأرشيف.",
    security: [
      { icon: "shield", t: "وصول مستند إلى الأدوار", d: "الوصول حسب الدور: طبيب، مسؤول، مدقّق." },
      { icon: "history", t: "تدقيق غير قابل للتغيير", d: "كل إجراء يُسجَّل مع التحقق من السلامة." },
      { icon: "check", t: "موافقة المريض", d: "موافقة صريحة قبل التسجيل مع مؤشر حالة واضح." },
    ],
    ctaTitle: "هل أنت مستعد لإعادة وقت الأطباء إليهم؟",
    ctaSub: "جرّب Klarnote في عيادتك اليوم.",
    ctaPrimary: "سجّل الآن",
    ctaSecondary: "تسجيل الدخول",
    footer: {
      tag: "إملاء طبي بالصوت.",
      cols: [
        { h: "المنتج", links: ["Scribe", "Dictate", "الميزات", "الأمان"] },
        { h: "الشركة", links: ["من نحن", "اتصل بنا", "الوظائف", "المدونة"] },
        { h: "القانوني", links: ["الخصوصية", "الشروط", "معالجة البيانات", "الموافقة"] },
      ],
      rights: "جميع الحقوق محفوظة.",
    },
  },
  es: {
    nav: { product: "Producto", features: "Funciones", workflow: "Cómo funciona", security: "Seguridad", signin: "Iniciar sesión", start: "Solicitar acceso" },
    hero: {
      title: "La consulta se convierte en un registro médico verificado y firmado legalmente",
      sub: "Klarnote escucha la visita, contrasta la nota con evidencia clínica localizada y la lleva hasta una firma electrónica cualificada — un flujo continuo, sobre su propia infraestructura.",
      ctaPrimary: "Empezar gratis",
      ctaSecondary: "Ver las funciones",
      note: "Modelos autoalojados • Los datos no salen de su despliegue • Firma QES/КЕП",
    },
    trust: "Creado para clínicas, hospitales y consultas privadas",
    stats: [
      { v: "98%", l: "de precisión en el reconocimiento del habla clínica" },
      { v: "3×", l: "más rápido que escribir a mano" },
      { v: "12 idiomas", l: "interfaz; dictado en UK, EN y DE" },
      { v: "24/7", l: "acceso desde cualquier dispositivo" },
    ],
    settingsTitle: "Un escriba para cada situación",
    settingsSub: "En la consulta, en videollamada, en el pase de visita o en el quirófano: Klarnote escucha y documenta en todas partes.",
    settings: [
      { icon: "users", t: "Consultas presenciales", d: "La conversación con el paciente en la consulta, con el escriba en segundo plano.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicina y vídeo", d: "Consultas a distancia: el medio, el consentimiento y los límites de la exploración se registran automáticamente.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Pase de visita y cabecera", d: "Notas de evolución diarias mientras pasa de cama en cama.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Procedimientos y quirófano", d: "Registros de procedimientos y cirugías sin pausas para teclear.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Todo lo necesario para documentar con confianza",
    featuresSub: "Del reconocimiento de voz a la firma: el ciclo completo en una sola aplicación.",
    features: [
      { icon: "mic", t: "Reconocimiento en tiempo real", d: "Reconocimiento de voz en streaming que resalta las palabras de baja confianza para revisarlas rápido.", path: "/features/recognition" },
      { icon: "sparkle", t: "Autocompletado inteligente", d: "Sugerencias contextuales de términos, diagnósticos y frases mientras dicta.", path: "/features/autocomplete" },
      { icon: "layers", t: "Plantillas y estructuras", d: "Estructuras de nota listas para usar y plantillas propias por especialidad.", path: "/features/templates" },
      { icon: "history", t: "Versiones y enmiendas", d: "Historial completo de cambios, comparación de diferencias y un flujo de enmienda correcto.", path: "/features/versions" },
      { icon: "sign", t: "Firma electrónica con Дія", d: "Firme documentos a través de Дія con verificación mediante enlace público.", path: "/features/signature" },
      { icon: "shield", t: "Auditoría y cumplimiento", d: "Registro de eventos, verificación de integridad y acceso basado en roles.", path: "/features/audit" },
    ],
    securityTitle: "Seguridad y privacidad por defecto",
    securitySub: "Los datos del paciente están protegidos en cada paso, desde la grabación hasta el archivo.",
    security: [
      { icon: "shield", t: "Acceso basado en roles", d: "Acceso según el rol: médico, administrador, auditor." },
      { icon: "history", t: "Auditoría inmutable", d: "Cada acción queda registrada con verificación de integridad." },
      { icon: "check", t: "Consentimiento del paciente", d: "Consentimiento explícito antes de grabar, con un indicador de estado claro." },
    ],
    ctaTitle: "¿Listo para devolver a los médicos su tiempo?",
    ctaSub: "Pruebe Klarnote hoy mismo en su clínica.",
    ctaPrimary: "Registrarse",
    ctaSecondary: "Iniciar sesión",
    footer: {
      tag: "Dictado médico por voz.",
      cols: [
        { h: "Producto", links: ["Scribe", "Dictate", "Funciones", "Seguridad"] },
        { h: "Empresa", links: ["Quiénes somos", "Contacto", "Empleo", "Blog"] },
        { h: "Legal", links: ["Privacidad", "Términos", "Tratamiento de datos", "Consentimiento"] },
      ],
      rights: "Todos los derechos reservados.",
    },
  },
  pt: {
    nav: { product: "Produto", features: "Funcionalidades", workflow: "Como funciona", security: "Segurança", signin: "Iniciar sessão", start: "Pedir acesso" },
    hero: {
      title: "A consulta torna-se um registo médico verificado e assinado legalmente",
      sub: "O Klarnote ouve a consulta, confronta a nota com evidência clínica localizada e leva-a até uma assinatura eletrónica qualificada — um fluxo contínuo, na sua própria infraestrutura.",
      ctaPrimary: "Começar gratuitamente",
      ctaSecondary: "Ver as funcionalidades",
      note: "Modelos auto-alojados • Os dados não saem da sua instalação • Assinatura QES/КЕП",
    },
    trust: "Feito para clínicas, hospitais e consultórios privados",
    stats: [
      { v: "98%", l: "de precisão no reconhecimento da fala clínica" },
      { v: "3×", l: "mais rápido do que escrever à mão" },
      { v: "12 idiomas", l: "interface; ditado em UK, EN e DE" },
      { v: "24/7", l: "acesso a partir de qualquer dispositivo" },
    ],
    settingsTitle: "Um escriba para cada situação",
    settingsSub: "No consultório, em videochamada, na visita ou no bloco operatório — o Klarnote ouve e documenta em todo o lado.",
    settings: [
      { icon: "users", t: "Consultas presenciais", d: "A conversa com o doente no consultório, com o escriba a correr em segundo plano.", path: "/templates/consultation-note" },
      { icon: "video", t: "Telemedicina e vídeo", d: "Consultas à distância: o meio, o consentimento e os limites do exame ficam registados automaticamente.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Visita e cabeceira", d: "Notas de evolução diárias enquanto passa de cama em cama.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Procedimentos e bloco operatório", d: "Registos de procedimentos e cirurgias sem paragens para escrever.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Tudo o que é preciso para documentar com confiança",
    featuresSub: "Do reconhecimento de voz à assinatura — o ciclo completo numa só aplicação.",
    features: [
      { icon: "mic", t: "Reconhecimento em tempo real", d: "Reconhecimento de voz em streaming que destaca as palavras de baixa confiança para revisão rápida.", path: "/features/recognition" },
      { icon: "sparkle", t: "Preenchimento automático inteligente", d: "Sugestões contextuais de termos, diagnósticos e frases enquanto dita.", path: "/features/autocomplete" },
      { icon: "layers", t: "Modelos e estruturas", d: "Estruturas de nota prontas a usar e modelos próprios por especialidade.", path: "/features/templates" },
      { icon: "history", t: "Versões e retificações", d: "Histórico completo de alterações, comparação de diferenças e um fluxo de retificação correto.", path: "/features/versions" },
      { icon: "sign", t: "Assinatura eletrónica Дія", d: "Assine documentos através da Дія, com verificação por ligação pública.", path: "/features/signature" },
      { icon: "shield", t: "Auditoria e conformidade", d: "Registo de eventos, verificação de integridade e acesso baseado em funções.", path: "/features/audit" },
    ],
    securityTitle: "Segurança e privacidade por predefinição",
    securitySub: "Os dados do doente estão protegidos em cada passo — da gravação ao arquivo.",
    security: [
      { icon: "shield", t: "Acesso baseado em funções", d: "Acesso conforme a função: médico, administrador, auditor." },
      { icon: "history", t: "Auditoria imutável", d: "Cada ação fica registada com verificação de integridade." },
      { icon: "check", t: "Consentimento do doente", d: "Consentimento explícito antes da gravação, com um indicador de estado claro." },
    ],
    ctaTitle: "Pronto para devolver aos médicos o seu tempo?",
    ctaSub: "Experimente hoje o Klarnote na sua clínica.",
    ctaPrimary: "Registar-se",
    ctaSecondary: "Iniciar sessão",
    footer: {
      tag: "Ditado médico por voz.",
      cols: [
        { h: "Produto", links: ["Scribe", "Dictate", "Funcionalidades", "Segurança"] },
        { h: "Empresa", links: ["Sobre nós", "Contacto", "Carreiras", "Blogue"] },
        { h: "Legal", links: ["Privacidade", "Termos", "Tratamento de dados", "Consentimento"] },
      ],
      rights: "Todos os direitos reservados.",
    },
  },
  lt: {
    nav: { product: "Produktas", features: "Galimybės", workflow: "Kaip tai veikia", security: "Sauga", signin: "Prisijungti", start: "Prašyti prieigos" },
    hero: {
      title: "Konsultacija tampa įrodymais patikrintu, teisiškai pasirašytu medicininiu įrašu",
      sub: "Klarnote klausosi vizito, patikrina įrašą pagal lokalizuotus klinikinius įrodymus ir palydi jį iki kvalifikuoto elektroninio parašo — vientisas darbo srautas jūsų pačių valdomoje infrastruktūroje.",
      ctaPrimary: "Pradėkite nemokamai",
      ctaSecondary: "Žiūrėti galimybes",
      note: "Savarankiškai talpinami modeliai • Duomenys nepalieka jūsų aplinkos • KEP / QES pasirašymas",
    },
    trust: "Sukurta klinikoms, ligoninėms ir privačiai praktikai",
    stats: [
      { v: "98 %", l: "medicininės kalbos atpažinimo tikslumas" },
      { v: "3×", l: "greičiau nei rašant ranka" },
      { v: "12 kalbų", l: "sąsaja; diktavimas UK, EN, DE" },
      { v: "24/7", l: "prieiga iš bet kurio įrenginio" },
    ],
    settingsTitle: "Vienas asistentas — visoms situacijoms",
    settingsSub: "Kabinete, vaizdo skambutyje, per vizitaciją ar operacinėje — Klarnote klausosi ir dokumentuoja visur.",
    settings: [
      { icon: "users", t: "Vizitai kabinete", d: "Pokalbis su pacientu kabinete, asistentui dirbant fone.", path: "/templates/consultation-note" },
      { icon: "video", t: "Nuotolinės konsultacijos", d: "Nuotoliniai vizitai: būdas, sutikimas ir apžiūros ribos užfiksuojami automatiškai.", path: "/templates/telehealth-visit" },
      { icon: "heart", t: "Vizitacija prie lovos", d: "Kasdieniai stacionaro eigos įrašai einant nuo lovos prie lovos.", path: "/templates/progress-note" },
      { icon: "scalpel", t: "Procedūros ir operacinė", d: "Procedūrų ir operacijų protokolai nenutraukiant darbo rašymui.", path: "/templates/procedure-note" },
    ],
    featuresTitle: "Viskas užtikrintam dokumentavimui",
    featuresSub: "Nuo kalbos atpažinimo iki parašo — visas ciklas vienoje programoje.",
    features: [
      { icon: "mic", t: "Atpažinimas realiuoju laiku", d: "Srautinis ASR su pažymėtais mažo patikimumo žodžiais greitai peržiūrai.", path: "/features/recognition" },
      { icon: "sparkle", t: "Išmanusis automatinis užbaigimas", d: "Kontekstą suprantantys terminų, diagnozių ir frazių pasiūlymai diktuojant.", path: "/features/autocomplete" },
      { icon: "layers", t: "Šablonai ir struktūros", d: "Paruoštos įrašų struktūros ir savi šablonai kiekvienai specialybei.", path: "/features/templates" },
      { icon: "history", t: "Versijos ir pataisos", d: "Visa pakeitimų istorija, versijų palyginimas ir taisyklinga pataisų eiga.", path: "/features/versions" },
      { icon: "sign", t: "Elektroninis parašas", d: "Dokumentų pasirašymas su viešai patikrinama nuoroda.", path: "/features/signature" },
      { icon: "shield", t: "Auditas ir atitiktis", d: "Įvykių žurnalas, vientisumo patikra ir prieiga pagal vaidmenis.", path: "/features/audit" },
    ],
    securityTitle: "Sauga ir privatumas pagal nutylėjimą",
    securitySub: "Paciento duomenys saugomi kiekviename žingsnyje — nuo įrašymo iki archyvo.",
    security: [
      { icon: "shield", t: "Prieiga pagal vaidmenis", d: "Prieiga pagal vaidmenį: gydytojas, administratorius, auditorius." },
      { icon: "history", t: "Nekeičiamas auditas", d: "Kiekvienas veiksmas registruojamas su vientisumo patikra." },
      { icon: "check", t: "Paciento sutikimas", d: "Aiškus sutikimas prieš įrašymą su matoma būsena." },
    ],
    ctaTitle: "Pasiruošę grąžinti gydytojams laiką?",
    ctaSub: "Išbandykite Klarnote savo klinikoje jau šiandien.",
    ctaPrimary: "Registruotis",
    ctaSecondary: "Prisijungti",
    footer: {
      tag: "Medicininis diktavimas balsu.",
      cols: [
        { h: "Produktas", links: ["Scribe", "Diktavimas", "Galimybės", "Sauga"] },
        { h: "Įmonė", links: ["Apie mus", "Kontaktai", "Karjera", "Tinklaraštis"] },
        { h: "Teisinė informacija", links: ["Privatumas", "Sąlygos", "Duomenų tvarkymas", "Sutikimas"] },
      ],
      rights: "Visos teisės saugomos.",
    },
  },
};

/* ── Hero demo — an interactive dictaphone / player ───────────
   A working mock of the Dictate recorder: the transcript streams
   in word-by-word (with a low-confidence word flagged), the timer
   ticks, the waveform reacts and the structured note fills in.
   The transport controls are real — play/pause, restart and skip
   all work, and the progress bar is seekable. Ten different
   dictations rotate through, one per specialty. A `*` suffix marks
   a low-confidence token. Isolated in its own component so only
   this subtree re-renders on each tick. */
const SCRIPTS = {
  uk: [
    { tpl: "Терапія · Первинний огляд", patient: "І. Коваленко",
      tokens: ["Пацієнт", "скаржиться", "на", "кашель", "із", "мокротинням", "упродовж", "двох", "днів", "та", "субфебрильну*", "температуру.", "При", "огляді", "—", "дихання", "везикулярне,", "сатурація", "98%."],
      cmdAt: 12, cmd: "Розпізнано команду · «Нова секція»",
      note: [{ h: "Скарги", d: "Кашель із мокротинням, 2 дні. Субфебрилітет." }, { h: "Об'єктивно", d: "Дихання везикулярне. SpO₂ 98%." }, { h: "Висновок", d: "Гострий бронхіт." }] },
    { tpl: "Кардіологія · Повторний візит", patient: "О. Шевченко",
      tokens: ["Скарги", "на", "головний", "біль", "та", "періодичне", "серцебиття.", "Артеріальний", "тиск", "150", "на", "95,", "пульс", "82", "ритмічний.", "Тони", "серця", "приглушені*."],
      cmdAt: 12, cmd: "Розпізнано команду · «Виміряти тиск»",
      note: [{ h: "Скарги", d: "Головний біль, серцебиття." }, { h: "Об'єктивно", d: "АТ 150/95, ЧСС 82." }, { h: "Висновок", d: "Артеріальна гіпертензія 2 ст." }] },
    { tpl: "Радіологія · Опис знімка", patient: "М. Бондаренко",
      tokens: ["Оглядова", "рентгенографія", "органів", "грудної", "клітки.", "Легеневі", "поля", "прозорі,", "вогнищевих", "та", "інфільтративних*", "тіней", "не", "виявлено.", "Синуси", "вільні."],
      cmdAt: 11, cmd: "Розпізнано команду · «Вставити шаблон»",
      note: [{ h: "Метод", d: "Рентгенографія ОГК." }, { h: "Опис", d: "Без вогнищевих змін." }, { h: "Висновок", d: "Патології не виявлено." }] },
    { tpl: "Педіатрія · Гострий прийом", patient: "Дитина, 4 р.",
      tokens: ["Дитина", "неспокійна,", "температура", "до", "38.5", "та", "скарги", "на", "біль", "у", "вусі.", "Отоскопія", "—", "перетинка", "гіперемована*,", "вибухає."],
      cmdAt: 12, cmd: "Розпізнано команду · «Додати діагноз»",
      note: [{ h: "Скарги", d: "Біль у вусі, гарячка." }, { h: "Об'єктивно", d: "Отоскопія — гіперемія." }, { h: "Висновок", d: "Гострий середній отит." }] },
    { tpl: "Дерматологія · Консультація", patient: "Н. Мельник",
      tokens: ["Скарги", "на", "висип", "та", "свербіж", "на", "згинальних", "поверхнях.", "Шкіра", "суха,", "вогнища", "еритеми", "з", "ліхеніфікацією*.", "Дермографізм", "білий."],
      cmdAt: 11, cmd: "Розпізнано команду · «Нова секція»",
      note: [{ h: "Скарги", d: "Висип, свербіж." }, { h: "Об'єктивно", d: "Еритема, сухість шкіри." }, { h: "Висновок", d: "Атопічний дерматит." }] },
    { tpl: "Ортопедія · Травмпункт", patient: "Р. Ткаченко",
      tokens: ["Травма", "правого", "гомілковостопного", "суглоба", "під", "час", "бігу.", "Набряк", "латеральної", "кісточки,", "навантаження", "обмежене*,", "рухи", "болючі."],
      cmdAt: 10, cmd: "Розпізнано команду · «Призначити рентген»",
      note: [{ h: "Скарги", d: "Біль, набряк суглоба." }, { h: "Об'єктивно", d: "Набряк латеральної кісточки." }, { h: "Висновок", d: "Розтягнення зв'язок." }] },
    { tpl: "Гастроентерологія · Візит", patient: "С. Кравченко",
      tokens: ["Скарги", "на", "біль", "в", "епігастрії", "після", "їжі", "та", "печію.", "Язик", "обкладений,", "живіт", "м'який,", "болючий*", "в", "епігастрії."],
      cmdAt: 12, cmd: "Розпізнано команду · «Додати призначення»",
      note: [{ h: "Скарги", d: "Біль в епігастрії, печія." }, { h: "Об'єктивно", d: "Болючість в епігастрії." }, { h: "Висновок", d: "Хронічний гастрит." }] },
    { tpl: "Ендокринологія · Контроль", patient: "Л. Поліщук",
      tokens: ["Контрольний", "огляд,", "діабет", "2", "типу.", "Глюкоза", "натще", "7.8,", "HbA1c", "7.1", "відсотка.", "Скарг", "на", "гіпоглікемії*", "немає."],
      cmdAt: 11, cmd: "Розпізнано команду · «Оновити план»",
      note: [{ h: "Скарги", d: "Без гіпоглікемій." }, { h: "Об'єктивно", d: "Глюкоза 7.8, HbA1c 7.1%." }, { h: "Висновок", d: "ЦД 2 типу, субкомпенсація." }] },
    { tpl: "Неврологія · Первинний огляд", patient: "В. Савченко",
      tokens: ["Скарги", "на", "пульсуючий", "однобічний", "головний", "біль", "зі", "світлобоязню.", "Неврологічний", "статус", "без", "вогнищевої*", "симптоматики.", "Менінгеальних", "знаків", "немає."],
      cmdAt: 12, cmd: "Розпізнано команду · «Нова секція»",
      note: [{ h: "Скарги", d: "Однобічний головний біль." }, { h: "Об'єктивно", d: "Без вогнищевої симптоматики." }, { h: "Висновок", d: "Мігрень без аури." }] },
    { tpl: "Отоларингологія · Прийом", patient: "Ю. Гриценко",
      tokens: ["Скарги", "на", "біль", "у", "горлі", "та", "утруднене", "ковтання.", "Зів", "гіперемований,", "мигдалики", "збільшені", "з", "нальотом*,", "лімфовузли", "чутливі."],
      cmdAt: 11, cmd: "Розпізнано команду · «Додати діагноз»",
      note: [{ h: "Скарги", d: "Біль у горлі, дисфагія." }, { h: "Об'єктивно", d: "Гіперемія зіва, наліт." }, { h: "Висновок", d: "Гострий фарингіт." }] },
  ],
  en: [
    { tpl: "Primary care · Initial visit", patient: "J. Carter",
      tokens: ["Patient", "presents", "with", "a", "two-day", "history", "of", "productive", "cough", "and", "low-grade", "fever.", "On", "exam,", "chest", "is", "clear", "to", "auscultation*,", "oxygen", "saturation", "98%."],
      cmdAt: 14, cmd: "Voice command · “New section”",
      note: [{ h: "Symptoms", d: "Productive cough, 2 days. Low-grade fever." }, { h: "Exam", d: "Chest clear on auscultation. SpO₂ 98%." }, { h: "Assessment", d: "Acute bronchitis." }] },
    { tpl: "Cardiology · Follow-up", patient: "A. Reed",
      tokens: ["Reports", "headache", "and", "occasional", "palpitations.", "Blood", "pressure", "150", "over", "95,", "pulse", "82", "and", "regular.", "Heart", "sounds", "are", "muffled*."],
      cmdAt: 12, cmd: "Voice command · “Measure BP”",
      note: [{ h: "Symptoms", d: "Headache, palpitations." }, { h: "Exam", d: "BP 150/95, HR 82." }, { h: "Assessment", d: "Stage 2 hypertension." }] },
    { tpl: "Radiology · Report", patient: "M. Doyle",
      tokens: ["Frontal", "chest", "radiograph.", "Lung", "fields", "are", "clear,", "no", "focal", "or", "infiltrative*", "opacities", "identified.", "Costophrenic", "angles", "are", "sharp."],
      cmdAt: 12, cmd: "Voice command · “Insert template”",
      note: [{ h: "Technique", d: "Frontal chest radiograph." }, { h: "Findings", d: "No focal opacities." }, { h: "Impression", d: "No acute abnormality." }] },
    { tpl: "Pediatrics · Acute visit", patient: "Child, 4 y",
      tokens: ["Child", "is", "irritable", "with", "fever", "up", "to", "38.5", "and", "reports", "ear", "pain.", "Otoscopy", "shows", "an", "erythematous*,", "bulging", "membrane."],
      cmdAt: 12, cmd: "Voice command · “Add diagnosis”",
      note: [{ h: "Symptoms", d: "Ear pain, fever." }, { h: "Exam", d: "Otoscopy — erythema." }, { h: "Assessment", d: "Acute otitis media." }] },
    { tpl: "Dermatology · Consult", patient: "N. Foster",
      tokens: ["Complains", "of", "a", "rash", "and", "itching", "over", "the", "flexural", "surfaces.", "Skin", "is", "dry", "with", "erythema", "and", "lichenification*."],
      cmdAt: 11, cmd: "Voice command · “New section”",
      note: [{ h: "Symptoms", d: "Rash, itching." }, { h: "Exam", d: "Erythema, dryness." }, { h: "Assessment", d: "Atopic dermatitis." }] },
    { tpl: "Orthopedics · Urgent care", patient: "R. Baker",
      tokens: ["Injury", "to", "the", "right", "ankle", "while", "running.", "Swelling", "over", "the", "lateral", "malleolus,", "weight", "bearing", "is", "limited*,", "movement", "painful."],
      cmdAt: 12, cmd: "Voice command · “Order X-ray”",
      note: [{ h: "Symptoms", d: "Pain, swelling." }, { h: "Exam", d: "Lateral malleolus swelling." }, { h: "Assessment", d: "Ligament sprain." }] },
    { tpl: "Gastroenterology · Visit", patient: "S. Clarke",
      tokens: ["Reports", "epigastric", "pain", "after", "meals", "and", "heartburn.", "Tongue", "is", "coated,", "abdomen", "soft,", "moderately", "tender*", "in", "the", "epigastrium."],
      cmdAt: 12, cmd: "Voice command · “Add prescription”",
      note: [{ h: "Symptoms", d: "Epigastric pain, heartburn." }, { h: "Exam", d: "Epigastric tenderness." }, { h: "Assessment", d: "Chronic gastritis." }] },
    { tpl: "Endocrinology · Review", patient: "L. Palmer",
      tokens: ["Routine", "review", "for", "type", "2", "diabetes.", "Fasting", "glucose", "7.8,", "HbA1c", "7.1", "percent.", "No", "episodes", "of", "hypoglycemia*", "reported."],
      cmdAt: 12, cmd: "Voice command · “Update plan”",
      note: [{ h: "Symptoms", d: "No hypoglycemia." }, { h: "Exam", d: "Glucose 7.8, HbA1c 7.1%." }, { h: "Assessment", d: "T2DM, sub-optimal control." }] },
    { tpl: "Neurology · Initial visit", patient: "V. Snyder",
      tokens: ["Describes", "a", "throbbing", "one-sided", "headache", "with", "photophobia.", "Neurological", "exam", "shows", "no", "focal*", "deficits.", "No", "meningeal", "signs", "present."],
      cmdAt: 12, cmd: "Voice command · “New section”",
      note: [{ h: "Symptoms", d: "One-sided headache." }, { h: "Exam", d: "No focal deficit." }, { h: "Assessment", d: "Migraine without aura." }] },
    { tpl: "ENT · Visit", patient: "Y. Grant",
      tokens: ["Complains", "of", "a", "sore", "throat", "and", "difficulty", "swallowing.", "Pharynx", "is", "erythematous,", "tonsils", "enlarged", "with", "exudate*,", "nodes", "tender."],
      cmdAt: 12, cmd: "Voice command · “Add diagnosis”",
      note: [{ h: "Symptoms", d: "Sore throat, dysphagia." }, { h: "Exam", d: "Pharyngeal erythema, exudate." }, { h: "Assessment", d: "Acute pharyngitis." }] },
  ],
  ar: [
    { tpl: "رعاية أولية · زيارة أولى", patient: "المريض ج. كارتر",
      tokens: ["يشكو", "المريض", "من", "سعال", "منتج", "وحمى", "خفيفة", "منذ", "يومين.", "عند", "الفحص،", "الصدر", "سليم", "عند", "التسمع*،", "تشبّع", "الأكسجين", "98%."],
      cmdAt: 14, cmd: "أمر صوتي · «قسم جديد»",
      note: [{ h: "الأعراض", d: "سعال منتج، يومان. حمى خفيفة." }, { h: "الفحص", d: "الصدر سليم عند التسمع. تشبّع الأكسجين 98%." }, { h: "التقييم", d: "التهاب شعبي حاد." }] },
    { tpl: "أمراض القلب · متابعة", patient: "المريض أ. ريد",
      tokens: ["يفيد", "بصداع", "وخفقان", "عرضي.", "ضغط", "الدم", "150", "على", "95،", "النبض", "82", "ومنتظم.", "أصوات", "القلب", "مكتومة*."],
      cmdAt: 12, cmd: "أمر صوتي · «قياس ضغط الدم»",
      note: [{ h: "الأعراض", d: "صداع، خفقان." }, { h: "الفحص", d: "ضغط الدم 150/95، النبض 82." }, { h: "التقييم", d: "ارتفاع ضغط الدم من الدرجة الثانية." }] },
    { tpl: "الأشعة · تقرير", patient: "المريض م. دويل",
      tokens: ["صورة", "أشعة", "أمامية", "للصدر.", "حقول", "الرئة", "صافية،", "لا", "كثافات", "بؤرية", "أو", "ارتشاحية*", "مُحدَّدة.", "الزوايا", "الضلعية", "الحجابية", "حادة."],
      cmdAt: 12, cmd: "أمر صوتي · «إدراج قالب»",
      note: [{ h: "التقنية", d: "صورة أشعة أمامية للصدر." }, { h: "الموجودات", d: "لا كثافات بؤرية." }, { h: "الانطباع", d: "لا شذوذ حاد." }] },
    { tpl: "طب الأطفال · زيارة حادة", patient: "طفل، 4 سنوات",
      tokens: ["الطفل", "متهيّج", "مع", "حمى", "تصل", "إلى", "38.5", "ويشكو", "من", "ألم", "في", "الأذن.", "يُظهر", "تنظير", "الأذن", "غشاءً", "محتقنًا*", "ومنتفخًا."],
      cmdAt: 12, cmd: "أمر صوتي · «إضافة تشخيص»",
      note: [{ h: "الأعراض", d: "ألم في الأذن، حمى." }, { h: "الفحص", d: "تنظير الأذن — احتقان." }, { h: "التقييم", d: "التهاب أذن وسطى حاد." }] },
    { tpl: "الأمراض الجلدية · استشارة", patient: "المريض ن. فوستر",
      tokens: ["يشكو", "من", "طفح", "جلدي", "وحكة", "على", "المناطق", "الثنيّة.", "الجلد", "جاف", "مع", "احمرار", "وتحزّز*."],
      cmdAt: 11, cmd: "أمر صوتي · «قسم جديد»",
      note: [{ h: "الأعراض", d: "طفح جلدي، حكة." }, { h: "الفحص", d: "احمرار، جفاف." }, { h: "التقييم", d: "التهاب جلد تأتبي." }] },
    { tpl: "جراحة العظام · رعاية عاجلة", patient: "المريض ر. بيكر",
      tokens: ["إصابة", "في", "الكاحل", "الأيمن", "أثناء", "الجري.", "تورّم", "فوق", "الكعب", "الوحشي،", "تحمّل", "الوزن", "محدود*،", "الحركة", "مؤلمة."],
      cmdAt: 12, cmd: "أمر صوتي · «طلب أشعة سينية»",
      note: [{ h: "الأعراض", d: "ألم، تورّم." }, { h: "الفحص", d: "تورّم الكعب الوحشي." }, { h: "التقييم", d: "التواء رباطي." }] },
    { tpl: "أمراض الجهاز الهضمي · زيارة", patient: "المريض س. كلارك",
      tokens: ["يفيد", "بألم", "شرسوفي", "بعد", "الوجبات", "وحرقة", "معدة.", "اللسان", "مطليّ،", "البطن", "ليّن،", "مؤلم*", "باعتدال", "في", "المنطقة", "الشرسوفية."],
      cmdAt: 12, cmd: "أمر صوتي · «إضافة وصفة»",
      note: [{ h: "الأعراض", d: "ألم شرسوفي، حرقة معدة." }, { h: "الفحص", d: "ألم شرسوفي عند الجس." }, { h: "التقييم", d: "التهاب معدة مزمن." }] },
    { tpl: "الغدد الصماء · مراجعة", patient: "المريض ل. بالمر",
      tokens: ["مراجعة", "روتينية", "لداء", "السكري", "من", "النوع", "الثاني.", "جلوكوز", "الصيام", "7.8،", "الخضاب", "السكري", "7.1", "بالمئة.", "لم", "تُبلَّغ", "نوبات", "نقص", "سكر", "الدم*."],
      cmdAt: 12, cmd: "أمر صوتي · «تحديث الخطة»",
      note: [{ h: "الأعراض", d: "لا نقص سكر في الدم." }, { h: "الفحص", d: "الجلوكوز 7.8، الخضاب السكري 7.1%." }, { h: "التقييم", d: "سكري النوع الثاني، ضبط دون الأمثل." }] },
    { tpl: "طب الأعصاب · زيارة أولى", patient: "المريض ف. سنايدر",
      tokens: ["يصف", "صداعًا", "نابضًا", "في", "جانب", "واحد", "مع", "رهاب", "الضوء.", "الفحص", "العصبي", "لا", "يُظهر", "عجوزًا", "بؤرية*.", "لا", "توجد", "علامات", "سحائية."],
      cmdAt: 12, cmd: "أمر صوتي · «قسم جديد»",
      note: [{ h: "الأعراض", d: "صداع في جانب واحد." }, { h: "الفحص", d: "لا عجز بؤري." }, { h: "التقييم", d: "شقيقة دون أورة." }] },
    { tpl: "الأنف والأذن والحنجرة · زيارة", patient: "المريض ي. غرانت",
      tokens: ["يشكو", "من", "التهاب", "الحلق", "وصعوبة", "البلع.", "البلعوم", "محتقن،", "اللوزتان", "متضخمتان", "مع", "نضح*،", "العقد", "مؤلمة."],
      cmdAt: 12, cmd: "أمر صوتي · «إضافة تشخيص»",
      note: [{ h: "الأعراض", d: "التهاب الحلق، عسر البلع." }, { h: "الفحص", d: "احتقان البلعوم، نضح." }, { h: "التقييم", d: "التهاب بلعوم حاد." }] },
  ],
  es: [
    { tpl: "Atención primaria · Primera visita", patient: "J. Carter",
      tokens: ["El", "paciente", "refiere", "tos", "productiva", "y", "febrícula", "de", "dos", "días", "de", "evolución.", "A", "la", "exploración,", "auscultación*", "pulmonar", "normal,", "saturación", "98%."],
      cmdAt: 13, cmd: "Comando de voz · «Nueva sección»",
      note: [{ h: "Síntomas", d: "Tos productiva, 2 días. Febrícula." }, { h: "Exploración", d: "Auscultación pulmonar normal. SpO₂ 98%." }, { h: "Valoración", d: "Bronquitis aguda." }] },
    { tpl: "Cardiología · Revisión", patient: "A. Reed",
      tokens: ["Refiere", "cefalea", "y", "palpitaciones", "ocasionales.", "Presión", "arterial", "150", "sobre", "95,", "pulso", "82", "y", "rítmico.", "Tonos", "cardíacos", "apagados*."],
      cmdAt: 12, cmd: "Comando de voz · «Medir la TA»",
      note: [{ h: "Síntomas", d: "Cefalea, palpitaciones." }, { h: "Exploración", d: "TA 150/95, FC 82." }, { h: "Valoración", d: "Hipertensión de grado 2." }] },
    { tpl: "Radiología · Informe", patient: "M. Doyle",
      tokens: ["Radiografía", "de", "tórax", "frontal.", "Campos", "pulmonares", "libres,", "sin", "opacidades", "focales", "ni", "infiltrativas*.", "Senos", "costofrénicos", "libres."],
      cmdAt: 11, cmd: "Comando de voz · «Insertar plantilla»",
      note: [{ h: "Técnica", d: "Radiografía de tórax frontal." }, { h: "Hallazgos", d: "Sin opacidades focales." }, { h: "Impresión", d: "Sin alteraciones agudas." }] },
    { tpl: "Pediatría · Visita urgente", patient: "Niño, 4 a.",
      tokens: ["Niño", "irritable", "con", "fiebre", "de", "hasta", "38.5", "y", "otalgia.", "La", "otoscopia", "muestra", "una", "membrana", "eritematosa*", "y", "abombada."],
      cmdAt: 11, cmd: "Comando de voz · «Añadir diagnóstico»",
      note: [{ h: "Síntomas", d: "Otalgia, fiebre." }, { h: "Exploración", d: "Otoscopia — eritema." }, { h: "Valoración", d: "Otitis media aguda." }] },
    { tpl: "Dermatología · Consulta", patient: "N. Foster",
      tokens: ["Refiere", "erupción", "y", "prurito", "en", "las", "superficies", "flexoras.", "Piel", "seca", "con", "eritema", "y", "liquenificación*."],
      cmdAt: 10, cmd: "Comando de voz · «Nueva sección»",
      note: [{ h: "Síntomas", d: "Erupción, prurito." }, { h: "Exploración", d: "Eritema, sequedad." }, { h: "Valoración", d: "Dermatitis atópica." }] },
    { tpl: "Traumatología · Urgencias", patient: "R. Baker",
      tokens: ["Lesión", "del", "tobillo", "derecho", "corriendo.", "Tumefacción", "del", "maléolo", "lateral,", "apoyo", "limitado*,", "movilidad", "dolorosa."],
      cmdAt: 10, cmd: "Comando de voz · «Solicitar radiografía»",
      note: [{ h: "Síntomas", d: "Dolor, tumefacción." }, { h: "Exploración", d: "Tumefacción del maléolo lateral." }, { h: "Valoración", d: "Esguince ligamentoso." }] },
    { tpl: "Digestivo · Consulta", patient: "S. Clarke",
      tokens: ["Refiere", "dolor", "epigástrico", "tras", "las", "comidas", "y", "pirosis.", "Lengua", "saburral,", "abdomen", "blando,", "moderadamente", "doloroso*", "en", "epigastrio."],
      cmdAt: 12, cmd: "Comando de voz · «Añadir prescripción»",
      note: [{ h: "Síntomas", d: "Dolor epigástrico, pirosis." }, { h: "Exploración", d: "Dolor a la palpación epigástrica." }, { h: "Valoración", d: "Gastritis crónica." }] },
    { tpl: "Endocrinología · Revisión", patient: "L. Palmer",
      tokens: ["Revisión", "rutinaria", "de", "diabetes", "tipo", "2.", "Glucosa", "en", "ayunas", "7.8,", "HbA1c", "7.1", "por", "ciento.", "No", "refiere", "hipoglucemias*."],
      cmdAt: 12, cmd: "Comando de voz · «Actualizar el plan»",
      note: [{ h: "Síntomas", d: "Sin hipoglucemias." }, { h: "Exploración", d: "Glucosa 7.8, HbA1c 7.1%." }, { h: "Valoración", d: "DM2 con control subóptimo." }] },
    { tpl: "Neurología · Primera visita", patient: "V. Snyder",
      tokens: ["Describe", "una", "cefalea", "pulsátil", "unilateral", "con", "fotofobia.", "La", "exploración", "neurológica", "no", "muestra", "déficits", "focales*.", "Sin", "signos", "meníngeos."],
      cmdAt: 13, cmd: "Comando de voz · «Nueva sección»",
      note: [{ h: "Síntomas", d: "Cefalea unilateral." }, { h: "Exploración", d: "Sin déficit focal." }, { h: "Valoración", d: "Migraña sin aura." }] },
    { tpl: "Otorrinolaringología · Consulta", patient: "Y. Grant",
      tokens: ["Refiere", "odinofagia", "y", "dificultad", "para", "tragar.", "Faringe", "eritematosa,", "amígdalas", "aumentadas", "con", "exudado*,", "adenopatías", "dolorosas."],
      cmdAt: 11, cmd: "Comando de voz · «Añadir diagnóstico»",
      note: [{ h: "Síntomas", d: "Odinofagia, disfagia." }, { h: "Exploración", d: "Eritema faríngeo, exudado." }, { h: "Valoración", d: "Faringitis aguda." }] },
  ],
  pt: [
    { tpl: "Medicina geral · Primeira consulta", patient: "J. Carter",
      tokens: ["O", "doente", "refere", "tosse", "produtiva", "e", "febrícula", "com", "dois", "dias", "de", "evolução.", "Ao", "exame,", "auscultação*", "pulmonar", "normal,", "saturação", "98%."],
      cmdAt: 13, cmd: "Comando de voz · «Nova secção»",
      note: [{ h: "Sintomas", d: "Tosse produtiva, 2 dias. Febrícula." }, { h: "Exame", d: "Auscultação pulmonar normal. SpO₂ 98%." }, { h: "Avaliação", d: "Bronquite aguda." }] },
    { tpl: "Cardiologia · Consulta de seguimento", patient: "A. Reed",
      tokens: ["Refere", "cefaleia", "e", "palpitações", "ocasionais.", "Pressão", "arterial", "150", "sobre", "95,", "pulso", "82", "e", "rítmico.", "Sons", "cardíacos", "abafados*."],
      cmdAt: 12, cmd: "Comando de voz · «Medir a TA»",
      note: [{ h: "Sintomas", d: "Cefaleia, palpitações." }, { h: "Exame", d: "TA 150/95, FC 82." }, { h: "Avaliação", d: "Hipertensão de grau 2." }] },
    { tpl: "Radiologia · Relatório", patient: "M. Doyle",
      tokens: ["Radiografia", "do", "tórax", "em", "incidência", "frontal.", "Campos", "pulmonares", "livres,", "sem", "opacidades", "focais", "ou", "infiltrativas*.", "Seios", "costofrénicos", "livres."],
      cmdAt: 12, cmd: "Comando de voz · «Inserir modelo»",
      note: [{ h: "Técnica", d: "Radiografia do tórax frontal." }, { h: "Achados", d: "Sem opacidades focais." }, { h: "Impressão", d: "Sem alterações agudas." }] },
    { tpl: "Pediatria · Consulta urgente", patient: "Criança, 4 a.",
      tokens: ["Criança", "irritável,", "com", "febre", "até", "38.5", "e", "otalgia.", "A", "otoscopia", "mostra", "uma", "membrana", "eritematosa*", "e", "abaulada."],
      cmdAt: 11, cmd: "Comando de voz · «Adicionar diagnóstico»",
      note: [{ h: "Sintomas", d: "Otalgia, febre." }, { h: "Exame", d: "Otoscopia — eritema." }, { h: "Avaliação", d: "Otite média aguda." }] },
    { tpl: "Dermatologia · Consulta", patient: "N. Foster",
      tokens: ["Refere", "erupção", "e", "prurido", "nas", "superfícies", "flexoras.", "Pele", "seca,", "com", "eritema", "e", "liquenificação*."],
      cmdAt: 10, cmd: "Comando de voz · «Nova secção»",
      note: [{ h: "Sintomas", d: "Erupção, prurido." }, { h: "Exame", d: "Eritema, secura." }, { h: "Avaliação", d: "Dermatite atópica." }] },
    { tpl: "Ortopedia · Urgência", patient: "R. Baker",
      tokens: ["Lesão", "do", "tornozelo", "direito", "durante", "a", "corrida.", "Edema", "do", "maléolo", "lateral,", "apoio", "limitado*,", "mobilidade", "dolorosa."],
      cmdAt: 12, cmd: "Comando de voz · «Pedir radiografia»",
      note: [{ h: "Sintomas", d: "Dor, edema." }, { h: "Exame", d: "Edema do maléolo lateral." }, { h: "Avaliação", d: "Entorse ligamentar." }] },
    { tpl: "Gastrenterologia · Consulta", patient: "S. Clarke",
      tokens: ["Refere", "dor", "epigástrica", "após", "as", "refeições", "e", "pirose.", "Língua", "saburrosa,", "abdómen", "mole,", "moderadamente", "doloroso*", "no", "epigastro."],
      cmdAt: 12, cmd: "Comando de voz · «Adicionar prescrição»",
      note: [{ h: "Sintomas", d: "Dor epigástrica, pirose." }, { h: "Exame", d: "Dor à palpação epigástrica." }, { h: "Avaliação", d: "Gastrite crónica." }] },
    { tpl: "Endocrinologia · Revisão", patient: "L. Palmer",
      tokens: ["Revisão", "de", "rotina", "de", "diabetes", "tipo", "2.", "Glicemia", "em", "jejum", "7.8,", "HbA1c", "7.1", "por", "cento.", "Sem", "episódios", "de", "hipoglicemia*."],
      cmdAt: 12, cmd: "Comando de voz · «Atualizar o plano»",
      note: [{ h: "Sintomas", d: "Sem hipoglicemias." }, { h: "Exame", d: "Glicemia 7.8, HbA1c 7.1%." }, { h: "Avaliação", d: "DM2 com controlo subótimo." }] },
    { tpl: "Neurologia · Primeira consulta", patient: "V. Snyder",
      tokens: ["Descreve", "uma", "cefaleia", "pulsátil", "unilateral", "com", "fotofobia.", "O", "exame", "neurológico", "não", "mostra", "défices", "focais*.", "Sem", "sinais", "meníngeos."],
      cmdAt: 13, cmd: "Comando de voz · «Nova secção»",
      note: [{ h: "Sintomas", d: "Cefaleia unilateral." }, { h: "Exame", d: "Sem défice focal." }, { h: "Avaliação", d: "Enxaqueca sem aura." }] },
    { tpl: "Otorrinolaringologia · Consulta", patient: "Y. Grant",
      tokens: ["Refere", "odinofagia", "e", "dificuldade", "em", "engolir.", "Faringe", "eritematosa,", "amígdalas", "aumentadas", "com", "exsudado*,", "gânglios", "dolorosos."],
      cmdAt: 11, cmd: "Comando de voz · «Adicionar diagnóstico»",
      note: [{ h: "Sintomas", d: "Odinofagia, disfagia." }, { h: "Exame", d: "Eritema faríngeo, exsudado." }, { h: "Avaliação", d: "Faringite aguda." }] },
  ],
};

// Fixed waveform silhouette (percent heights) — animated via CSS.
const WAVE = [22, 40, 30, 58, 44, 72, 52, 88, 60, 46, 74, 34, 64, 48, 82, 56,
  38, 68, 50, 78, 42, 60, 32, 54, 46, 70, 36, 62, 44, 80, 52, 66];

const pad2 = (x) => String(x).padStart(2, "0");
const fmt = (s) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

// Delay (ms) before the next word appears — paced to natural speech:
// longer words take longer to say, and we pause at commas / sentence ends.
const wordDelay = (tk) => {
  const w = (tk || "").replace(/\*$/, "");
  let ms = 270 + w.length * 26;
  if (/[.!?]$/.test(w)) ms += 480;          // sentence break
  else if (/[,;:—]$/.test(w)) ms += 240;    // clause break
  return ms;
};

function HeroDemo({ lang, navigate }) {
  const list = SCRIPTS[lang] || SCRIPTS.en;
  const [idx, setIdx] = React.useState(0);   // which dictation (0..9)
  const [n, setN] = React.useState(0);       // tokens revealed
  const [playing, setPlaying] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(0);   // live recording clock (s)

  const d = list[idx % list.length];
  const total = d.tokens.length;

  // Live elapsed clock — counts up in real time while recording, the way a
  // real dictaphone does (this is live speech-to-text, so there is no fixed
  // track length to scrub). Resets whenever the dictation changes.
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);
  React.useEffect(() => { setElapsed(0); }, [idx]);

  // Reveal one word at a time, each scheduled with its own natural delay
  // (self-rescheduling timeout, not a fixed interval). When the note is
  // complete we linger, then roll to the next dictation. The effect re-runs
  // on every `n` change, so the pacing follows `wordDelay` word by word.
  React.useEffect(() => {
    if (!playing) return;
    const delay = n < total ? wordDelay(d.tokens[n]) : 2600 /* hold on finished note */;
    const id = setTimeout(() => {
      if (n < total) setN(n + 1);
      else { setIdx((i) => (i + 1) % list.length); setN(0); }
    }, delay);
    return () => clearTimeout(id);
  }, [playing, n, idx, total, d, list.length]);

  // Reset the stream when the language (and therefore the script set) changes.
  React.useEffect(() => { setIdx(0); setN(0); }, [lang]);

  const go = (i) => { setN(0); setIdx(i); setPlaying(true); };
  const restart = () => { setN(0); setElapsed(0); setPlaying(true); };
  const next = () => go((idx + 1) % list.length);

  const done = n >= total;
  const revealed = done ? d.note.length : Math.floor((n / total) * d.note.length);
  const showCmd = n > d.cmdAt;
  const uk = lang === "uk";

  return (
    <div className="lp-demo">
      <div className="lp-demo-bar">
        <span className="lp-demo-dots"><i /><i /><i /></span>
        <span className="lp-demo-title"><Icon name="waveform" size={13} /> Dictate</span>
        <span className="lp-demo-tpl">{d.tpl}</span>
      </div>

      <div className="lp-demo-body">
        <div className="lp-demo-head">
          <span className={`lp-demo-rec${done ? " is-done" : ""}`}>
            <span className="lp-demo-pulse" />
            {done ? (uk ? "Готово" : "Ready") : (uk ? "Запис" : "Recording")}
          </span>
          <span className="lp-demo-time">{fmt(elapsed)}</span>
          <span className="lp-demo-patient"><Icon name="user" size={12} /> {d.patient}</span>
        </div>

        <div className={`lp-demo-wave${done || !playing ? " is-idle" : ""}`} aria-hidden="true">
          {WAVE.map((h, i) => (
            <span key={i} style={{ height: `${h}%`, animationDelay: `${(i % 8) * 0.08}s` }} />
          ))}
        </div>

        <div className="lp-demo-transcript" aria-hidden="true">
          {d.tokens.slice(0, n).map((tk, i) => {
            const lc = tk.endsWith("*");
            return <span className={`lp-demo-word${lc ? " lc" : ""}`} key={i}>{lc ? tk.slice(0, -1) : tk} </span>;
          })}
          {!done && playing && <span className="lp-demo-caret" />}
        </div>

        <div className={`lp-demo-cmd${showCmd ? " in" : ""}`}><Icon name="check" size={12} /> {d.cmd}</div>

        <div className="lp-demo-note">
          {d.note.map((s, i) => (
            <div className={`lp-demo-sec${i < revealed ? " in" : ""}`} key={i}>
              <span className="lp-demo-sec-h">{s.h}</span>
              <span className="lp-demo-sec-d">{s.d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Real transport controls + a working Sign CTA */}
      <div className="lp-demo-foot">
        <div className="lp-demo-transport">
          <button className="lp-demo-ctrl" onClick={restart} aria-label={uk ? "Спочатку" : "Restart"}>
            <Icon name="refresh" size={16} />
          </button>
          <button className="lp-demo-ctrl is-play" onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? (uk ? "Пауза" : "Pause") : (uk ? "Відтворити" : "Play")}>
            <Icon name={playing ? "pause" : "play"} size={18} />
          </button>
          <button className="lp-demo-ctrl" onClick={next} aria-label={uk ? "Наступний запис" : "Next dictation"}>
            <Icon name="chevRight" size={18} />
          </button>
        </div>
        <button className="lp-demo-btn primary" onClick={() => navigate && navigate("/signup")}>
          <Icon name="sign" size={13} /> {uk ? "Підписати · Дія" : "Sign · Дія"}
        </button>
      </div>
    </div>
  );
}

/* ── Hero background waveform ──────────────────────────────────────────────
 * A bar waveform lying across the back of the first screen — the product's own
 * subject matter used as the page's texture, since what Klarnote does all day
 * is listen to one.
 *
 * The heights are computed ONCE at module load from two sine waves of
 * unrelated frequency beating against each other. Not Math.random(): a real
 * random envelope re-rolls on every render and, more to the point, looks
 * random — evenly noisy — whereas speech clusters into loud runs and quiet
 * runs, which is what two out-of-phase sines produce. The ^1.5 pushes the
 * quiet bars further down so the loud ones read as peaks rather than as a hedge
 * trimmed flat.
 *
 * Purely decorative: `aria-hidden`, and no meaning is carried by it. The
 * animation lives in marketing-motion.css and stops dead under
 * prefers-reduced-motion, where the bars simply stand still.
 */
const HERO_WAVE_BARS = 72;
const HERO_WAVE = Array.from({ length: HERO_WAVE_BARS }, (_, i) => {
  const fast = Math.sin(i * 0.42) * 0.5 + 0.5;
  const slow = Math.sin(i * 0.11 + 1.7) * 0.5 + 0.5;
  const mixed = fast * 0.55 + slow * 0.45;
  return +(0.14 + 0.86 * Math.pow(mixed, 1.5)).toFixed(3);
});

/**
 * The bars themselves, so the hero and the closing CTA band draw the SAME
 * signal rather than two waveforms that nearly match. Only the class differs
 * — each caller owns its own colour, size and phase in CSS.
 */
function WaveBars({ className }) {
  return (
    <div className={className} aria-hidden="true">
      {HERO_WAVE.map((h, i) => (
        <i key={i} style={{ "--h": h, "--i": i }} />
      ))}
    </div>
  );
}

function HeroWave() {
  return <WaveBars className="lp-hero-wave" />;
}

export function LandingPage({ navigate, lang = "en", tweaks, setTweak }) {
  const c = COPY[lang] || COPY.en;
  const pos = positioning(lang);
  const loop = pillars(lang);
  const moat = moatItems(lang);

  const go = (path) => (e) => { e.preventDefault(); navigate(path); };
  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      {/* ── Hero ─────────────────────────────────────────── */}
        <section className="lp-hero">
          <HeroWave />
          <div className="lp-hero-text">
            {/* The category, not a tagline. It is the first thing said on the
                page and it comes from the same file the rest of the story does. */}
            <span className="lp-eyebrow"><Icon name="shield" size={13} /> {pos.category}</span>
            <h1 className="lp-h1">{c.hero.title}</h1>
            <p className="lp-lead">{c.hero.sub}</p>
            <div className="lp-hero-cta">
              <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{c.hero.ctaPrimary}</a>
              <a className="btn lp-cta-lg" href="#features" onClick={jump("features")}>{c.hero.ctaSecondary}</a>
            </div>
            {/* The three claims, one chip each. They arrive from COPY as a
                single bullet-separated line — the split keeps eleven
                translations writing one string instead of an array. */}
            <div className="lp-hero-note">
              {c.hero.note.split("•").map((claim, i) => (
                <span className="lp-note-chip" key={i}>{claim.trim()}</span>
              ))}
            </div>

            {/* What it is hearing. The same readout the evidence band carries,
                on paper instead of ink — the hero says Klarnote listens to the
                consultation, and this is the only thing on the first screen
                that shows it rather than asserting it. Cycles on its own; the
                band further down drives its copy from whichever cluster is
                lit. See marketing/VoiceReadout.jsx. */}
            <VoiceReadout
              lines={HERO_SEQUENCE.map((k) => DICTATIONS[k])}
              tone="light"
              lang={lang}
              label={tr(lang, "Чує", "Hears")}
            />
          </div>

        </section>

        {/* ── The loop, running ────────────────────────────────
            Replaces the dictaphone demo that used to close the hero. That card
            showed the INPUT — a waveform turning into text — at the point where
            the reader is still deciding whether any of this matters, and
            dictation is the one part of the category a reader already assumes
            works. This shows the whole pipeline instead: spoken → structured →
            checked → coded → signed → delivered, one step at a time. See
            marketing/WorkflowGraph.jsx; the citations and codes in it are
            real, and the unbuilt stage is badged. */}
        <WorkflowGraph lang={lang} navigate={navigate} />

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

        {/* ── The closed loop ──────────────────────────────────
            The centre of the positioning, and the reason the old
            "two products" and "01/02/03 workflow" sections are gone: they
            told the same story twice and neither said what the platform IS.
            Copy comes from positioning.js so the landing page, /platform and
            the three pillar pages cannot drift apart. */}
        <section className="lp-section lp-section-alt" id="product">
          <div className="lp-head">
            <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {pos.loop.eyebrow}</span>
            <h2 className="lp-h2">{pos.loop.title}</h2>
            <p className="lp-sub">{pos.loop.sub}</p>
          </div>
          <div className="lp-loop">
            {loop.map((p) => (
              <article className="lp-pillar" key={p.key}>
                {/* icon —————— 01. The rule ties the two ends of the row
                    together; without it the step number floated in the corner
                    with nothing to belong to. */}
                <div className="lp-pillar-h">
                  <span className="lp-pillar-icon"><Icon name={p.icon} size={20} /></span>
                  <span className="lp-pillar-rule" aria-hidden="true" />
                  <span className="lp-pillar-n">{p.n}</span>
                </div>
                <h3 className="lp-pillar-t">
                  {p.verb}
                  <span className="lp-pillar-brand">{p.brand}</span>
                </h3>
                <p className="lp-pillar-d">{p.tagline}</p>
                <ul className="lp-pillar-points">
                  {p.points.map((pt, j) => (
                    <li key={j}><Icon name="check" size={14} /> <span>{pt}</span></li>
                  ))}
                </ul>
                {/* Not built yet, and said so on the card rather than in a
                    footnote nobody reads — but as its own strip, not as a
                    fourth bullet wearing a different icon. See positioning.js. */}
                {p.soon?.length > 0 && (
                  <div className="lp-pillar-soon">
                    <span className="lp-soon">{pos.soonLabel}</span>
                    <ul>
                      {p.soon.map((pt, j) => <li key={j}>{pt}</li>)}
                    </ul>
                  </div>
                )}
                <a className="lp-pillar-more" href={`#${p.path}`} onClick={go(p.path)}>
                  {tr(lang, "Докладніше", "Learn more")} <Icon name="arrowRight" size={14} />
                </a>
              </article>
            ))}
          </div>
          <div className="lp-loop-foot">
            <p className="lp-loop-goal"><Icon name="clock" size={14} /> {pos.loop.foot}</p>
            <p className="lp-loop-safety"><Icon name="user" size={14} /> {pos.loop.safety}</p>
            <a className="btn lp-cta-lg" href="#/platform" onClick={go("/platform")}>{pos.loop.more}</a>
          </div>
        </section>

        {/* ── Where it works ───────────────────────────────── */}
        <section className="lp-section lp-section-alt" id="settings">
          <div className="lp-head">
            <h2 className="lp-h2">{c.settingsTitle}</h2>
            <p className="lp-sub">{c.settingsSub}</p>
          </div>
          <div className="lp-grid lp-grid-4">
            {c.settings.map((st, i) => (
              <a className="lp-feature mk-feature-link" href={`#${st.path}`} onClick={go(st.path)} key={i}>
                <div className="lp-feature-icon"><Icon name={st.icon} size={18} /></div>
                <h3 className="lp-feature-t">{st.t}</h3>
                <p className="lp-feature-d">{st.d}</p>
                <span className="mk-card-more">{tr(lang, "Шаблон", "See the template")} <Icon name="arrowRight" size={14} /></span>
              </a>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section className="lp-section" id="features">
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
                <span className="mk-card-more">{tr(lang, "Докладніше", "Learn more")} <Icon name="arrowRight" size={14} /></span>
              </a>
            ))}
          </div>
          <div className="lp-section-cta">
            <a className="btn lp-cta-lg" href="#/features" onClick={go("/features")}>{tr(lang, "Усі можливості", "All features")}</a>
          </div>
        </section>

        {/* ── The moat ─────────────────────────────────────────
            Why the loop is not reproducible by wiring three vendors
            together. This is the section a competitor's prospect reads. */}
        <section className="lp-section lp-section-alt" id="why">
          <div className="lp-head">
            <h2 className="lp-h2">{pos.moat.title}</h2>
            <p className="lp-sub">{pos.moat.sub}</p>
          </div>
          <div className="lp-grid lp-grid-3">
            {moat.map((m, i) => (
              <div className="lp-feature" key={i}>
                <div className="lp-feature-icon"><Icon name={m.icon} size={18} /></div>
                <h3 className="lp-feature-t">{m.t}</h3>
                <p className="lp-feature-d">{m.d}</p>
              </div>
            ))}
          </div>
          {/* The USP, stated once, in the one place a reader has just been
              given the evidence for it. */}
          <blockquote className="lp-usp">{pos.usp}</blockquote>
        </section>

        {/* ── Security ─────────────────────────────────────── */}
        <section className="lp-section" id="security">
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
          {/* The same waveform that opens the page closes it. Weighted to the
              right, where the band is empty — the copy sits left, so the
              signal fills the space instead of running under the headline. */}
          <WaveBars className="lp-cta-wave" />
          <h2 className="lp-cta-title">{c.ctaTitle}</h2>
          <p className="lp-cta-sub">{c.ctaSub}</p>
          <div className="lp-cta-actions">
            <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{c.ctaPrimary}</a>
            <a className="btn lp-cta-lg" href="#/login" onClick={go("/login")}>{c.ctaSecondary}</a>
          </div>
        </section>
    </MarketingShell>
  );
}
