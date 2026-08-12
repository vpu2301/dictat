// rcm.js — the revenue-cycle registry: what "a billable claim" means, country by country.
//
// This file exists because RCM is the one part of the platform that CANNOT be
// written once and translated. A scribe works the same way in Vienna and in
// Lviv; a claim does not. Austria pays LKF points against a Leistungskatalog,
// Ukraine pays a Program-of-Medical-Guarantees package against НК 025/НК 026,
// Saudi Arabia adjudicates a FHIR bundle through NPHIES. A page that said
// "we generate your claim" without naming the classification, the tariff and
// the file format would be marketing that a coder can see through in one line.
//
// ── Why the data is not translated and the prose is ───────────────────────
// The spec values are proper nouns: "ICD-10-GM 2026 (BfArM)" is spelled that
// way in Kyiv too, and translating it would be an error, not a courtesy. So
// the registry below is language-independent, and only three things carry
// per-language text:
//
//   name    — the country, in all eleven interface languages
//   note    — the one thing that makes coding hard there, in English AND in
//             the language actually spoken in that country (de for DE/AT/CH,
//             pl, cs, hu, ro, sr, uk, ar). A reader in a tenth language gets
//             English, which is the working language of a cross-border buyer.
//   LABELS  — the six row headings, in all eleven.
//
// ── Everything here is roadmap ────────────────────────────────────────────
// Klarnote does not generate claim files today. Nothing in this file may be
// rendered without the positioning.js `soonLabel` next to it — see the
// `bill` pillar, which carries all of its claims in `soon` and none in
// `points` for exactly that reason. rcm.test.js pins it.
//
// Facts researched 2026-08-10; `sources` is the audit trail. When a tariff
// moves (they move constantly — EBM quarterly, LKF annually, TARDOC replaced
// TARMED on 2026-01-01) update the row AND the source together.

/* The six rows of the coding stack, in the order a claim is actually built:
   who pays → what the diagnosis is → what was done → under which rulebook →
   what it is worth → how it leaves the building. */
export const RCM_ROWS = ["payer", "diagnoses", "procedures", "rules", "tariff", "route"];

export const RCM_COUNTRIES = [
  {
    key: "de",
    short: "ICD-10-GM · OPS · EBM · KVDT",
    native: "de",
    name: { uk: "Німеччина", en: "Germany", pl: "Niemcy", de: "Deutschland", ro: "Germania", cs: "Německo", sr: "Nemačka", hu: "Németország", ar: "ألمانيا", es: "Alemania", pt: "Alemanha", lt: "Vokietija" },
    payer: "Statutory funds via the Kassenärztliche Vereinigung; private patients under GOÄ",
    diagnoses: "ICD-10-GM 2026 (BfArM)",
    procedures: "OPS 2026 (BfArM)",
    rules: "Deutsche Kodierrichtlinien; ICD-10-GM and OPS coding is a precondition of remuneration under §295 SGB V",
    tariff: "EBM for outpatient care, revised quarterly · GOÄ for private patients · G-DRG for inpatient stays",
    route: "KVDT quarterly file (ADT / KADT / SADT) per §295(4) SGB V — generally one billing file per practice location per quarter",
    note: {
      en: "In Germany coding is not statistics. ICD-10-GM and OPS codes are a precondition of being paid at all, and the EBM catalogue is revised every quarter — so a note that is clinically faultless can still be unbillable.",
      de: "In Deutschland ist Kodierung keine Statistik. ICD-10-GM- und OPS-Kodes sind Voraussetzung der Vergütung überhaupt, und der EBM wird quartalsweise überarbeitet — eine fachlich einwandfreie Dokumentation kann deshalb trotzdem nicht abrechenbar sein.",
    },
    sources: [
      { label: "BfArM — ICD-10-GM", url: "https://www.bfarm.de/EN/Code-systems/Classifications/ICD/ICD-10-GM/_node.html" },
      { label: "KBV — Datensatzbeschreibung KVDT", url: "https://update.kbv.de/ita-update/Abrechnung/KBV_ITA_VGEX_Datensatzbeschreibung_KVDT.pdf" },
    ],
  },
  {
    key: "at",
    short: "ICD-10 · MEL · LKF · ÖGK",
    native: "de",
    name: { uk: "Австрія", en: "Austria", pl: "Austria", de: "Österreich", ro: "Austria", cs: "Rakousko", sr: "Austrija", hu: "Ausztria", ar: "النمسا", es: "Austria", pt: "Áustria", lt: "Austrija" },
    payer: "ÖGK for contract doctors; Landesgesundheitsfonds for hospitals",
    diagnoses: "ICD-10, documented under the federal health-documentation regulation",
    procedures: "Austrian Leistungskatalog — MEL (medizinische Einzelleistungen)",
    rules: "LKF documentation rules; nine regional Honorarordnungen for contract practice",
    tariff: "LKF points model — LKF-Modell 2026 in force, LKF-Modell 2027 adopted 3 June 2026",
    route: "Quarterly electronic ÖGK Abrechnung built from the practice's Leistungsdokumentation; the e-card insertion triggers the per-case Grundleistung once per quarter",
    note: {
      en: "Austria's difficulty is federal rather than clinical: the same service carries a different tariff in each of the nine Bundesländer, so which fee schedule applies depends on where the practice sits.",
      de: "Österreichs Schwierigkeit ist föderal, nicht klinisch: dieselbe Leistung trägt in jedem der neun Bundesländer einen anderen Tarif — welche Honorarordnung gilt, hängt vom Standort der Ordination ab.",
    },
    sources: [
      { label: "Sozialministerium — LKF", url: "https://www.sozialministerium.gv.at/Themen/Gesundheit/Gesundheitssystem/Krankenanstalten/Leistungsorientierte-Krankenanstaltenfinanzierung-(LKF).html" },
      { label: "ÖGK — Abrechnung ärztlicher Leistungen", url: "https://www.oegk.at/cdscontent/?contentid=10007.880134" },
    ],
  },
  {
    key: "ch",
    short: "ICD-10-GM · CHOP · TARDOC · SwissDRG",
    native: "de",
    name: { uk: "Швейцарія", en: "Switzerland", pl: "Szwajcaria", de: "Schweiz", ro: "Elveția", cs: "Švýcarsko", sr: "Švajcarska", hu: "Svájc", ar: "سويسرا", es: "Suiza", pt: "Suíça", lt: "Šveicarija" },
    payer: "Insurers under the KVG",
    diagnoses: "ICD-10-GM — mandatory for all hospitals and clinics since 2011",
    procedures: "CHOP, published annually by the Bundesamt für Statistik",
    rules: "Swiss coding manual for inpatient cases; TARDOC tariff rules for outpatient care",
    tariff: "TARDOC plus outpatient flat rates since 1 January 2026, replacing TARMED · SwissDRG for acute inpatient stays",
    route: "Forum Datenaustausch XML — generalInvoice 5.0 from 1 January 2026; version 4.5 reaches end of life on 30 June 2027",
    note: {
      en: "Switzerland changed its entire outpatient tariff on 1 January 2026: TARDOC and outpatient flat rates replaced TARMED after years of negotiation, and the invoice standard moved to generalInvoice 5.0 while 4.5 runs out on 30 June 2027.",
      de: "Die Schweiz hat ihren gesamten ambulanten Tarif per 1. Januar 2026 gewechselt: TARDOC und ambulante Pauschalen ersetzen TARMED nach jahrelangen Verhandlungen, und der Rechnungsstandard ist auf generalInvoice 5.0 gewechselt, während 4.5 am 30. Juni 2027 ausläuft.",
    },
    sources: [
      { label: "Forum Datenaustausch — XML-Standards", url: "https://www.forum-datenaustausch.ch/xml-standards" },
      { label: "SwissDRG", url: "https://www.swissdrg.org/" },
    ],
  },
  {
    key: "pl",
    short: "ICD-10 · ICD-9-PL · JGP · NFZ",
    native: "pl",
    name: { uk: "Польща", en: "Poland", pl: "Polska", de: "Polen", ro: "Polonia", cs: "Polsko", sr: "Poljska", hu: "Lengyelország", ar: "بولندا", es: "Polonia", pt: "Polónia", lt: "Lenkija" },
    payer: "Narodowy Fundusz Zdrowia (NFZ)",
    diagnoses: "ICD-10, in the version published in the NFZ dictionary",
    procedures: "ICD-9-PL, from the NFZ dictionary",
    rules: "NFZ settlement rules, enforced by the fund's walidacje and weryfikacje",
    tariff: "JGP — Jednorodne Grupy Pacjentów; the grouper derives the group from the reported ICD-9-PL procedures first",
    route: "NFZ XML messages — SWIAD for services, ZBPOZ for primary care — submitted to the regional branch",
    note: {
      en: "In Poland the procedure code drives the money: the JGP grouper works from ICD-9-PL before it looks at anything else, and a group that falls outside the contracted zakres cannot be settled at all.",
      pl: "W Polsce to procedura decyduje o pieniądzach: gruper JGP wychodzi najpierw od ICD-9-PL, a grupa, która wypada poza zakontraktowany zakres, w ogóle nie może zostać rozliczona.",
    },
    sources: [
      { label: "NFZ — lista typów komunikatów XML", url: "https://www.nfz.gov.pl/dla-swiadczeniodawcy/sprawozdawczosc-elektroniczna/lista-typow-komunikatow-xml/" },
      { label: "NFZ — słownik ICD-9 PL", url: "https://www.nfz.gov.pl/dla-swiadczeniodawcy/slowniki/pliki-icd-9-pl/" },
    ],
  },
  {
    key: "cz",
    short: "MKN-10 · SZV · CZ-DRG",
    native: "cs",
    name: { uk: "Чехія", en: "Czechia", pl: "Czechy", de: "Tschechien", ro: "Cehia", cs: "Česko", sr: "Češka", hu: "Csehország", ar: "التشيك", es: "Chequia", pt: "Chéquia", lt: "Čekija" },
    payer: "Health insurance funds; classifications maintained by ÚZIS ČR",
    diagnoses: "MKN-10 — the Czech ICD-10; the Ministry of Health holds the licence and ÚZIS ČR publishes it",
    procedures: "Seznam zdravotních výkonů, the national list of health services",
    rules: "Pravidla kódování diagnóz v systému CZ-DRG, published by ÚZIS ČR",
    tariff: "CZ-DRG, the classification built by the DRG Restart programme",
    route: "Dávky submitted to the patient's insurer",
    note: {
      en: "The Czech rulebook is unusually explicit — ÚZIS publishes the diagnosis-coding rules for CZ-DRG as a document — which means a claim is checkable against a written rule rather than against a coder's habit.",
      cs: "České pravidlo je nezvykle explicitní — ÚZIS vydává pravidla kódování diagnóz v systému CZ-DRG jako dokument — takže dávku lze ověřit proti psanému pravidlu, a ne proti zvyklosti kodéra.",
    },
    sources: [
      { label: "ÚZIS ČR — klasifikace CZ-DRG", url: "https://www.uzis.cz/index.php?pg=registry-sber-dat--klasifikace--klasifikace-hospitalizacnich-pripadu-cz-drg" },
      { label: "ÚZIS ČR — pravidla kódování diagnóz", url: "https://www.uzis.cz/res/file/klasifikace/cz-drg/pravidla-kodovani-diagnoz-v-systemu-cz-drg-v04-r01.pdf" },
    ],
  },
  {
    key: "hu",
    short: "BNO · OENO · HBCs · NEAK",
    native: "hu",
    name: { uk: "Угорщина", en: "Hungary", pl: "Węgry", de: "Ungarn", ro: "Ungaria", cs: "Maďarsko", sr: "Mađarska", hu: "Magyarország", ar: "المجر", es: "Hungría", pt: "Hungria", lt: "Vengrija" },
    payer: "NEAK — Nemzeti Egészségbiztosítási Alapkezelő",
    diagnoses: "BNO — Betegségek Nemzetközi Osztályozása, the Hungarian ICD",
    procedures: "OENO — Orvosi Eljárások Nemzetközi Osztályozása, the Hungarian procedure classification",
    rules: "Coding and classification rules set by decree 10/2012. (II. 28.) NEFMI",
    tariff: "HBCs — homogén betegségcsoportok",
    route: "Periodic NEAK reporting from the provider's financing documentation",
    note: {
      en: "Hungarian coding rules are a legal instrument, not a manual: HBCs classification is governed by decree and the codes and financing parameters are maintained by a standing committee, so the rulebook moves underneath the coder.",
      hu: "A magyar kódolási szabály jogszabály, nem kézikönyv: a HBCs-besorolást rendelet szabályozza, a kódokat és a finanszírozási paramétereket pedig állandó bizottság tartja karban — a szabálykönyv tehát elmozdul a kódoló alól.",
    },
    sources: [
      { label: "NEAK — kódkarbantartás", url: "https://www.neak.gov.hu/felso_menu/szakmai_oldalak/gyogyito_megeleozo_ellatas/kodkarbantartas/az-egeszsegugyi-ellatasban-hasznalt-szakmai-kodrendszerek-es-finanszirozasi-parameterek-karbantartasa" },
      { label: "10/2012. (II. 28.) NEFMI rendelet", url: "https://njt.jog.gov.hu/jogszabaly/2012-10-20-2V" },
    ],
  },
  {
    key: "ro",
    short: "CIM-10 · CIM-10-AM · DRG · SIUI",
    native: "ro",
    name: { uk: "Румунія", en: "Romania", pl: "Rumunia", de: "Rumänien", ro: "România", cs: "Rumunsko", sr: "Rumunija", hu: "Románia", ar: "رومانيا", es: "Rumanía", pt: "Roménia", lt: "Rumunija" },
    payer: "Casa Națională de Asigurări de Sănătate (CNAS)",
    diagnoses: "CIM-10",
    procedures: "CIM-10-AM procedure list",
    rules: "Standardele de codificare, published for the national DRG system",
    tariff: "National DRG, administered through INMSS",
    route: "SIUI — insured status and service eligibility are validated online before the report is final",
    note: {
      en: "Romania validates before it pays: SIUI checks the patient's insured status and the eligibility of each declared service online, so a coding problem surfaces at reporting time rather than in a rejection weeks later.",
      ro: "România validează înainte să plătească: SIUI verifică online calitatea de asigurat și eligibilitatea fiecărui serviciu declarat, astfel încât o problemă de codificare apare la raportare, nu într-un refuz sosit peste săptămâni.",
    },
    sources: [
      { label: "CNAS — specificație de interfațare SIUI", url: "https://cnas.ro/wp-content/uploads/2021/09/Specificatie-Interfatare-SIUI-Aplicatii_de_Raportare_pentru_Furnizori.pdf" },
      { label: "INMSS — Standardele de codificare", url: "https://drg.inmss.ro/DocDRG/StandardeDeCodificare.pdf" },
    ],
  },
  {
    key: "rs",
    short: "MKB-10 · DSG · RFZO e-faktura",
    native: "sr",
    name: { uk: "Сербія", en: "Serbia", pl: "Serbia", de: "Serbien", ro: "Serbia", cs: "Srbsko", sr: "Srbija", hu: "Szerbia", ar: "صربيا", es: "Serbia", pt: "Sérvia", lt: "Serbija" },
    payer: "Republički fond za zdravstveno osiguranje (RFZO)",
    diagnoses: "MKB-10 — the Serbian ICD-10",
    procedures: "RFZO šifarnik usluga, the fund's own catalogue of services",
    rules: "RFZO uputstvo za fakturisanje zdravstvenih usluga",
    tariff: "DSG — dijagnostički srodne grupe, modelled on AR-DRG v6.0; paid by DSG since 1 January 2019 alongside line budgeting",
    route: "Elektronska faktura — XML against the XSD schemas prescribed by RFZO",
    note: {
      en: "Serbia runs two payment logics at once: DSG case payment has applied since 1 January 2019 but sits alongside line budgeting, so the same episode has to satisfy a grouper and a budget line.",
      sr: "Srbija istovremeno primenjuje dve logike plaćanja: plaćanje po DSG važi od 1. januara 2019, ali stoji uz linijsko budžetiranje — pa isti slučaj mora da zadovolji i groupera i budžetsku liniju.",
    },
    sources: [
      { label: "RFZO — elektronsko fakturisanje", url: "https://www.rfzo.rs/index.php/davaocizdrusluga/efaktura" },
      { label: "RFZO — DSG portal", url: "https://site.zus.rfzo.rs/dsg/" },
    ],
  },
  {
    key: "ua",
    short: "НК 025 · НК 026 · ЕСОЗ",
    native: "uk",
    name: { uk: "Україна", en: "Ukraine", pl: "Ukraina", de: "Ukraine", ro: "Ucraina", cs: "Ukrajina", sr: "Ukrajina", hu: "Ukrajna", ar: "أوكرانيا", es: "Ucrania", pt: "Ucrânia", lt: "Ukraina" },
    payer: "НСЗУ — the sole national purchaser, under the Program of Medical Guarantees",
    diagnoses: "НК 025:2021, harmonised with ICD-10-AM (МКХ-10-АМ)",
    procedures: "НК 026:2021, harmonised with ACHI (АКМІ)",
    rules: "Australian Coding Standards, as adopted with the national classifiers",
    tariff: "Service packages of the Program of Medical Guarantees",
    route: "ЕСОЗ — the central electronic health system — reporting the case against its package",
    note: {
      en: "Ukraine adopted the Australian classifiers wholesale, and package eligibility turns on the diagnosis-and-intervention pair. The treating physician — not a coding department — is personally responsible for the accuracy of what is submitted.",
      uk: "Україна прийняла австралійські класифікатори цілком, і право на пакет визначається парою «діагноз + втручання». Відповідальність за точність поданого несе особисто лікуючий лікар, а не відділ кодування.",
    },
    sources: [
      { label: "КМУ — затверджено національні класифікатори", url: "https://www.kmu.gov.ua/news/moz-zatverdzheno-nacionalni-klasifikatori-hvorob-ta-intervencij" },
      { label: "НСЗУ — Програма медичних гарантій", url: "https://nszu.gov.ua/en/gromadianam/programa-medicnix-garantii" },
    ],
  },
  {
    key: "ae",
    short: "ICD-10-CM · CPT · eClaimLink · Shafafiya",
    native: "ar",
    name: { uk: "ОАЕ", en: "United Arab Emirates", pl: "Zjednoczone Emiraty Arabskie", de: "Vereinigte Arabische Emirate", ro: "Emiratele Arabe Unite", cs: "Spojené arabské emiráty", sr: "Ujedinjeni Arapski Emirati", hu: "Egyesült Arab Emírségek", ar: "الإمارات العربية المتحدة", es: "Emiratos Árabes Unidos", pt: "Emirados Árabes Unidos", lt: "Jungtiniai Arabų Emyratai" },
    payer: "Insurers regulated by DHA in Dubai, DoH in Abu Dhabi and MoHAP in the Northern Emirates",
    diagnoses: "ICD-10-CM",
    procedures: "CPT and HCPCS; CDT for dental",
    rules: "DoH Coding Manual and the DoH Claims & Adjudication Rules",
    tariff: "Payer contracts under the emirate-level adjudication rules",
    route: "Validated XML to eClaimLink (Dubai), Shafafiya (Abu Dhabi) or Riayati (Northern Emirates)",
    note: {
      en: "A group operating across the Emirates is not in one market but three: Dubai, Abu Dhabi and the Northern Emirates each run their own gateway and their own rulebook, and the same encounter has to be coded to whichever one applies.",
      ar: "المجموعة التي تعمل في أنحاء الإمارات لا تعمل في سوق واحدة بل في ثلاث: دبي وأبوظبي والإمارات الشمالية، ولكلٍّ منها بوابتها الخاصة وقواعدها الخاصة — والزيارة نفسها يجب ترميزها وفق القواعد المنطبقة عليها.",
    },
    sources: [
      { label: "DoH — Claims & Adjudication Rules", url: "https://www.doh.gov.ae/-/media/Feature/shafifya/Prices/Adjudication-Rules/DOH-Claims-and-Adjudication-Rules-V20251.ashx" },
      { label: "DoH — Coding Manual", url: "https://www.doh.gov.ae/-/media/Feature/shafifya/standards/coding/DOH-Coding-Manual-CSv2021.ashx" },
    ],
  },
  {
    key: "sa",
    short: "ICD-10-AM · SCHI · NPHIES",
    native: "ar",
    name: { uk: "Саудівська Аравія", en: "Saudi Arabia", pl: "Arabia Saudyjska", de: "Saudi-Arabien", ro: "Arabia Saudită", cs: "Saúdská Arábie", sr: "Saudijska Arabija", hu: "Szaúd-Arábia", ar: "المملكة العربية السعودية", es: "Arabia Saudí", pt: "Arábia Saudita", lt: "Saudo Arabija" },
    payer: "Insurers under the Council of Cooperative Health Insurance (CCHI / CHI)",
    diagnoses: "ICD-10-AM, as part of the Saudi Billing System",
    procedures: "Saudi Classification of Health Interventions, derived from ACHI 10th edition",
    rules: "Saudi Billing System Coding Standards (SBSCS), rooted in the Australian Coding Standards",
    tariff: "Payer contracts adjudicated through NPHIES",
    route: "NPHIES — HL7 FHIR R4 with Saudi profiles; profile conformance testing is required before production",
    note: {
      en: "Saudi Arabia is the one market here that is FHIR-native rather than file-based: claims are FHIR resources exchanged through NPHIES, conformance-tested before they may go to production, and mandatory for every licensed facility.",
      ar: "المملكة العربية السعودية هي السوق الوحيدة هنا القائمة على FHIR بدل الملفات: المطالبات موارد FHIR تُتبادل عبر منصّة نفيس، ويجب اجتياز اختبار المطابقة قبل التشغيل، وهي إلزامية لكل منشأة مرخّصة.",
    },
    sources: [
      { label: "Saudi Billing System Coding Standards", url: "https://www.solver-erp.com/blog/the-saudi-billing-system-coding-standards-sbscs-driving-digital-health-transformation" },
      { label: "CHI clinical coding certification", url: "https://saudicomplianceinstitute.com/en/blogs/news/pass-chi-clinical-coding-certification-saudi-arabia" },
    ],
  },
];

/* Row headings, in all eleven interface languages. These are the only part of
   the coding stack that is genuinely translatable — the values beside them are
   proper nouns. */
export const RCM_LABELS = {
  payer: { uk: "Платник", en: "Payer", pl: "Płatnik", de: "Kostenträger", ro: "Plătitor", cs: "Plátce", sr: "Platilac", hu: "Finanszírozó", ar: "الجهة الدافعة", es: "Pagador", pt: "Pagador", lt: "Mokėtojas" },
  diagnoses: { uk: "Кодування діагнозів", en: "Diagnosis coding", pl: "Kodowanie rozpoznań", de: "Diagnosenkodierung", ro: "Codificarea diagnosticelor", cs: "Kódování diagnóz", sr: "Kodiranje dijagnoza", hu: "Diagnóziskódolás", ar: "ترميز التشخيصات", es: "Codificación de diagnósticos", pt: "Codificação de diagnósticos", lt: "Diagnozių kodavimas" },
  procedures: { uk: "Кодування втручань", en: "Procedure coding", pl: "Kodowanie procedur", de: "Prozedurenkodierung", ro: "Codificarea procedurilor", cs: "Kódování výkonů", sr: "Kodiranje procedura", hu: "Beavatkozások kódolása", ar: "ترميز الإجراءات", es: "Codificación de procedimientos", pt: "Codificação de procedimentos", lt: "Procedūrų kodavimas" },
  rules: { uk: "Правила кодування", en: "Coding rulebook", pl: "Zasady kodowania", de: "Kodierregelwerk", ro: "Regulile de codificare", cs: "Pravidla kódování", sr: "Pravila kodiranja", hu: "Kódolási szabálykönyv", ar: "قواعد الترميز", es: "Reglas de codificación", pt: "Regras de codificação", lt: "Kodavimo taisyklės" },
  tariff: { uk: "Тариф і групування", en: "Tariff and grouping", pl: "Taryfa i grupowanie", de: "Tarif und Gruppierung", ro: "Tarif și grupare", cs: "Tarif a seskupení", sr: "Tarifa i grupisanje", hu: "Tarifa és csoportosítás", ar: "التعرفة والتجميع", es: "Tarifa y agrupación", pt: "Tarifa e agrupamento", lt: "Tarifas ir grupavimas" },
  route: { uk: "Маршрут подання", en: "Claim route", pl: "Ścieżka rozliczenia", de: "Abrechnungsweg", ro: "Traseul decontării", cs: "Cesta vyúčtování", sr: "Put fakturisanja", hu: "Elszámolási útvonal", ar: "مسار المطالبة", es: "Ruta de la reclamación", pt: "Rota da faturação", lt: "Sąskaitos pateikimo kelias" },
};

/* Resolve one country against a language: the name in the reader's language,
   the note in the reader's language if we wrote it, otherwise in the language
   of the country itself only when that IS the reader's language — otherwise
   English. (A Hungarian reader on the Germany page gets English, not German:
   falling back to a third language they may not read would be worse than the
   lingua franca.) */
export function rcmCountry(key, lang) {
  const c = RCM_COUNTRIES.find((x) => x.key === key);
  if (!c) return null;
  return {
    ...c,
    slug: `rcm/${c.key}`,
    path: `/rcm/${c.key}`,
    label: c.name[lang] ?? c.name.en,
    body: c.note[lang] ?? c.note.en,
    rows: RCM_ROWS.map((r) => ({ key: r, label: RCM_LABELS[r][lang] ?? RCM_LABELS[r].en, value: c[r] })),
  };
}

/* Every country, resolved. The order is the order they render in. */
export function rcmCountries(lang) {
  return RCM_COUNTRIES.map((c) => rcmCountry(c.key, lang));
}
