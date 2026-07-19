// PricingPage.jsx — /pricing. Heidi-style pricing, inside the marketing shell.
//
// Four plans (Free · Pro · Team · Enterprise) with a monthly/annual billing
// toggle, a "most popular" highlight, a feature-comparison matrix and an FAQ
// accordion. Localised in 8 languages (uk/en/pl/de/ro/cs/sr/hu); prices are
// placeholders (₴ for uk, $ for every other language).
// This platform is admin-invite-only, so every CTA routes to /signup (the
// create-account / book-a-demo flow) — no self-serve checkout.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";

export function PricingPage({ navigate, lang = "en", tweaks, setTweak }) {
  const uk = lang === "uk";
  const L = (m) => m[lang] ?? m.en;
  const [annual, setAnnual] = useState(true);
  const cur = uk ? "₴" : "$";
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  // Placeholder figures — swap before a real launch.
  const PLANS = [
    {
      id: "free",
      name: L({ uk: "Безкоштовно", en: "Free", pl: "Bezpłatny", de: "Kostenlos", ro: "Gratuit", cs: "Zdarma", sr: "Besplatno", hu: "Ingyenes" }),
      tagline: L({
        uk: "Для окремого лікаря, щоб спробувати.",
        en: "For a solo clinician getting started.",
        pl: "Dla pojedynczego lekarza na start.",
        de: "Für einzelne Ärztinnen und Ärzte zum Einstieg.",
        ro: "Pentru un medic individual, la început de drum.",
        cs: "Pro samostatného lékaře na začátek.",
        sr: "Za pojedinačnog lekara koji počinje.",
        hu: "Egyéni orvosoknak, az induláshoz.",
      }),
      monthly: 0, annual: 0,
      cta: L({ uk: "Почати безкоштовно", en: "Get started free", pl: "Zacznij bezpłatnie", de: "Kostenlos starten", ro: "Începeți gratuit", cs: "Začněte zdarma", sr: "Počnite besplatno", hu: "Kezdje ingyen" }),
      path: "/signup",
      features: [
        L({ uk: "До 20 нотаток на місяць", en: "Up to 20 notes per month", pl: "Do 20 notatek miesięcznie", de: "Bis zu 20 Notizen pro Monat", ro: "Până la 20 de note pe lună", cs: "Až 20 poznámek měsíčně", sr: "Do 20 beleški mesečno", hu: "Havonta legfeljebb 20 jegyzet" }),
        L({ uk: "Диктування в реальному часі", en: "Real-time dictation", pl: "Dyktowanie w czasie rzeczywistym", de: "Diktieren in Echtzeit", ro: "Dictare în timp real", cs: "Diktování v reálném čase", sr: "Diktiranje u realnom vremenu", hu: "Valós idejű diktálás" }),
        L({ uk: "Базові шаблони нотаток", en: "Basic note templates", pl: "Podstawowe szablony notatek", de: "Grundlegende Notizvorlagen", ro: "Șabloane de bază pentru note", cs: "Základní šablony poznámek", sr: "Osnovni šabloni beleški", hu: "Alap jegyzetsablonok" }),
        L({ uk: "Експорт у PDF", en: "Export to PDF", pl: "Eksport do PDF", de: "Export als PDF", ro: "Export în PDF", cs: "Export do PDF", sr: "Izvoz u PDF", hu: "Exportálás PDF-be" }),
      ],
    },
    {
      id: "pro", name: "Pro", popular: true,
      tagline: L({
        uk: "Для активної щоденної практики.",
        en: "For busy day-to-day practice.",
        pl: "Dla intensywnej codziennej praktyki.",
        de: "Für die intensive tägliche Praxis.",
        ro: "Pentru practica zilnică intensă.",
        cs: "Pro rušnou každodenní praxi.",
        sr: "Za užurbanu svakodnevnu praksu.",
        hu: "A mindennapos, intenzív praxishoz.",
      }),
      monthly: uk ? 990 : 29, annual: uk ? 790 : 23,
      cta: L({ uk: "Спробувати 14 днів", en: "Try 14 days free", pl: "Wypróbuj 14 dni za darmo", de: "14 Tage kostenlos testen", ro: "Încercați 14 zile gratuit", cs: "Vyzkoušejte 14 dní zdarma", sr: "Isprobajte 14 dana besplatno", hu: "Próbálja ki 14 napig ingyen" }),
      path: "/signup",
      features: [
        L({ uk: "Необмежені нотатки", en: "Unlimited notes", pl: "Nieograniczona liczba notatek", de: "Unbegrenzte Notizen", ro: "Note nelimitate", cs: "Neomezené poznámky", sr: "Neograničene beleške", hu: "Korlátlan jegyzetek" }),
        L({ uk: "Усі шаблони та голосові команди", en: "All templates & voice commands", pl: "Wszystkie szablony i polecenia głosowe", de: "Alle Vorlagen & Sprachbefehle", ro: "Toate șabloanele și comenzile vocale", cs: "Všechny šablony a hlasové příkazy", sr: "Svi šabloni i glasovne komande", hu: "Minden sablon és hangparancs" }),
        L({ uk: "Розумне автодоповнення", en: "Smart autocomplete", pl: "Inteligentne autouzupełnianie", de: "Intelligente Autovervollständigung", ro: "Autocompletare inteligentă", cs: "Chytré automatické doplňování", sr: "Pametno automatsko dovršavanje", hu: "Intelligens automatikus kiegészítés" }),
        L({ uk: "Версії та амендменти", en: "Versions & amendments", pl: "Wersje i poprawki", de: "Versionen & Nachträge", ro: "Versiuni și amendamente", cs: "Verze a dodatky", sr: "Verzije i izmene", hu: "Verziók és módosítások" }),
        L({ uk: "Електронний підпис Дія", en: "Дія e-signature", pl: "Podpis elektroniczny Дія", de: "Дія-E-Signatur", ro: "Semnătură electronică Дія", cs: "Elektronický podpis Дія", sr: "Elektronski potpis Дія", hu: "Дія e-aláírás" }),
      ],
    },
    {
      id: "team",
      name: L({ uk: "Команда", en: "Team", pl: "Zespół", de: "Team", ro: "Echipă", cs: "Tým", sr: "Tim", hu: "Csapat" }),
      tagline: L({
        uk: "Для клінік і груп лікарів.",
        en: "For clinics and clinician groups.",
        pl: "Dla klinik i zespołów lekarzy.",
        de: "Für Kliniken und Ärztegruppen.",
        ro: "Pentru clinici și grupuri de medici.",
        cs: "Pro kliniky a skupiny lékařů.",
        sr: "Za klinike i grupe lekara.",
        hu: "Klinikáknak és orvoscsoportoknak.",
      }),
      monthly: uk ? 2490 : 69, annual: uk ? 1990 : 55,
      cta: L({ uk: "Спробувати 14 днів", en: "Try 14 days free", pl: "Wypróbuj 14 dni za darmo", de: "14 Tage kostenlos testen", ro: "Încercați 14 zile gratuit", cs: "Vyzkoušejte 14 dní zdarma", sr: "Isprobajte 14 dana besplatno", hu: "Próbálja ki 14 napig ingyen" }),
      path: "/signup",
      features: [
        L({ uk: "Усе з Pro", en: "Everything in Pro", pl: "Wszystko z Pro", de: "Alles aus Pro", ro: "Tot ce include Pro", cs: "Vše z plánu Pro", sr: "Sve iz Pro plana", hu: "Minden a Pro csomagból" }),
        L({ uk: "Спільні шаблони закладу", en: "Shared organisation templates", pl: "Wspólne szablony placówki", de: "Gemeinsame Organisationsvorlagen", ro: "Șabloane comune ale organizației", cs: "Sdílené šablony organizace", sr: "Deljeni šabloni ustanove", hu: "Megosztott intézményi sablonok" }),
        L({ uk: "Ролі та керування доступом", en: "Roles & access management", pl: "Role i zarządzanie dostępem", de: "Rollen & Zugriffsverwaltung", ro: "Roluri și gestionarea accesului", cs: "Role a správa přístupu", sr: "Uloge i upravljanje pristupom", hu: "Szerepkörök és hozzáférés-kezelés" }),
        L({ uk: "Аудит і журнал подій", en: "Audit log & event history", pl: "Dziennik audytu i historia zdarzeń", de: "Audit-Log & Ereignisverlauf", ro: "Jurnal de audit și istoric evenimente", cs: "Auditní log a historie událostí", sr: "Dnevnik revizije i istorija događaja", hu: "Auditnapló és eseménytörténet" }),
        L({ uk: "Пріоритетна підтримка", en: "Priority support", pl: "Priorytetowe wsparcie", de: "Prioritäts-Support", ro: "Suport prioritar", cs: "Prioritní podpora", sr: "Prioritetna podrška", hu: "Kiemelt támogatás" }),
      ],
    },
    {
      id: "ent", name: "Enterprise",
      tagline: L({
        uk: "Для лікарень і мереж.",
        en: "For hospitals and networks.",
        pl: "Dla szpitali i sieci placówek.",
        de: "Für Krankenhäuser und Verbünde.",
        ro: "Pentru spitale și rețele medicale.",
        cs: "Pro nemocnice a sítě zařízení.",
        sr: "Za bolnice i mreže ustanova.",
        hu: "Kórházaknak és hálózatoknak.",
      }),
      custom: true,
      cta: L({ uk: "Зв'язатися з нами", en: "Talk to us", pl: "Skontaktuj się z nami", de: "Kontaktieren Sie uns", ro: "Contactați-ne", cs: "Kontaktujte nás", sr: "Kontaktirajte nas", hu: "Vegye fel velünk a kapcsolatot" }),
      path: "/signup",
      features: [
        L({ uk: "Усе з Команди", en: "Everything in Team", pl: "Wszystko z planu Zespół", de: "Alles aus Team", ro: "Tot ce include Echipă", cs: "Vše z plánu Tým", sr: "Sve iz Tim plana", hu: "Minden a Csapat csomagból" }),
        L({ uk: "Self-hosted розгортання", en: "Self-hosted deployment", pl: "Wdrożenie self-hosted", de: "Self-hosted-Bereitstellung", ro: "Implementare self-hosted", cs: "Nasazení self-hosted", sr: "Self-hosted implementacija", hu: "Self-hosted telepítés" }),
        L({ uk: "SSO та інтеграції (HL7/FHIR)", en: "SSO & integrations (HL7/FHIR)", pl: "SSO i integracje (HL7/FHIR)", de: "SSO & Integrationen (HL7/FHIR)", ro: "SSO și integrări (HL7/FHIR)", cs: "SSO a integrace (HL7/FHIR)", sr: "SSO i integracije (HL7/FHIR)", hu: "SSO és integrációk (HL7/FHIR)" }),
        L({ uk: "Індивідуальні моделі ASR", en: "Custom ASR models", pl: "Niestandardowe modele ASR", de: "Individuelle ASR-Modelle", ro: "Modele ASR personalizate", cs: "Vlastní modely ASR", sr: "Prilagođeni ASR modeli", hu: "Egyedi ASR-modellek" }),
        L({ uk: "Виділений менеджер", en: "Dedicated success manager", pl: "Dedykowany opiekun klienta", de: "Dedizierter Success-Manager", ro: "Manager de succes dedicat", cs: "Vyhrazený zákaznický manažer", sr: "Posvećeni menadžer podrške", hu: "Dedikált ügyfélmenedzser" }),
      ],
    },
  ];

  const priceOf = (p) => {
    if (p.custom) return null;
    const v = annual ? p.annual : p.monthly;
    return v === 0 ? "0" : `${cur}${v.toLocaleString(uk ? "uk-UA" : "en-US")}`;
  };

  // Feature-comparison matrix. Cell values: true (✓), false (—) or a string.
  const COMPARE = [
    { group: L({ uk: "Документація", en: "Documentation", pl: "Dokumentacja", de: "Dokumentation", ro: "Documentație", cs: "Dokumentace", sr: "Dokumentacija", hu: "Dokumentáció" }), rows: [
      { label: L({ uk: "Нотаток на місяць", en: "Notes per month", pl: "Notatki miesięcznie", de: "Notizen pro Monat", ro: "Note pe lună", cs: "Poznámky za měsíc", sr: "Beleške mesečno", hu: "Jegyzetek havonta" }), cells: ["20", "∞", "∞", "∞"] },
      { label: L({ uk: "Шаблони та структури", en: "Templates & structures", pl: "Szablony i struktury", de: "Vorlagen & Strukturen", ro: "Șabloane și structuri", cs: "Šablony a struktury", sr: "Šabloni i strukture", hu: "Sablonok és struktúrák" }), cells: [L({ uk: "Базові", en: "Basic", pl: "Podstawowe", de: "Basis", ro: "De bază", cs: "Základní", sr: "Osnovni", hu: "Alap" }), true, true, true] },
      { label: L({ uk: "Голосові команди", en: "Voice commands", pl: "Polecenia głosowe", de: "Sprachbefehle", ro: "Comenzi vocale", cs: "Hlasové příkazy", sr: "Glasovne komande", hu: "Hangparancsok" }), cells: [false, true, true, true] },
      { label: L({ uk: "Версії та амендменти", en: "Versions & amendments", pl: "Wersje i poprawki", de: "Versionen & Nachträge", ro: "Versiuni și amendamente", cs: "Verze a dodatky", sr: "Verzije i izmene", hu: "Verziók és módosítások" }), cells: [false, true, true, true] },
      { label: L({ uk: "Підпис Дія", en: "Дія signature", pl: "Podpis Дія", de: "Дія-Signatur", ro: "Semnătură Дія", cs: "Podpis Дія", sr: "Potpis Дія", hu: "Дія-aláírás" }), cells: [false, true, true, true] },
    ] },
    { group: L({ uk: "Команда", en: "Team", pl: "Zespół", de: "Team", ro: "Echipă", cs: "Tým", sr: "Tim", hu: "Csapat" }), rows: [
      { label: L({ uk: "Спільні шаблони", en: "Shared templates", pl: "Wspólne szablony", de: "Gemeinsame Vorlagen", ro: "Șabloane comune", cs: "Sdílené šablony", sr: "Deljeni šabloni", hu: "Megosztott sablonok" }), cells: [false, false, true, true] },
      { label: L({ uk: "Ролі та доступ", en: "Roles & access", pl: "Role i dostęp", de: "Rollen & Zugriff", ro: "Roluri și acces", cs: "Role a přístup", sr: "Uloge i pristup", hu: "Szerepkörök és hozzáférés" }), cells: [false, false, true, true] },
      { label: L({ uk: "Аудит подій", en: "Audit log", pl: "Dziennik audytu", de: "Audit-Log", ro: "Jurnal de audit", cs: "Auditní log", sr: "Dnevnik revizije", hu: "Auditnapló" }), cells: [false, false, true, true] },
    ] },
    { group: L({ uk: "Платформа та безпека", en: "Platform & security", pl: "Platforma i bezpieczeństwo", de: "Plattform & Sicherheit", ro: "Platformă și securitate", cs: "Platforma a zabezpečení", sr: "Platforma i bezbednost", hu: "Platform és biztonság" }), rows: [
      { label: L({ uk: "Self-hosted розгортання", en: "Self-hosted deployment", pl: "Wdrożenie self-hosted", de: "Self-hosted-Bereitstellung", ro: "Implementare self-hosted", cs: "Nasazení self-hosted", sr: "Self-hosted implementacija", hu: "Self-hosted telepítés" }), cells: [false, false, false, true] },
      { label: "SSO / SAML", cells: [false, false, false, true] },
      { label: L({ uk: "Інтеграції HL7/FHIR", en: "HL7/FHIR integrations", pl: "Integracje HL7/FHIR", de: "HL7/FHIR-Integrationen", ro: "Integrări HL7/FHIR", cs: "Integrace HL7/FHIR", sr: "HL7/FHIR integracije", hu: "HL7/FHIR integrációk" }), cells: [false, false, false, true] },
      { label: L({ uk: "Підтримка", en: "Support", pl: "Wsparcie", de: "Support", ro: "Suport", cs: "Podpora", sr: "Podrška", hu: "Támogatás" }), cells: [
        L({ uk: "Спільнота", en: "Community", pl: "Społeczność", de: "Community", ro: "Comunitate", cs: "Komunita", sr: "Zajednica", hu: "Közösség" }),
        "Email",
        L({ uk: "Пріоритетна", en: "Priority", pl: "Priorytetowe", de: "Priorisiert", ro: "Prioritar", cs: "Prioritní", sr: "Prioritetna", hu: "Kiemelt" }),
        L({ uk: "Виділена", en: "Dedicated", pl: "Dedykowane", de: "Dediziert", ro: "Dedicat", cs: "Vyhrazená", sr: "Posvećena", hu: "Dedikált" }),
      ] },
    ] },
  ];

  const FAQ = [
    { q: L({
        uk: "Чи можна змінити тариф пізніше?",
        en: "Can I change plans later?",
        pl: "Czy mogę później zmienić plan?",
        de: "Kann ich den Tarif später wechseln?",
        ro: "Pot schimba planul ulterior?",
        cs: "Mohu později změnit tarif?",
        sr: "Mogu li kasnije promeniti plan?",
        hu: "Válthatok később csomagot?",
      }),
      a: L({
        uk: "Так — оновлюйте або знижуйте тариф будь-коли; зміни застосовуються з наступного циклу.",
        en: "Yes — upgrade or downgrade any time; changes apply from your next billing cycle.",
        pl: "Tak — możesz podwyższyć lub obniżyć plan w dowolnym momencie; zmiany obowiązują od następnego cyklu rozliczeniowego.",
        de: "Ja — Sie können jederzeit upgraden oder downgraden; Änderungen gelten ab dem nächsten Abrechnungszeitraum.",
        ro: "Da — puteți trece la un plan superior sau inferior oricând; modificările se aplică din următorul ciclu de facturare.",
        cs: "Ano — tarif můžete kdykoli zvýšit nebo snížit; změny platí od dalšího zúčtovacího období.",
        sr: "Da — plan možete povisiti ili sniziti u bilo kom trenutku; izmene važe od sledećeg obračunskog ciklusa.",
        hu: "Igen — bármikor válthat magasabb vagy alacsonyabb csomagra; a módosítások a következő számlázási ciklustól érvényesek.",
      }) },
    { q: L({
        uk: "Що означає self-hosted?",
        en: "What does self-hosted mean?",
        pl: "Co oznacza self-hosted?",
        de: "Was bedeutet self-hosted?",
        ro: "Ce înseamnă self-hosted?",
        cs: "Co znamená self-hosted?",
        sr: "Šta znači self-hosted?",
        hu: "Mit jelent a self-hosted?",
      }),
      a: L({
        uk: "Уся обробка ASR і генерація працюють у вашому розгортанні. Аудіо, транскрипти й нотатки не залишають вашої інфраструктури.",
        en: "All ASR and generation run inside your own deployment. Audio, transcripts and notes never leave your infrastructure.",
        pl: "Całe przetwarzanie ASR i generowanie działa w Twoim własnym wdrożeniu. Nagrania audio, transkrypcje i notatki nigdy nie opuszczają Twojej infrastruktury.",
        de: "Die gesamte ASR-Verarbeitung und Generierung läuft in Ihrer eigenen Umgebung. Audio, Transkripte und Notizen verlassen Ihre Infrastruktur nie.",
        ro: "Toată procesarea ASR și generarea rulează în propria dumneavoastră implementare. Audio, transcrierile și notele nu părăsesc niciodată infrastructura dumneavoastră.",
        cs: "Veškeré zpracování ASR i generování běží ve vašem vlastním nasazení. Audio, přepisy ani poznámky nikdy neopustí vaši infrastrukturu.",
        sr: "Sva ASR obrada i generisanje rade u vašem sopstvenom okruženju. Audio, transkripti i beleške nikada ne napuštaju vašu infrastrukturu.",
        hu: "A teljes ASR-feldolgozás és a generálás a saját telepítésén belül fut. A hangfelvételek, átiratok és jegyzetek soha nem hagyják el az Ön infrastruktúráját.",
      }) },
    { q: L({
        uk: "Чи є безкоштовний період?",
        en: "Is there a free trial?",
        pl: "Czy jest darmowy okres próbny?",
        de: "Gibt es eine kostenlose Testphase?",
        ro: "Există o perioadă de probă gratuită?",
        cs: "Existuje bezplatná zkušební doba?",
        sr: "Postoji li besplatan probni period?",
        hu: "Van ingyenes próbaidőszak?",
      }),
      a: L({
        uk: "Плани Pro і Команда мають 14 днів безкоштовно, без прив'язки картки.",
        en: "Pro and Team include a 14-day free trial, no card required.",
        pl: "Plany Pro i Zespół obejmują 14-dniowy bezpłatny okres próbny, bez karty.",
        de: "Pro und Team enthalten eine 14-tägige kostenlose Testphase, ohne Kreditkarte.",
        ro: "Planurile Pro și Echipă includ o perioadă de probă gratuită de 14 zile, fără card.",
        cs: "Tarify Pro a Tým zahrnují 14denní bezplatnou zkušební dobu, bez platební karty.",
        sr: "Planovi Pro i Tim uključuju besplatan probni period od 14 dana, bez kartice.",
        hu: "A Pro és a Csapat csomag 14 napos ingyenes próbaidőszakot tartalmaz, bankkártya nélkül.",
      }) },
    { q: L({
        uk: "Як створюються акаунти?",
        en: "How are accounts created?",
        pl: "Jak tworzone są konta?",
        de: "Wie werden Konten erstellt?",
        ro: "Cum se creează conturile?",
        cs: "Jak se vytvářejí účty?",
        sr: "Kako se kreiraju nalozi?",
        hu: "Hogyan jönnek létre a fiókok?",
      }),
      a: L({
        uk: "Акаунти надає адміністратор вашого закладу через запрошення на пошту — самостійна реєстрація для команд недоступна.",
        en: "Accounts are provisioned by your organisation's administrator via an email invite — there's no self-serve sign-up for teams.",
        pl: "Konta zakłada administrator Twojej placówki poprzez zaproszenie e-mail — samodzielna rejestracja zespołów nie jest dostępna.",
        de: "Konten werden vom Administrator Ihrer Einrichtung per E-Mail-Einladung angelegt — eine Selbstregistrierung für Teams gibt es nicht.",
        ro: "Conturile sunt create de administratorul organizației dumneavoastră printr-o invitație pe e-mail — nu există înregistrare individuală pentru echipe.",
        cs: "Účty zřizuje administrátor vaší organizace prostřednictvím e-mailové pozvánky — samoobslužná registrace pro týmy není k dispozici.",
        sr: "Naloge kreira administrator vaše ustanove putem pozivnice e-poštom — samostalna registracija za timove nije dostupna.",
        hu: "A fiókokat az intézmény adminisztrátora hozza létre e-mailes meghívóval — csapatok számára nincs önálló regisztráció.",
      }) },
    { q: L({
        uk: "Які способи оплати?",
        en: "What payment methods do you accept?",
        pl: "Jakie metody płatności są akceptowane?",
        de: "Welche Zahlungsmethoden werden akzeptiert?",
        ro: "Ce metode de plată acceptați?",
        cs: "Jaké platební metody přijímáte?",
        sr: "Koje načine plaćanja prihvatate?",
        hu: "Milyen fizetési módokat fogadnak el?",
      }),
      a: L({
        uk: "Картки та банківський переказ для річних планів. Enterprise — за рахунком.",
        en: "Cards and bank transfer for annual plans. Enterprise is invoiced.",
        pl: "Karty oraz przelew bankowy dla planów rocznych. Enterprise rozliczany jest fakturą.",
        de: "Karten sowie Banküberweisung für Jahrespläne. Enterprise wird per Rechnung abgerechnet.",
        ro: "Carduri și transfer bancar pentru planurile anuale. Enterprise se facturează.",
        cs: "Karty a bankovní převod u ročních tarifů. Enterprise je fakturován.",
        sr: "Kartice i bankovni transfer za godišnje planove. Enterprise se plaća po fakturi.",
        hu: "Bankkártya, éves csomagoknál banki átutalás is. Az Enterprise számlázással történik.",
      }) },
  ];

  const cell = (v) =>
    v === true ? <Icon name="check" size={16} /> :
    v === false ? <span className="mk-price-dash">—</span> :
    <span className="mk-price-cellv">{v}</span>;

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <section className="mk-price-hero">
        <span className="lp-eyebrow">{L({ uk: "Тарифи", en: "Pricing", pl: "Cennik", de: "Preise", ro: "Prețuri", cs: "Ceník", sr: "Cene", hu: "Árak" })}</span>
        <h1 className="mk-hero-title">{L({
          uk: "Прості тарифи для кожної практики",
          en: "Simple pricing for every practice",
          pl: "Proste ceny dla każdej praktyki",
          de: "Einfache Preise für jede Praxis",
          ro: "Prețuri simple pentru orice practică",
          cs: "Jednoduché ceny pro každou praxi",
          sr: "Jednostavne cene za svaku praksu",
          hu: "Egyszerű árazás minden praxisnak",
        })}</h1>
        <p className="mk-price-sub">{L({
          uk: "Почніть безкоштовно. Оновлюйтесь, коли зростатимете. Скасувати можна будь-коли.",
          en: "Start free. Upgrade as you grow. Cancel any time.",
          pl: "Zacznij bezpłatnie. Przechodź wyżej w miarę rozwoju. Zrezygnuj w dowolnym momencie.",
          de: "Starten Sie kostenlos. Upgraden Sie, wenn Sie wachsen. Jederzeit kündbar.",
          ro: "Începeți gratuit. Faceți upgrade pe măsură ce creșteți. Anulați oricând.",
          cs: "Začněte zdarma. Přejděte výš, až porostete. Zrušit můžete kdykoli.",
          sr: "Počnite besplatno. Nadogradite kako rastete. Otkažite bilo kada.",
          hu: "Kezdje ingyen. Bővítsen, ahogy növekszik. Bármikor lemondhatja.",
        })}</p>

        <div className="mk-price-toggle" role="tablist" aria-label={L({ uk: "Період оплати", en: "Billing period", pl: "Okres rozliczeniowy", de: "Abrechnungszeitraum", ro: "Perioadă de facturare", cs: "Zúčtovací období", sr: "Obračunski period", hu: "Számlázási időszak" })}>
          <button role="tab" aria-selected={!annual} className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
            {L({ uk: "Щомісяця", en: "Monthly", pl: "Miesięcznie", de: "Monatlich", ro: "Lunar", cs: "Měsíčně", sr: "Mesečno", hu: "Havonta" })}
          </button>
          <button role="tab" aria-selected={annual} className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
            {L({ uk: "Щороку", en: "Annual", pl: "Rocznie", de: "Jährlich", ro: "Anual", cs: "Ročně", sr: "Godišnje", hu: "Évente" })} <span className="mk-price-save">−20%</span>
          </button>
        </div>
      </section>

      <section className="mk-price-grid">
        {PLANS.map((p) => (
          <div className={`mk-price-card${p.popular ? " is-popular" : ""}`} key={p.id}>
            {p.popular && <span className="mk-price-badge">{L({ uk: "Найпопулярніший", en: "Most popular", pl: "Najpopularniejszy", de: "Am beliebtesten", ro: "Cel mai popular", cs: "Nejoblíbenější", sr: "Najpopularniji", hu: "Legnépszerűbb" })}</span>}
            <div className="mk-price-name">{p.name}</div>
            <p className="mk-price-tag">{p.tagline}</p>
            <div className="mk-price-amount">
              {p.custom ? (
                <span className="mk-price-custom">{L({ uk: "Індивідуально", en: "Custom", pl: "Indywidualnie", de: "Individuell", ro: "Personalizat", cs: "Individuální", sr: "Po dogovoru", hu: "Egyedi" })}</span>
              ) : (
                <>
                  <span className="mk-price-num">{priceOf(p)}</span>
                  <span className="mk-price-per">{L({ uk: "/ місяць", en: "/ month", pl: "/ miesiąc", de: "/ Monat", ro: "/ lună", cs: "/ měsíc", sr: "/ mesec", hu: "/ hónap" })}</span>
                </>
              )}
            </div>
            <div className="mk-price-note">
              {p.custom ? L({ uk: "Річний контракт", en: "Annual contract", pl: "Umowa roczna", de: "Jahresvertrag", ro: "Contract anual", cs: "Roční smlouva", sr: "Godišnji ugovor", hu: "Éves szerződés" }) :
                annual ? L({ uk: "за річної оплати", en: "billed annually", pl: "przy rozliczeniu rocznym", de: "bei jährlicher Abrechnung", ro: "cu facturare anuală", cs: "při roční platbě", sr: "uz godišnju naplatu", hu: "éves számlázással" }) :
                L({ uk: "за щомісячної оплати", en: "billed monthly", pl: "przy rozliczeniu miesięcznym", de: "bei monatlicher Abrechnung", ro: "cu facturare lunară", cs: "při měsíční platbě", sr: "uz mesečnu naplatu", hu: "havi számlázással" })}
            </div>
            <a className={`btn ${p.popular ? "btn-primary" : ""} mk-price-cta`} href={`#${p.path}`} onClick={go(p.path)}>
              {p.cta}
            </a>
            <ul className="mk-price-features">
              {p.features.map((f, i) => (
                <li key={i}><Icon name="check" size={15} /> {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mk-section">
        <div className="lp-head"><h2 className="lp-h2">{L({ uk: "Порівняння можливостей", en: "Compare features", pl: "Porównanie funkcji", de: "Funktionen vergleichen", ro: "Comparați funcțiile", cs: "Porovnání funkcí", sr: "Uporedite funkcije", hu: "Funkciók összehasonlítása" })}</h2></div>
        <div className="mk-price-table-wrap">
          <table className="mk-price-table">
            <thead>
              <tr>
                <th />
                {PLANS.map((p) => <th key={p.id}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((grp, gi) => (
                <React.Fragment key={gi}>
                  <tr className="mk-price-grouprow"><td colSpan={5}>{grp.group}</td></tr>
                  {grp.rows.map((row, ri) => (
                    <tr key={ri}>
                      <td className="mk-price-rowlabel">{row.label}</td>
                      {row.cells.map((c, ci) => <td key={ci} className="mk-price-cell">{cell(c)}</td>)}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mk-section mk-faq">
        <div className="lp-head"><h2 className="lp-h2">{L({ uk: "Питання та відповіді", en: "Questions & answers", pl: "Pytania i odpowiedzi", de: "Fragen & Antworten", ro: "Întrebări și răspunsuri", cs: "Otázky a odpovědi", sr: "Pitanja i odgovori", hu: "Kérdések és válaszok" })}</h2></div>
        <div className="mk-faq-list">
          {FAQ.map((item, i) => (
            <details className="mk-faq-item" key={i}>
              <summary>{item.q} <Icon name="chevDown" size={18} /></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2 className="lp-cta-title">{L({
          uk: "Готові спробувати Klarnote?",
          en: "Ready to try Klarnote?",
          pl: "Gotowi wypróbować Klarnote?",
          de: "Bereit, Klarnote auszuprobieren?",
          ro: "Gata să încercați Klarnote?",
          cs: "Připraveni vyzkoušet Klarnote?",
          sr: "Spremni da isprobate Klarnote?",
          hu: "Készen áll kipróbálni a Klarnote-ot?",
        })}</h2>
        <p className="lp-cta-sub">{L({
          uk: "Зареєструйтесь — і поверніть лікарям час для пацієнтів.",
          en: "Sign up and give clinicians their time back.",
          pl: "Zarejestruj się i oddaj lekarzom ich czas.",
          de: "Registrieren Sie sich — und geben Sie Ärztinnen und Ärzten ihre Zeit zurück.",
          ro: "Înregistrați-vă și redați medicilor timpul lor.",
          cs: "Zaregistrujte se a vraťte lékařům jejich čas.",
          sr: "Registrujte se i vratite lekarima njihovo vreme.",
          hu: "Regisztráljon, és adja vissza az orvosok idejét.",
        })}</p>
        <div className="lp-cta-actions">
          <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{L({ uk: "Зареєструватися", en: "Sign up", pl: "Zarejestruj się", de: "Registrieren", ro: "Înregistrare", cs: "Registrovat se", sr: "Registrujte se", hu: "Regisztráció" })}</a>
          <a className="btn lp-cta-lg" href="#/contact" onClick={go("/contact")}>{L({ uk: "Зв'язатися з нами", en: "Talk to us", pl: "Skontaktuj się z nami", de: "Kontaktieren Sie uns", ro: "Contactați-ne", cs: "Kontaktujte nás", sr: "Kontaktirajte nas", hu: "Vegye fel velünk a kapcsolatot" })}</a>
        </div>
      </section>
    </MarketingShell>
  );
}
