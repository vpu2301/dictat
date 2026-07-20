// LandingPage.jsx — Public marketing landing for Klarnote.
// Sticky menu, hero, products, features, workflow, security, CTA, footer.
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";
import { tr } from "../i18n.js";

/* ── Copy ─────────────────────────────────────────────────────
   One bilingual dictionary keeps the marketing surface readable
   and easy to keep in sync between Ukrainian and English. */
const COPY = {
  uk: {
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека", signin: "Увійти", start: "Запросити доступ" },
    hero: {
      eyebrow: "Медичне диктування нового покоління",
      title: "Клінічна документація голосом — швидко, точно, безпечно",
      sub: "Klarnote перетворює мову лікаря на структуровані медичні нотатки в реальному часі. Менше друку, більше часу для пацієнта.",
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
    workflowTitle: "Від голосу до підписаного документа",
    workflow: [
      { n: "01", t: "Говоріть", d: "Почніть прийом або диктування — Klarnote розпізнає мову в реальному часі." },
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
      eyebrow: "Next-generation medical dictation",
      title: "Clinical documentation by voice — fast, accurate, secure",
      sub: "Klarnote turns a clinician's speech into structured medical notes in real time. Less typing, more time for the patient.",
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
    workflowTitle: "From voice to a signed document",
    workflow: [
      { n: "01", t: "Speak", d: "Start an encounter or dictation — Klarnote recognizes speech in real time." },
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
      eyebrow: "Dyktowanie medyczne nowej generacji",
      title: "Dokumentacja kliniczna głosem — szybko, dokładnie, bezpiecznie",
      sub: "Klarnote zamienia mowę lekarza w ustrukturyzowane notatki medyczne w czasie rzeczywistym. Mniej pisania, więcej czasu dla pacjenta.",
      ctaPrimary: "Zacznij za darmo",
      ctaSecondary: "Zobacz funkcje",
      note: "Modele self-hosted • Dane nigdy nie opuszczają Twojego wdrożenia",
    },
    trust: "Stworzone dla klinik, szpitali i prywatnej praktyki",
    stats: [
      { v: "98%", l: "dokładności rozpoznawania mowy medycznej" },
      { v: "3×", l: "szybciej niż wprowadzanie ręczne" },
      { v: "2 języki", l: "ukraiński i angielski" },
      { v: "24/7", l: "dostęp z dowolnego urządzenia" },
    ],
    principlesTitle: "Zbudowane na trzech niepodważalnych zasadach",
    principlesSub: "To nie marketing, lecz ograniczenia architektoniczne — wbudowane w system, a nie dodane później.",
    principles: [
      { icon: "home", t: "Suwerenność danych", d: "Całe ASR i generowanie działają na self-hosted modelach o otwartych licencjach. Żadne nagranie, transkrypcja ani notatka nigdy nie trafiają do zewnętrznego API." },
      { icon: "user", t: "Lekarz w pętli decyzyjnej", d: "System tworzy szkic, ale nie diagnozuje. Nic nie jest finalizowane automatycznie — ostatnie słowo zawsze należy do lekarza." },
      { icon: "layers", t: "Izolacja tenantów", d: "Kod aplikacji nigdy nie filtruje według tenanta — robi to baza danych poprzez row-level security. Brakujący filtr nie może spowodować wycieku danych." },
    ],
    productsTitle: "Dwa produkty — jeden przepływ pracy",
    productsSub: "Wybierz tryb dla swojego scenariusza: wizyty z asystą głosową lub klasyczne dyktowanie raportów.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Asystent wizyty",
        body: "Prowadzi wizytę razem z Tobą: rejestruje rozmowę z pacjentem, tworzy ustrukturyzowaną notatkę i podpowiada kolejne kroki.",
        points: ["Zgoda pacjenta i wskaźnik nagrywania", "Profile pacjentów i oś czasu wizyt", "Automatyczna struktura notatki"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Dyktowanie raportów",
        body: "Klasyczne dyktowanie dla radiologii, patologii i wypisów — z szablonami, poleceniami głosowymi i porównywaniem wersji.",
        points: ["Szablony raportów i polecenia głosowe", "Porównywanie zmian i korekty", "Eksport, druk i podpis"],
      },
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
    workflowTitle: "Od głosu do podpisanego dokumentu",
    workflow: [
      { n: "01", t: "Mów", d: "Rozpocznij wizytę lub dyktowanie — Klarnote rozpoznaje mowę w czasie rzeczywistym." },
      { n: "02", t: "Sprawdź", d: "Ustrukturyzowana notatka z podświetlonymi niepewnymi miejscami do szybkiej edycji." },
      { n: "03", t: "Podpisz", d: "Podpisz przez Дія i udostępnij link weryfikacyjny." },
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
      eyebrow: "Medizinisches Diktieren der nächsten Generation",
      title: "Klinische Dokumentation per Stimme — schnell, präzise, sicher",
      sub: "Klarnote wandelt ärztliche Sprache in Echtzeit in strukturierte medizinische Notizen um. Weniger Tippen, mehr Zeit für den Patienten.",
      ctaPrimary: "Kostenlos starten",
      ctaSecondary: "Funktionen ansehen",
      note: "Self-hosted Modelle • Daten verlassen niemals Ihr Deployment",
    },
    trust: "Entwickelt für Kliniken, Krankenhäuser und Privatpraxen",
    stats: [
      { v: "98%", l: "Erkennungsgenauigkeit bei medizinischer Sprache" },
      { v: "3×", l: "schneller als manuelle Eingabe" },
      { v: "2 Sprachen", l: "Ukrainisch und Englisch" },
      { v: "24/7", l: "Zugriff von jedem Gerät" },
    ],
    principlesTitle: "Auf drei unverhandelbaren Prinzipien aufgebaut",
    principlesSub: "Kein Marketing, sondern architektonische Vorgaben — fest im System verankert, nicht nachträglich ergänzt.",
    principles: [
      { icon: "home", t: "Datensouveränität", d: "ASR und Generierung laufen vollständig auf self-hosted Modellen mit offener Lizenz. Weder Audio noch Transkripte oder Notizen gehen jemals an eine Drittanbieter-API." },
      { icon: "user", t: "Arzt in der Schleife", d: "Das System erstellt Entwürfe, es diagnostiziert nicht. Nichts wird automatisch finalisiert — das letzte Wort hat immer der Arzt." },
      { icon: "layers", t: "Mandantentrennung", d: "Der Anwendungscode filtert niemals nach Mandanten — das übernimmt die Datenbank per Row-Level Security. Ein fehlender Filter kann keine Daten preisgeben." },
    ],
    productsTitle: "Zwei Produkte — ein Workflow",
    productsSub: "Wählen Sie den Modus für Ihr Szenario: begleitete Sprechstunden oder klassisches Befunddiktat.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Ambient-Scribe",
        body: "Begleitet die Sprechstunde mit Ihnen: erfasst das Patientengespräch, erstellt eine strukturierte Notiz und schlägt nächste Schritte vor.",
        points: ["Patienteneinwilligung & Aufnahmeindikator", "Patientenprofile und Besuchsverlauf", "Automatische Notizstruktur"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Befunddiktat",
        body: "Klassisches Diktieren für Radiologie, Pathologie und Entlassbriefe mit Vorlagen, Sprachbefehlen und Versionsvergleich.",
        points: ["Befundvorlagen und Sprachbefehle", "Änderungsvergleich und Nachträge", "Exportieren, Drucken und Signieren"],
      },
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
    workflowTitle: "Von der Stimme zum signierten Dokument",
    workflow: [
      { n: "01", t: "Sprechen", d: "Starten Sie eine Konsultation oder ein Diktat — Klarnote erkennt Sprache in Echtzeit." },
      { n: "02", t: "Prüfen", d: "Eine strukturierte Notiz mit hervorgehobenen unsicheren Stellen für schnelle Korrekturen." },
      { n: "03", t: "Signieren", d: "Signieren Sie über Дія und teilen Sie einen Verifizierungslink." },
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
      eyebrow: "Dictare medicală de nouă generație",
      title: "Documentație clinică prin voce — rapid, precis, sigur",
      sub: "Klarnote transformă vorbirea medicului în notițe medicale structurate, în timp real. Mai puțin tastat, mai mult timp pentru pacient.",
      ctaPrimary: "Începe gratuit",
      ctaSecondary: "Vezi funcționalitățile",
      note: "Modele self-hosted • Datele nu părăsesc niciodată infrastructura dumneavoastră",
    },
    trust: "Creat pentru clinici, spitale și cabinete private",
    stats: [
      { v: "98%", l: "acuratețe în recunoașterea limbajului medical" },
      { v: "3×", l: "mai rapid decât introducerea manuală" },
      { v: "2 limbi", l: "ucraineană și engleză" },
      { v: "24/7", l: "acces de pe orice dispozitiv" },
    ],
    principlesTitle: "Construit pe trei principii nenegociabile",
    principlesSub: "Nu este marketing, ci constrângeri arhitecturale — integrate în sistem, nu adăugate ulterior.",
    principles: [
      { icon: "home", t: "Suveranitatea datelor", d: "Întregul ASR și generarea rulează pe modele self-hosted, cu licență deschisă. Niciun fișier audio, transcript sau notiță nu ajunge vreodată la un API terț." },
      { icon: "user", t: "Medicul deține controlul", d: "Sistemul redactează, nu diagnostichează. Nimic nu este finalizat automat — medicul are întotdeauna ultimul cuvânt." },
      { icon: "layers", t: "Izolarea tenanților", d: "Codul aplicației nu filtrează niciodată după tenant — o face baza de date, prin row-level security. Un filtru lipsă nu poate provoca scurgeri de date." },
    ],
    productsTitle: "Două produse — un singur flux de lucru",
    productsSub: "Alegeți modul potrivit scenariului dumneavoastră: consultații asistate sau dictare clasică de rapoarte.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Scrib de consultație",
        body: "Conduce consultația împreună cu dumneavoastră: înregistrează conversația cu pacientul, construiește o notiță structurată și sugerează pașii următori.",
        points: ["Consimțământul pacientului și indicator de înregistrare", "Profiluri de pacienți și cronologia vizitelor", "Structură automată a notiței"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Dictare de rapoarte",
        body: "Dictare clasică pentru radiologie, patologie și scrisori de externare, cu șabloane, comenzi vocale și comparare de versiuni.",
        points: ["Șabloane de rapoarte și comenzi vocale", "Compararea modificărilor și amendamente", "Export, tipărire și semnare"],
      },
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
    workflowTitle: "De la voce la un document semnat",
    workflow: [
      { n: "01", t: "Vorbiți", d: "Începeți o consultație sau o dictare — Klarnote recunoaște vorbirea în timp real." },
      { n: "02", t: "Verificați", d: "O notiță structurată, cu pasajele incerte evidențiate pentru corecturi rapide." },
      { n: "03", t: "Semnați", d: "Semnați prin Дія și distribuiți un link de verificare." },
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
      eyebrow: "Lékařské diktování nové generace",
      title: "Klinická dokumentace hlasem — rychle, přesně, bezpečně",
      sub: "Klarnote převádí řeč lékaře na strukturované lékařské záznamy v reálném čase. Méně psaní, více času pro pacienta.",
      ctaPrimary: "Začněte zdarma",
      ctaSecondary: "Prohlédnout funkce",
      note: "Self-hosted modely • Data nikdy neopustí vaše nasazení",
    },
    trust: "Vytvořeno pro kliniky, nemocnice i soukromé praxe",
    stats: [
      { v: "98%", l: "přesnost rozpoznávání lékařské řeči" },
      { v: "3×", l: "rychlejší než ruční zápis" },
      { v: "2 jazyky", l: "ukrajinština a angličtina" },
      { v: "24/7", l: "přístup z jakéhokoli zařízení" },
    ],
    principlesTitle: "Postaveno na třech nekompromisních principech",
    principlesSub: "Ne marketing, ale architektonická omezení — zabudovaná do systému, nikoli doplněná dodatečně.",
    principles: [
      { icon: "home", t: "Suverenita dat", d: "Veškeré rozpoznávání řeči i generování běží na self-hosted modelech s otevřenou licencí. Žádný zvukový záznam, přepis ani poznámka nikdy neputují do API třetí strany." },
      { icon: "user", t: "Lékař má rozhodující slovo", d: "Systém navrhuje, nediagnostikuje. Nic se nedokončuje automaticky — poslední slovo má vždy lékař." },
      { icon: "layers", t: "Izolace tenantů", d: "Aplikační kód nikdy nefiltruje podle tenanta — dělá to databáze pomocí row-level security. Chybějící filtr nemůže způsobit únik dat." },
    ],
    productsTitle: "Dva produkty — jeden pracovní postup",
    productsSub: "Zvolte režim pro váš scénář: ambientní vyšetření, nebo klasické diktování zpráv.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Ambientní zapisovatel",
        body: "Vede návštěvu s vámi: zaznamenává rozhovor s pacientem, vytváří strukturovaný záznam a navrhuje další kroky.",
        points: ["Souhlas pacienta a indikátor nahrávání", "Profily pacientů a časová osa návštěv", "Automatická struktura záznamu"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Diktování zpráv",
        body: "Klasické diktování pro radiologii, patologii a propouštěcí zprávy se šablonami, hlasovými příkazy a porovnáváním verzí.",
        points: ["Šablony zpráv a hlasové příkazy", "Porovnání změn a dodatky", "Export, tisk a podpis"],
      },
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
    workflowTitle: "Od hlasu k podepsanému dokumentu",
    workflow: [
      { n: "01", t: "Mluvte", d: "Zahajte vyšetření nebo diktování — Klarnote rozpoznává řeč v reálném čase." },
      { n: "02", t: "Zkontrolujte", d: "Strukturovaný záznam se zvýrazněnými nejistými místy pro rychlé úpravy." },
      { n: "03", t: "Podepište", d: "Podepište přes Дія a sdílejte ověřovací odkaz." },
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
      eyebrow: "Medicinsko diktiranje nove generacije",
      title: "Klinička dokumentacija glasom — brzo, precizno, bezbedno",
      sub: "Klarnote pretvara govor lekara u strukturirane medicinske beleške u realnom vremenu. Manje kucanja, više vremena za pacijenta.",
      ctaPrimary: "Počnite besplatno",
      ctaSecondary: "Pogledajte funkcije",
      note: "Self-hosted modeli • Podaci nikada ne napuštaju vašu infrastrukturu",
    },
    trust: "Napravljeno za klinike, bolnice i privatne prakse",
    stats: [
      { v: "98%", l: "tačnost prepoznavanja medicinskog govora" },
      { v: "3×", l: "brže od ručnog unosa" },
      { v: "2 jezika", l: "ukrajinski i engleski" },
      { v: "24/7", l: "pristup sa bilo kog uređaja" },
    ],
    principlesTitle: "Izgrađeno na tri principa o kojima se ne pregovara",
    principlesSub: "Ne marketing, već arhitektonska ograničenja — ugrađena u sistem, a ne naknadno dodata.",
    principles: [
      { icon: "home", t: "Suverenitet podataka", d: "Celokupno prepoznavanje govora i generisanje rade na self-hosted modelima sa otvorenom licencom. Nijedan audio-zapis, transkript ni beleška nikada ne odlaze ka API-ju treće strane." },
      { icon: "user", t: "Lekar ima poslednju reč", d: "Sistem sastavlja nacrt, ne postavlja dijagnozu. Ništa se ne finalizuje automatski — poslednju reč uvek ima lekar." },
      { icon: "layers", t: "Izolacija tenanata", d: "Kod aplikacije nikada ne filtrira po tenantu — to radi baza podataka putem row-level security mehanizma. Filter koji nedostaje ne može da izazove curenje podataka." },
    ],
    productsTitle: "Dva proizvoda — jedan radni tok",
    productsSub: "Izaberite režim za svoj scenario: ambijentalne preglede ili klasično diktiranje izveštaja.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Ambijentalni zapisničar",
        body: "Vodi pregled zajedno sa vama: beleži razgovor sa pacijentom, gradi strukturiranu belešku i predlaže sledeće korake.",
        points: ["Saglasnost pacijenta i indikator snimanja", "Profili pacijenata i vremenska linija poseta", "Automatska struktura beleške"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Diktiranje izveštaja",
        body: "Klasično diktiranje za radiologiju, patologiju i otpusne liste, sa šablonima, glasovnim komandama i poređenjem verzija.",
        points: ["Šabloni izveštaja i glasovne komande", "Poređenje izmena i amandmani", "Izvoz, štampanje i potpisivanje"],
      },
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
    workflowTitle: "Od glasa do potpisanog dokumenta",
    workflow: [
      { n: "01", t: "Govorite", d: "Započnite pregled ili diktiranje — Klarnote prepoznaje govor u realnom vremenu." },
      { n: "02", t: "Proverite", d: "Strukturirana beleška sa istaknutim nesigurnim mestima za brze ispravke." },
      { n: "03", t: "Potpišite", d: "Potpišite preko sistema Дія i podelite link za verifikaciju." },
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
      eyebrow: "Új generációs orvosi diktálás",
      title: "Klinikai dokumentáció hanggal — gyorsan, pontosan, biztonságosan",
      sub: "A Klarnote valós időben alakítja az orvos beszédét strukturált orvosi feljegyzésekké. Kevesebb gépelés, több idő a betegre.",
      ctaPrimary: "Kezdje ingyen",
      ctaSecondary: "Funkciók megtekintése",
      note: "Self-hosted modellek • Az adatok soha nem hagyják el az Ön rendszerét",
    },
    trust: "Klinikák, kórházak és magánpraxisok számára készült",
    stats: [
      { v: "98%", l: "pontosság az orvosi beszéd felismerésében" },
      { v: "3×", l: "gyorsabb, mint a kézi bevitel" },
      { v: "2 nyelv", l: "ukrán és angol" },
      { v: "24/7", l: "hozzáférés bármilyen eszközről" },
    ],
    principlesTitle: "Három megkérdőjelezhetetlen alapelvre épül",
    principlesSub: "Nem marketing, hanem architekturális korlátok — a rendszerbe építve, nem utólag hozzáadva.",
    principles: [
      { icon: "home", t: "Adatszuverenitás", d: "A teljes beszédfelismerés és generálás self-hosted, nyílt licencű modelleken fut. Hangfelvétel, átirat vagy feljegyzés soha nem kerül harmadik fél API-jához." },
      { icon: "user", t: "Az orvosé a végső szó", d: "A rendszer vázlatot készít, nem diagnosztizál. Semmi sem véglegesül automatikusan — a végső szó mindig az orvosé." },
      { icon: "layers", t: "Tenant-izoláció", d: "Az alkalmazáskód soha nem szűr tenant szerint — ezt az adatbázis végzi row-level security révén. Egy hiányzó szűrő nem okozhat adatszivárgást." },
    ],
    productsTitle: "Két termék — egyetlen munkafolyamat",
    productsSub: "Válassza ki a helyzetéhez illő módot: ambient vizitek vagy klasszikus leletdiktálás.",
    products: [
      {
        icon: "waveform", tag: "Scribe",
        title: "Ambient jegyzetelő",
        body: "Önnel együtt vezeti a vizitet: rögzíti a beteggel folytatott beszélgetést, strukturált feljegyzést készít, és javaslatot tesz a következő lépésekre.",
        points: ["Betegbeleegyezés és felvételjelző", "Betegprofilok és vizit-idővonal", "Automatikus feljegyzésstruktúra"],
      },
      {
        icon: "fileText", tag: "Dictate",
        title: "Leletdiktálás",
        body: "Klasszikus diktálás radiológiához, patológiához és zárójelentésekhez, sablonokkal, hangparancsokkal és verzió-összehasonlítással.",
        points: ["Leletsablonok és hangparancsok", "Változások összehasonlítása és módosítások", "Exportálás, nyomtatás és aláírás"],
      },
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
    workflowTitle: "A hangtól az aláírt dokumentumig",
    workflow: [
      { n: "01", t: "Beszéljen", d: "Indítson vizitet vagy diktálást — a Klarnote valós időben ismeri fel a beszédet." },
      { n: "02", t: "Ellenőrizze", d: "Strukturált feljegyzés a bizonytalan részek kiemelésével a gyors javításhoz." },
      { n: "03", t: "Írja alá", d: "Írja alá a Дія rendszeren keresztül, és ossza meg az ellenőrző linket." },
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

export function LandingPage({ navigate, lang = "en", tweaks, setTweak }) {
  const c = COPY[lang] || COPY.en;

  const go = (path) => (e) => { e.preventDefault(); navigate(path); };
  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
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

          {/* Interactive dictaphone demo — see HeroDemo above. */}
          <div className="lp-hero-art">
            <HeroDemo lang={lang} navigate={navigate} />
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

        {/* ── Workflow ─────────────────────────────────────── */}
        <section className="lp-section lp-section-alt" id="workflow">
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
