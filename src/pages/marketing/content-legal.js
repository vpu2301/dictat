// content-legal.js — the four public legal documents: /legal/privacy,
// /legal/terms, /legal/data (DPA) and /legal/consent.
//
// Split out of content-company.js for the reason that file's own header gives:
// each content domain is translated independently, and these four are an order
// of magnitude longer than the company pages they used to sit beside.
//
// ── Two rules this file lives by ────────────────────────────────────────────
//
//  1. EVERY FACTUAL CLAIM HERE IS A CLAIM ABOUT THE AS-BUILT SYSTEM. The
//     retention table, the erasure carve-outs, the consent versions, the
//     DSAR link lifetimes and the security measures are not aspirational
//     copy — they are readable in the code, and the reader is entitled to
//     assume the code still matches. The source for each is named in a
//     comment above the block. If you change one of those systems, this file
//     is part of the change.
//
//  2. WHAT WE DO NOT KNOW IS LEFT VISIBLY BLANK. Corporate identity, the
//     supervisory authority, hosting region, governing law and the commercial
//     figures are not in this repository, and an invented registration number
//     in a published legal document is worse than an obvious gap. They are
//     written as [BRACKETED CAPITALS] in both languages, so
//
//       grep -oE '\[[[:upper:]][^]]*\]' src/pages/marketing/content-legal.js | sort -u
//
//     lists everything counsel still has to fill in. The English set below is
//     the authoritative one; each has a Ukrainian twin in the same position.
//
//       [LEGAL ENTITY NAME]              [REGISTERED ADDRESS]
//       [COMPANY REGISTRATION NUMBER]    [DPO CONTACT]
//       [EU REPRESENTATIVE]              [LEAD SUPERVISORY AUTHORITY]
//       [HOSTING PROVIDER AND REGION]    [MAIL PROVIDER]
//       [SITE ANALYTICS, IF ANY]         [REGULATORY STATUS]
//       [GOVERNING LAW]                  [VENUE]
//       [LIABILITY CAP]                  [PAYMENT TERM]
//       [SLA TARGET]                     [SUPPORT HOURS]
//       [NOTICE PERIOD]                  [AUDIO RETENTION PERIOD]
//       [RECORD RETENTION PERIOD]
//
//     THESE DOCUMENTS HAVE NOT BEEN REVIEWED BY A LAWYER. They are a complete,
//     accurate draft written from the system's actual behaviour; they are not
//     legal advice and must be reviewed before they are relied on.
//
// ── Languages ───────────────────────────────────────────────────────────────
// Authored in full in Ukrainian and English. `t()` falls back to English for
// the other locales, deliberately: a binding legal text machine-translated
// into a language nobody on the team reads is a liability, not a courtesy.
// A locale gets its own version when a qualified translator produces one.

export function buildLegalPages(lang) {
  const t = (m) => m[lang] ?? m.en;

  const EYEBROW = t({ uk: "Правове", en: "Legal", pl: "Informacje prawne", de: "Rechtliches", ro: "Legal", cs: "Právní informace", sr: "Pravno", hu: "Jogi információk", ar: "معلومات قانونية", es: "Legal", pt: "Informação legal" });
  const UPDATED = t({ uk: "Оновлено: 12 серпня 2026 · Версія 2.0", en: "Last updated: 12 August 2026 · Version 2.0" });

  /* The draft warning rides at the top of all four documents. It is the first
     thing a reader sees because the alternative — discovering halfway down a
     privacy policy that it was never reviewed — is worse. Delete it in the
     same commit that records counsel's sign-off, not before. */
  const DRAFT_NOTICE = {
    type: "prose",
    heading: t({ uk: "Статус документа", en: "Status of this document" }),
    paragraphs: t({
      uk: [
        "Це повний робочий проєкт, підготовлений на основі фактичної поведінки системи. Він ще не пройшов юридичну експертизу, і поля у [КВАДРАТНИХ ДУЖКАХ] ще не заповнені. До завершення перевірки цей текст не є публічною офертою і не створює зобов’язань.",
      ],
      en: [
        "This is a complete working draft, written from the actual behaviour of the system. It has not yet been through legal review, and the fields in [SQUARE BRACKETS] are not yet filled in. Until that review is complete this text is not a public offer and creates no obligations.",
      ],
    }),
  };

  return {
    /* ═══════════════════════════════════════════════════════════════════════
       PRIVACY POLICY
       ═══════════════════════════════════════════════════════════════════════ */
    "legal/privacy": {
      hero: {
        eyebrow: EYEBROW,
        title: t({ uk: "Політика конфіденційності", en: "Privacy Policy", pl: "Polityka prywatności", de: "Datenschutzerklärung", ro: "Politica de confidențialitate", cs: "Zásady ochrany osobních údajů", sr: "Politika privatnosti", hu: "Adatvédelmi szabályzat", ar: "سياسة الخصوصية", es: "Política de privacidad", pt: "Política de Privacidade" }),
        sub: t({
          uk: "Які дані обробляє Klarnote, на якій підставі, як довго і хто до них має доступ. Написано так, щоб це можна було перевірити, а не лише прочитати.",
          en: "What Klarnote processes, on what basis, for how long, and who can reach it. Written so it can be checked, not merely read.",
        }),
        updated: UPDATED,
      },
      blocks: [
        DRAFT_NOTICE,

        { type: "prose",
          heading: t({ uk: "1. Хто ми і що охоплює ця політика", en: "1. Who we are and what this policy covers" }),
          lead: t({
            uk: "Klarnote — платформа медичної документації: вона перетворює мовлення лікаря та розмову з пацієнтом на структуровану медичну нотатку, дає її підписати та зберігає з аудитом кожного доступу.",
            en: "Klarnote is a clinical documentation platform: it turns a clinician's speech and a consultation into a structured clinical note, has it signed, and keeps it with an audit trail over every access.",
          }),
          paragraphs: t({
            uk: [
              "Оператором цього сайту та постачальником платформи є [НАЗВА ЮРИДИЧНОЇ ОСОБИ], зареєстрована за адресою [ЮРИДИЧНА АДРЕСА], реєстраційний номер [РЕЄСТРАЦІЙНИЙ НОМЕР] («Klarnote», «ми»).",
              "Ця політика охоплює два різні набори даних, і різниця між ними визначає майже все інше в цьому документі. Перший — дані, які ми обробляємо для себе: облікові записи користувачів, звернення через форми на сайті, технічні журнали. Щодо них ми є контролером. Другий — медичні дані пацієнтів усередині розгортання клініки. Щодо них контролером є сама клініка, а ми — лише обробником, який діє за її документованими інструкціями.",
              "Практичний наслідок: якщо ви пацієнт і хочете отримати доступ до своїх даних або видалити їх, ваша адреса — медичний заклад, який вас лікує, а не ми. Ми виконуємо такі запити на його доручення і маємо для цього вбудовані механізми, описані в розділі 10.",
            ],
            en: [
              "The operator of this site and the supplier of the platform is [LEGAL ENTITY NAME], registered at [REGISTERED ADDRESS], company number [COMPANY REGISTRATION NUMBER] (“Klarnote”, “we”).",
              "This policy covers two distinct sets of data, and the difference between them determines almost everything else in this document. The first is data we process for ourselves: user accounts, enquiries submitted through forms on this site, technical logs. For those we are the controller. The second is patient data inside a clinic's deployment. For that the clinic is the controller and we are only a processor, acting on its documented instructions.",
              "The practical consequence: if you are a patient and want a copy of your data or its deletion, your route is the healthcare organization treating you, not us. We carry out such requests on its instruction and have built-in machinery for doing so, described in section 10.",
            ],
          }) },

        /* The dual role, as a table, because it is the one thing readers get
           wrong and a paragraph does not make it scannable. */
        { type: "spec",
          heading: t({ uk: "2. У якій ролі ми виступаємо", en: "2. Which hat we are wearing" }),
          sub: t({
            uk: "Одна платформа, дві ролі за GDPR. Ліворуч — набір даних, праворуч — хто визначає мету обробки.",
            en: "One platform, two GDPR roles. On the left the data set, on the right who decides why it is processed.",
          }),
          rows: [
            { key: "phi", label: t({ uk: "Аудіо, транскрипти, звіти, дані пацієнтів", en: "Audio, transcripts, reports, patient records" }),
              value: t({ uk: "Контролер — медичний заклад. Klarnote — обробник (див. Угоду про обробку даних).", en: "Controller: the healthcare organization. Klarnote: processor (see the Data Processing Agreement)." }) },
            { key: "consent", label: t({ uk: "Записи про згоду пацієнта", en: "Patient consent records" }),
              value: t({ uk: "Контролер — медичний заклад. Klarnote — обробник; ми зберігаємо доказ підстави, але не визначаємо її.", en: "Controller: the healthcare organization. Klarnote: processor; we store the evidence of the basis, we do not choose it." }) },
            { key: "accounts", label: t({ uk: "Облікові записи лікарів і адміністраторів", en: "Clinician and administrator accounts" }),
              value: t({ uk: "Спільна відповідальність: заклад визначає, кому надати доступ; ми визначаємо, як працює автентифікація. Щодо безпеки автентифікації контролер — ми.", en: "Shared: the organization decides who gets access; we decide how authentication works. For the authentication layer itself we are the controller." }) },
            { key: "audit", label: t({ uk: "Журнал аудиту доступу", en: "Access audit log" }),
              value: t({ uk: "Контролер — медичний заклад. Ми не можемо видалити запис аудиту на запит — це і є сенс журналу.", en: "Controller: the healthcare organization. We cannot delete an audit entry on request — that is the point of the log." }) },
            { key: "leads", label: t({ uk: "Звернення через сайт, заявки на демо", en: "Website enquiries and demo requests" }),
              value: t({ uk: "Контролер — Klarnote.", en: "Controller: Klarnote." }) },
            { key: "tech", label: t({ uk: "Технічні журнали, діагностика помилок", en: "Technical logs and error diagnostics" }),
              value: t({ uk: "Контролер — Klarnote, у межах, необхідних для безпеки та працездатності сервісу.", en: "Controller: Klarnote, to the extent needed to keep the service secure and working." }) },
          ] },

        /* Categories. Sourced from the API clients: asr.js, reports.js,
           patients.js, consents.js, privacy.js, endpoints.js (MFA/sessions),
           evidenceChat.js, and the signup lead path in SignupFlow.jsx. */
        { type: "spec",
          heading: t({ uk: "3. Які категорії даних обробляються", en: "3. Categories of data processed" }),
          sub: t({
            uk: "Перелік вичерпний для платформи в її поточному вигляді. Категорія, якої тут немає, платформою не збирається.",
            en: "This list is exhaustive for the platform as it stands. A category not listed here is not collected.",
          }),
          rows: [
            { key: "audio", label: t({ uk: "Аудіозаписи", en: "Audio recordings" }),
              value: t({ uk: "Диктування лікаря та — в режимі розмови — весь прийом, включно з голосом пацієнта. Джерело: мікрофон пристрою лікаря.", en: "Clinician dictation and, in conversation mode, the whole consultation including the patient's own voice. Source: the microphone on the clinician's device." }) },
            { key: "transcript", label: t({ uk: "Транскрипти", en: "Transcripts" }),
              value: t({ uk: "Текст розпізнавання з часовими мітками, розділенням голосів та показником впевненості на рівні слова.", en: "Recognition output with timings, speaker separation and word-level confidence scores." }) },
            { key: "notes", label: t({ uk: "Клінічні документи", en: "Clinical documents" }),
              value: t({ uk: "Чернетки й підписані звіти, структуровані поля, коди діагнозів, версії та історія змін, вкладення.", en: "Drafts and signed reports, structured fields, diagnosis codes, versions and revision history, attachments." }) },
            { key: "patient", label: t({ uk: "Ідентифікація пацієнта", en: "Patient identity" }),
              value: t({ uk: "Ім’я, дата народження, стать, номер картки, за потреби ІПН, а також контакти — телефон, e-mail, адреса. Вносяться закладом, не нами.", en: "Name, date of birth, sex, medical record number, national identifier where the clinic records one, and contact details — phone, e-mail, address. Entered by the organization, not by us." }) },
            { key: "consent", label: t({ uk: "Згоди", en: "Consents" }),
              value: t({ uk: "Тип згоди, версія затвердженого тексту, спосіб отримання, момент часу, особа, яка засвідчила, та конверт КЕП для цифрового підпису.", en: "Consent type, version of the approved text, method of capture, timestamp, the person who attested it, and the qualified-signature envelope for digital consent." }) },
            { key: "account", label: t({ uk: "Облікові дані", en: "Account data" }),
              value: t({ uk: "Ім’я, службовий e-mail, роль і права, належність до закладу, стан двофакторної автентифікації, активні сесії та пристрої.", en: "Name, work e-mail, role and permissions, organization membership, two-factor enrolment state, active sessions and devices." }) },
            { key: "audit", label: t({ uk: "Аудит", en: "Audit" }),
              value: t({ uk: "Хто, коли й до якого запису отримав доступ або змінив його; підписання; надання екстреного доступу; зміни ролей.", en: "Who reached or changed which record and when; signatures; emergency-access grants; role changes." }) },
            { key: "evidence", label: t({ uk: "Запити до доказової бази", en: "Evidence questions" }),
              value: t({ uk: "Текст клінічних запитань, поставлених у модулі доказової бази, та повернуті джерела. Див. розділ 6 щодо зовнішнього пошуку.", en: "The text of clinical questions asked in the evidence module and the sources returned. See section 6 on external search." }) },
            { key: "tech", label: t({ uk: "Технічні дані", en: "Technical data" }),
              value: t({ uk: "IP-адреса, тип браузера, часові мітки запитів, коди помилок і трасування збоїв.", en: "IP address, browser type, request timestamps, error codes and failure traces." }) },
            { key: "lead", label: t({ uk: "Дані потенційних клієнтів", en: "Prospect data" }),
              value: t({ uk: "Ім’я, e-mail, назва закладу та повідомлення, надіслані через форми на цьому сайті. Це єдина категорія, яку ми передаємо зовнішньому постачальнику — див. розділ 7.", en: "Name, e-mail, organization and message submitted through forms on this site. This is the only category we pass to an external provider — see section 7." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "4. Дані про здоров’я — особлива категорія", en: "4. Health data — a special category" }),
          paragraphs: t({
            uk: [
              "Аудіо прийому, транскрипт і клінічна нотатка є даними про стан здоров’я в розумінні статті 9 GDPR. Їх обробка заборонена, доки не застосовується один із винятків частини 2 тієї ж статті. У випадку Klarnote застосовується пункт «h» — обробка для цілей медичної допомоги та управління системами охорони здоров’я, здійснювана під відповідальність медичного працівника, зобов’язаного зберігати лікарську таємницю.",
              "Це не робить згоду пацієнта зайвою. Запис розмови — окрема дія з власним ризиком для приватності, і платформа вимагає згоди перед записом: сервер відхиляє спробу почати запис розмови без чинної згоди відповідного типу. Детальніше — у Повідомленні про згоду.",
            ],
            en: [
              "Encounter audio, the transcript and the clinical note are health data within the meaning of Article 9 GDPR. Processing them is prohibited unless one of the Article 9(2) exceptions applies. For Klarnote the applicable one is (h) — processing for the purposes of healthcare and the management of health systems, carried out under the responsibility of a professional bound by an obligation of professional secrecy.",
              "That does not make patient consent redundant. Recording a consultation is a separate act with its own privacy cost, and the platform requires consent before it: the server refuses to start a conversation recording without a valid consent of the matching type. The Consent notice sets this out in full.",
            ],
          }) },

        { type: "spec",
          heading: t({ uk: "5. Мета та правова підстава", en: "5. Purposes and legal bases" }),
          rows: [
            { key: "p1", label: t({ uk: "Розпізнавання мовлення та створення чернетки нотатки", en: "Speech recognition and drafting the note" }),
              value: t({ uk: "Ст. 6(1)(b) і 9(2)(h) — виконання договору із закладом; медична допомога. Ми діємо за інструкцією контролера.", en: "Art. 6(1)(b) and 9(2)(h) — performance of the contract with the organization; healthcare. We act on the controller's instruction." }) },
            { key: "p2", label: t({ uk: "Запис розмови з пацієнтом", en: "Recording the consultation" }),
              value: t({ uk: "Ст. 9(2)(a) — явна згода пацієнта, зафіксована до початку запису та перевірена сервером.", en: "Art. 9(2)(a) — the patient's explicit consent, captured before recording starts and enforced server-side." }) },
            { key: "p3", label: t({ uk: "Зберігання, пошук і підписання документів", en: "Storing, retrieving and signing documents" }),
              value: t({ uk: "Ст. 6(1)(c) — виконання обов’язку закладу вести медичну документацію; ст. 9(2)(h).", en: "Art. 6(1)(c) — the organization's statutory duty to keep clinical records; Art. 9(2)(h)." }) },
            { key: "p4", label: t({ uk: "Аудит доступу та безпека", en: "Access audit and security" }),
              value: t({ uk: "Ст. 6(1)(c) і 32 — обов’язкові технічні та організаційні заходи. Журнал аудиту є вимогою, а не опцією.", en: "Art. 6(1)(c) and 32 — mandatory technical and organisational measures. The audit log is a requirement, not an option." }) },
            { key: "p5", label: t({ uk: "Автентифікація, двофакторний захист, керування сесіями", en: "Authentication, two-factor, session management" }),
              value: t({ uk: "Ст. 6(1)(f) — законний інтерес у захисті облікових записів, що дають доступ до медичних даних.", en: "Art. 6(1)(f) — legitimate interest in protecting accounts that reach clinical data." }) },
            { key: "p6", label: t({ uk: "Покращення якості розпізнавання", en: "Improving recognition quality" }),
              value: t({ uk: "Лише на знеособлених даних і лише за окремою письмовою інструкцією закладу. За замовчуванням вимкнено.", en: "De-identified data only, and only on the organization's separate written instruction. Off by default." }) },
            { key: "p7", label: t({ uk: "Відповіді на звернення з сайту", en: "Answering website enquiries" }),
              value: t({ uk: "Ст. 6(1)(b) і (f) — заходи до укладення договору та законний інтерес у веденні комерційної комунікації.", en: "Art. 6(1)(b) and (f) — pre-contractual steps and legitimate interest in commercial correspondence." }) },
            { key: "p8", label: t({ uk: "Технічна діагностика та відновлення після збоїв", en: "Technical diagnostics and recovery" }),
              value: t({ uk: "Ст. 6(1)(f) — законний інтерес у працездатності сервісу; журнали не містять вмісту медичних записів.", en: "Art. 6(1)(f) — legitimate interest in a working service; logs do not carry the content of clinical records." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "6. Де відбувається обробка", en: "6. Where the processing happens" }),
          lead: t({
            uk: "Це найважливіший розділ політики і головна конструктивна відмінність Klarnote.",
            en: "This is the most important section of this policy and the main structural claim Klarnote makes.",
          }),
          paragraphs: t({
            uk: [
              "Усі моделі — розпізнавання мовлення, структурування тексту, генеративне доповнення та пошук у доказовій базі — працюють на self-hosted обладнанні всередині розгортання, з відкритими ліцензіями. Жодне аудіо, жоден транскрипт і жодна нотатка не надсилаються до пропрієтарного API третьої сторони. Немає транскордонної передачі медичних даних, яку довелося б обґрунтовувати стандартними договірними положеннями, бо немає самої передачі.",
              "З цього правила є рівно один виняток, і він не стосується даних пацієнта. Якщо заклад вмикає перевірку зовнішніх джерел у модулі доказової бази, текст клінічного запитання виходить за межі розгортання, щоб дістатися публічних медичних джерел. Контекст пацієнта до цих запитів не додається — сервіс відповідей не має поля для нього. Функцію можна вимкнути на рівні закладу, і тоді відповіді формуються лише з локального корпусу.",
              "Розміщення інфраструктури: [ПОСТАЧАЛЬНИК ХОСТИНГУ ТА РЕГІОН]. У розгортаннях на власному обладнанні клініки розміщення визначає сама клініка, і ми не маємо доступу до її даних інакше, ніж у порядку підтримки, описаному в розділі 9.",
            ],
            en: [
              "Every model — speech recognition, text structuring, generative completion and evidence retrieval — runs on self-hosted, open-licensed weights inside the deployment. No audio, no transcript and no note is sent to a third-party proprietary API. There is no cross-border transfer of health data to justify under standard contractual clauses, because there is no transfer.",
              "There is exactly one exception, and it does not involve patient data. If the organization enables external source checking in the evidence module, the text of the clinical question leaves the deployment to reach public medical sources. Patient context is not attached to those requests — the answer service has no field for it. The feature can be switched off per organization, and answers are then drawn from the local corpus alone.",
              "Infrastructure location: [HOSTING PROVIDER AND REGION]. In deployments on a clinic's own hardware the clinic determines the location, and we have no access to its data other than through the support route described in section 9.",
            ],
          }) },

        /* Sub-processors. Only two are real in the codebase: the CRM behind
           the signup lead form (CSP admits api.hsforms.com) and whatever mail
           relay the marketing service uses. Everything else is the customer's
           own infrastructure. Keep this table honest — it is the one readers
           check against the CSP header. */
        { type: "spec",
          heading: t({ uk: "7. Субобробники", en: "7. Sub-processors" }),
          sub: t({
            uk: "Повний перелік. Жоден із них не має доступу до медичних даних; усі стосуються лише даних із публічного сайту.",
            en: "The complete list. None of them can reach clinical data; all of them concern public-site data only.",
          }),
          rows: [
            { key: "crm", label: t({ uk: "CRM для звернень із сайту", en: "CRM for website enquiries" }),
              value: t({ uk: "HubSpot — приймає форму «замовити демо» та контактну форму. Отримує лише те, що ви самі ввели у форму: ім’я, e-mail, заклад, повідомлення.", en: "HubSpot — receives the demo-request and contact forms. Gets only what you typed into the form: name, e-mail, organization, message." }) },
            { key: "mail", label: t({ uk: "Поштовий шлюз", en: "Mail relay" }),
              value: t({ uk: "[ПОСТАЧАЛЬНИК ПОШТИ] — доставляє транзакційні листи: підтвердження заявки, запрошення до закладу, сповіщення безпеки.", en: "[MAIL PROVIDER] — delivers transactional mail: enquiry acknowledgements, organization invitations, security notifications." }) },
            { key: "host", label: t({ uk: "Хостинг публічного сайту", en: "Public-site hosting" }),
              value: t({ uk: "[ПОСТАЧАЛЬНИК ХОСТИНГУ ТА РЕГІОН] — обслуговує лише маркетинговий сайт. Медичне розгортання відокремлене.", en: "[HOSTING PROVIDER AND REGION] — serves the marketing site only. The clinical deployment is separate." }) },
            { key: "web", label: t({ uk: "Публічні медичні джерела", en: "Public medical sources" }),
              value: t({ uk: "PubMed, Cochrane та інші відкриті бази — отримують текст клінічного запитання, якщо заклад увімкнув зовнішній пошук. Без даних пацієнта.", en: "PubMed, Cochrane and other open databases — receive the text of a clinical question if the organization enabled external search. No patient data." }) },
            { key: "none", label: t({ uk: "Постачальники моделей ШІ", en: "AI model providers" }),
              value: t({ uk: "Немає. Це не спрощення: у платформі відсутній код, який надсилав би аудіо чи текст нотатки до зовнішнього API моделі.", en: "None. This is not a simplification: the platform contains no code path that sends audio or note text to an external model API." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "8. Строки зберігання", en: "8. Retention" }),
          paragraphs: t({
            uk: [
              "Медичну документацію зберігає заклад, а не ми: строки визначає законодавство про медичні записи та політика самого закладу, і ми виконуємо їх як обробник. Нижче — строки, які реалізовані в самій платформі й не залежать від налаштувань.",
            ],
            en: [
              "Clinical records are retained by the organization, not by us: the periods come from records legislation and the organization's own policy, and we implement them as a processor. Below are the periods that are built into the platform itself and do not depend on configuration.",
            ],
          }) },

        /* Every row below is a real number in the code. DSAR package TTL and
           the signed-link lifetime are documented in src/api/privacy.js; the
           four erasure carve-outs are the BASIS_* strings mirrored in
           src/patients/legalBasis.js. */
        { type: "spec",
          rows: [
            { key: "r1", label: t({ uk: "Аудіозапис прийому", en: "Encounter audio" }),
              value: t({ uk: "[СТРОК ЗБЕРІГАННЯ АУДІО] після підписання звіту, далі — автоматичне видалення. Аудіо не потрібне після того, як лікар затвердив текст.", en: "[AUDIO RETENTION PERIOD] after the report is signed, then automatic deletion. The audio has no purpose once the clinician has approved the text." }) },
            { key: "r2", label: t({ uk: "Підписаний медичний звіт", en: "Signed clinical report" }),
              value: t({ uk: "[СТРОК ЗБЕРІГАННЯ ДОКУМЕНТАЦІЇ] — обов’язковий строк зберігання клінічної документації.", en: "[RECORD RETENTION PERIOD] — the statutory clinical-record retention period." }) },
            { key: "r3", label: t({ uk: "Чернетка, не підписана", en: "Unsigned draft" }),
              value: t({ uk: "До видалення автором або до автоматичного очищення за політикою закладу.", en: "Until deleted by its author or cleared by the organization's own policy." }) },
            { key: "r4", label: t({ uk: "Запис про згоду", en: "Consent record" }),
              value: t({ uk: "Разом із документом, якого стосується, — як доказ правової підстави обробки.", en: "For the life of the document it relates to — as evidence of the lawful basis for processing." }) },
            { key: "r5", label: t({ uk: "Журнал аудиту", en: "Audit log" }),
              value: t({ uk: "Append-only, не видаляється на запит. Це вимога цілісності: журнал, який можна почистити, не є доказом.", en: "Append-only and not deletable on request. That is an integrity requirement: a log you can prune is not evidence." }) },
            { key: "r6", label: t({ uk: "Пакет даних за запитом на доступ (DSAR)", en: "Data subject access package (DSAR)" }),
              value: t({ uk: "14 днів, далі архів знищується. Посилання на завантаження підписане й діє 15 хвилин; кожне його створення фіксується в аудиті.", en: "14 days, after which the archive is destroyed. The download link is signed and valid for 15 minutes; every mint is audited." }) },
            { key: "r7", label: t({ uk: "Облікові записи", en: "User accounts" }),
              value: t({ uk: "До відкликання доступу адміністратором закладу, далі — деактивація та видалення персональних полів у межах, що не руйнують аудит.", en: "Until access is revoked by the organization's administrator, then deactivation and removal of personal fields to the extent that does not break the audit trail." }) },
            { key: "r8", label: t({ uk: "Дані звернень із сайту", en: "Website enquiry data" }),
              value: t({ uk: "24 місяці з останнього контакту або до відкликання згоди, залежно від того, що настане раніше.", en: "24 months from the last contact or until consent is withdrawn, whichever comes first." }) },
            { key: "r9", label: t({ uk: "Технічні журнали", en: "Technical logs" }),
              value: t({ uk: "90 днів.", en: "90 days." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "9. Заходи безпеки", en: "9. Security measures" }),
          lead: t({
            uk: "Нижче — те, що реалізовано, а не те, чого ми прагнемо. Кожен пункт відповідає механізму в коді.",
            en: "What is built, not what is aimed at. Each item corresponds to a mechanism in the code.",
          }),
          bullets: t({
            uk: [
              "Ізоляція закладів забезпечується базою даних через row-level security, а не фільтрами в коді застосунку. Забутий фільтр не може призвести до витоку між закладами, бо код взагалі не відповідає за цю межу.",
              "Журнал аудиту — append-only, із хеш-ланцюгом; незмінність контролюється на рівні бази даних і звіряється щоночі, тож зміна заднім числом виявляється, а не приховується.",
              "Шифрування під час передачі та зберігання, включно з аудіофайлами.",
              "Рольова модель доступу за принципом найменших привілеїв; підписувати документи може лише лікар із відповідним правом.",
              "Двофакторна автентифікація (TOTP) для облікових записів із доступом до медичних даних.",
              "Відкликання сесій: адміністратор може негайно припинити всі активні сесії користувача; клієнт коректно обробляє відкликання під час диктування, не втрачаючи незбережений текст.",
              "Екстрений доступ («break-glass»): адміністратор без клінічної ролі не бачить медичних даних за замовчуванням. Отримати доступ до конкретного пацієнта можна лише через окремий запит із повторною автентифікацією, із зазначенням причини та повним записом в аудиті.",
              "Видалення за правом на забуття вимагає двох різних людей: той, хто ініціював запит, не може його ж і затвердити.",
              "Резервне копіювання з перевіркою цілісності та регламентованим відновленням.",
            ],
            en: [
              "Organization isolation is enforced by the database through row-level security, not by filters in application code. A forgotten filter cannot leak across organizations, because the code is not what holds that boundary.",
              "The audit log is append-only and hash-chained; immutability is enforced at the database level and reconciled nightly, so a retroactive edit is detected rather than hidden.",
              "Encryption in transit and at rest, audio files included.",
              "Role-based access on a least-privilege model; only a clinician holding the signing permission can sign a document.",
              "Two-factor authentication (TOTP) for accounts that reach clinical data.",
              "Session revocation: an administrator can end all of a user's active sessions immediately, and the client handles revocation mid-dictation without losing unsaved text.",
              "Emergency access (“break-glass”): an administrator without a clinical role sees no patient data by default. Reaching a specific patient requires a separate request with step-up re-authentication, a stated reason, and a full audit entry.",
              "Erasure under the right to be forgotten requires two different people: whoever raised the request cannot approve it.",
              "Backups with integrity verification and a documented restore procedure.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "10. Ваші права та як ними скористатися", en: "10. Your rights and how to exercise them" }),
          paragraphs: t({
            uk: [
              "Вам належать права на доступ, виправлення, видалення, обмеження обробки, перенесення даних і заперечення проти обробки, а також право не бути об’єктом рішення, що ґрунтується виключно на автоматизованій обробці.",
              "Куди звертатися, залежить від того, про які дані йдеться. Щодо медичних даних — до закладу, який вас лікує: він є контролером, а ми виконуємо його доручення. Щодо облікового запису, звернень із сайту та технічних даних — безпосередньо до нас, на privacy@klarnote.com.",
              "Коли заклад надсилає нам такий запит, платформа виконує його вбудованими засобами. Запит на доступ формує повний архів медичних даних пацієнта з описом вмісту. Запит на видалення проходить перевірку другою людиною, після затвердження — період очікування, протягом якого його ще можна скасувати, і лише потім виконується.",
              "Видалення не є абсолютним, і система про це прямо повідомляє. Звіт про виконання перелічує кожен елемент, який довелося зберегти, із зазначенням підстави: підписаний медичний звіт — обов’язковий строк зберігання клінічної документації; запис про згоду — доказ правової підстави обробки; кваліфікований електронний підпис — конверт підпису як юридичний доказ; слід виконання самого видалення — запит і звіт про нього. Нічого не приховується й не «округлюється» до повного видалення.",
              "Строк відповіді — один місяць, із можливістю продовження ще на два місяці для складних запитів, про що вас повідомлять.",
            ],
            en: [
              "You have rights of access, rectification, erasure, restriction of processing, data portability and objection, and the right not to be subject to a decision based solely on automated processing.",
              "Where to address them depends on which data is involved. For clinical data, the organization treating you: it is the controller and we act on its instruction. For your account, website enquiries and technical data, us directly, at privacy@klarnote.com.",
              "When an organization passes such a request to us, the platform carries it out with built-in machinery. An access request assembles a complete archive of the patient's clinical data together with a manifest of its contents. An erasure request is reviewed by a second person, then held for a grace period during which it can still be cancelled, and only then executed.",
              "Erasure is not absolute, and the system says so plainly. The execution report lists every item that had to be retained together with the basis for retaining it: a signed clinical report under the statutory records retention period; a consent record as evidence of the lawful basis of processing; a qualified electronic signature envelope kept as legal evidence; and the paper trail of the erasure itself — the request and its execution report. Nothing is hidden or rounded up to “fully deleted”.",
              "We respond within one month, extendable by two further months for complex requests, in which case you will be told.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "11. Автоматизовані рішення", en: "11. Automated decision-making" }),
          paragraphs: t({
            uk: [
              "Klarnote не ухвалює рішень щодо вас автоматизовано і не здійснює профілювання у розумінні статті 22 GDPR.",
              "Система готує чернетку — вона не ставить діагноз і ніколи не фіналізує документ самостійно. Кожен клінічний документ набуває чинності лише після перевірки та підпису лікаря, і саме лікар відповідає за його зміст. Слова, у розпізнаванні яких модель невпевнена, позначаються для перевірки, а не подаються як факт.",
            ],
            en: [
              "Klarnote makes no automated decisions about you and performs no profiling within the meaning of Article 22 GDPR.",
              "The system drafts; it does not diagnose and never finalizes a document by itself. A clinical document takes effect only after a clinician has reviewed and signed it, and the clinician is responsible for its content. Words the model is unsure of are flagged for review rather than presented as fact.",
            ],
          }) },

        { type: "spec",
          heading: t({ uk: "12. Файли cookie та локальне сховище", en: "12. Cookies and local storage" }),
          sub: t({
            uk: "Рекламних і трекінгових cookie немає — жодних, ні на сайті, ні в застосунку.",
            en: "There are no advertising or tracking cookies — none, on the site or in the application.",
          }),
          rows: [
            { key: "c1", label: t({ uk: "Сесійний токен", en: "Session token" }),
              value: t({ uk: "Необхідний. Тримає вас у системі й дозволяє відкликати сесію. Зникає після виходу.", en: "Strictly necessary. Keeps you signed in and makes revocation possible. Cleared on sign-out." }) },
            { key: "c2", label: t({ uk: "Налаштування інтерфейсу", en: "Interface preferences" }),
              value: t({ uk: "Локальне сховище браузера: мова, тема, вибраний мікрофон. Не залишає пристрій.", en: "Browser local storage: language, theme, selected microphone. Never leaves the device." }) },
            { key: "c3", label: t({ uk: "Чернетка, не збережена на сервері", en: "Locally held draft" }),
              value: t({ uk: "Тимчасово зберігається у браузері, щоб текст не втратився при обриві мережі. Видаляється після успішного збереження.", en: "Held briefly in the browser so text survives a dropped connection. Discarded once the save succeeds." }) },
            { key: "c4", label: t({ uk: "Аналітика", en: "Analytics" }),
              value: t({ uk: "У медичному застосунку — відсутня. На публічному сайті — [АНАЛІТИКА САЙТУ, ЯКЩО ВИКОРИСТОВУЄТЬСЯ].", en: "None in the clinical application. On the public site: [SITE ANALYTICS, IF ANY]." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "13. Діти", en: "13. Children" }),
          paragraphs: t({
            uk: [
              "Платформою користуються медичні працівники, тож ми не створюємо облікових записів для осіб віком до 18 років.",
              "Медичні дані неповнолітніх пацієнтів обробляються так само, як і всі інші, а згоду надає законний представник відповідно до законодавства країни, де надається допомога. Це відповідальність закладу як контролера.",
            ],
            en: [
              "The platform is used by healthcare professionals, so we do not create accounts for anyone under 18.",
              "Clinical data about minor patients is processed like any other, with consent given by a legal representative under the law of the country where care is delivered. That is the organization's responsibility as controller.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "14. Інциденти безпеки", en: "14. Security incidents" }),
          paragraphs: t({
            uk: [
              "Виявивши порушення захисту персональних даних, ми повідомляємо заклад-контролера без невиправданої затримки і не пізніше ніж через 48 годин після того, як дізналися про нього, надаючи все необхідне для його власного повідомлення наглядовому органу протягом 72 годин.",
              "Щодо даних, контролером яких є ми, ми самі повідомляємо наглядовий орган у той самий 72-годинний строк і, якщо ризик для вас високий, — вас особисто.",
            ],
            en: [
              "On becoming aware of a personal data breach we notify the controller organization without undue delay and no later than 48 hours, with everything it needs for its own notification to the supervisory authority within 72 hours.",
              "For data where we are the controller, we notify the supervisory authority within the same 72-hour period and, where the risk to you is high, notify you directly.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "15. Зміни політики", en: "15. Changes to this policy" }),
          paragraphs: t({
            uk: [
              "Версія та дата вказані вгорі сторінки. Про суттєві зміни ми повідомляємо закладам щонайменше за 30 днів до набрання чинності; редакційні правки набувають чинності з дати публікації.",
              "Попередні редакції надаються на запит — у нас немає інтересу в тому, щоб історія цього документа була недоступною.",
            ],
            en: [
              "The version and date are at the top of this page. We notify organizations of material changes at least 30 days before they take effect; editorial corrections take effect on publication.",
              "Earlier versions are available on request — we have no interest in this document having an unavailable history.",
            ],
          }) },

        { type: "contact",
          items: t({
            uk: [
              { icon: "shield", title: "Питання конфіденційності", value: "privacy@klarnote.com", note: "Запити щодо ваших даних, реалізації прав, копії попередніх редакцій." },
              { icon: "user", title: "Відповідальний за захист даних", value: "dpo@klarnote.com", note: "[ІМ’Я ВІДПОВІДАЛЬНОГО ЗА ЗАХИСТ ДАНИХ]. Представник у ЄС: [ПРЕДСТАВНИК У ЄС]." },
              { icon: "alert", title: "Скарга до наглядового органу", value: "privacy@klarnote.com", note: "Ви маєте право звернутися до [НАГЛЯДОВОГО ОРГАНУ] незалежно від звернення до нас." },
            ],
            en: [
              { icon: "shield", title: "Privacy questions", value: "privacy@klarnote.com", note: "Requests about your data, exercising your rights, copies of earlier versions." },
              { icon: "user", title: "Data Protection Officer", value: "dpo@klarnote.com", note: "[DPO CONTACT]. EU representative: [EU REPRESENTATIVE]." },
              { icon: "alert", title: "Complaint to a supervisory authority", value: "privacy@klarnote.com", note: "You may complain to [LEAD SUPERVISORY AUTHORITY] whether or not you come to us first." },
            ],
          }) },
      ],
    },

    /* ═══════════════════════════════════════════════════════════════════════
       TERMS OF SERVICE
       ═══════════════════════════════════════════════════════════════════════ */
    "legal/terms": {
      hero: {
        eyebrow: EYEBROW,
        title: t({ uk: "Умови використання", en: "Terms of Service", pl: "Warunki korzystania z usługi", de: "Nutzungsbedingungen", ro: "Termeni și condiții", cs: "Podmínky služby", sr: "Uslovi korišćenja", hu: "Felhasználási feltételek", ar: "شروط الخدمة", es: "Términos del servicio", pt: "Termos de Serviço" }),
        sub: t({
          uk: "Договір між Klarnote та медичним закладом, а також правила для лікарів, які працюють у платформі.",
          en: "The agreement between Klarnote and a healthcare organization, and the rules for the clinicians who work in the platform.",
        }),
        updated: UPDATED,
      },
      blocks: [
        DRAFT_NOTICE,

        { type: "prose",
          heading: t({ uk: "1. Сторони та структура договору", en: "1. Parties and structure of the agreement" }),
          paragraphs: t({
            uk: [
              "Ці умови укладаються між [НАЗВА ЮРИДИЧНОЇ ОСОБИ], [ЮРИДИЧНА АДРЕСА], реєстраційний номер [РЕЄСТРАЦІЙНИЙ НОМЕР] («Klarnote», «ми»), та медичним закладом, який замовляє сервіс («Замовник», «ви»).",
              "Лікарі, адміністратори та інші працівники Замовника («Користувачі») отримують доступ у межах договору Замовника. Користувач, який входить у систему, погоджується з розділами 4–7 цих умов особисто; решта розділів регулює відносини з Замовником.",
              "Договірні документи застосовуються в такому порядку старшинства: підписане замовлення або окремий договір; Угода про обробку даних; ці Умови; Політика конфіденційності. Якщо документ вищого рівня суперечить нижчому — діє вищий.",
            ],
            en: [
              "These terms are between [LEGAL ENTITY NAME], [REGISTERED ADDRESS], company number [COMPANY REGISTRATION NUMBER] (“Klarnote”, “we”) and the healthcare organization ordering the service (“Customer”, “you”).",
              "Clinicians, administrators and other staff of the Customer (“Users”) get access under the Customer's agreement. A User who signs in accepts sections 4–7 personally; the remaining sections govern the relationship with the Customer.",
              "The contract documents apply in this order of precedence: a signed order form or separate agreement; the Data Processing Agreement; these Terms; the Privacy Policy. Where a higher document conflicts with a lower one, the higher prevails.",
            ],
          }) },

        { type: "spec",
          heading: t({ uk: "2. Визначення", en: "2. Definitions" }),
          rows: [
            { key: "d1", label: t({ uk: "Сервіс", en: "Service" }),
              value: t({ uk: "Платформа Klarnote: розпізнавання мовлення, структурування нотаток, шаблони, підписання документів, доказова база та супутні модулі, надані Замовнику.", en: "The Klarnote platform: speech recognition, note structuring, templates, document signing, the evidence module and related components made available to the Customer." }) },
            { key: "d2", label: t({ uk: "Дані Замовника", en: "Customer Data" }),
              value: t({ uk: "Усе, що Замовник і його Користувачі вносять або створюють у Сервісі: аудіо, транскрипти, звіти, картки пацієнтів, шаблони, згоди.", en: "Everything the Customer and its Users enter or create in the Service: audio, transcripts, reports, patient records, templates, consents." }) },
            { key: "d3", label: t({ uk: "Результат роботи моделі", en: "Model Output" }),
              value: t({ uk: "Транскрипт, чернетка нотатки, пропозиція доповнення чи відповідь доказової бази, згенеровані Сервісом до перевірки лікарем.", en: "A transcript, draft note, completion suggestion or evidence answer produced by the Service before a clinician reviews it." }) },
            { key: "d4", label: t({ uk: "Підписаний документ", en: "Signed Document" }),
              value: t({ uk: "Клінічний документ, затверджений лікарем і скріплений кваліфікованим електронним підписом.", en: "A clinical document approved by a clinician and sealed with a qualified electronic signature." }) },
            { key: "d5", label: t({ uk: "Адміністратор закладу", en: "Organization Administrator" }),
              value: t({ uk: "Користувач, уповноважений Замовником запрошувати інших користувачів, призначати ролі та керувати налаштуваннями закладу.", en: "A User the Customer authorises to invite others, assign roles and manage organization settings." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "3. Що входить у Сервіс", en: "3. What the Service is" }),
          paragraphs: t({
            uk: [
              "Сервіс перетворює мовлення на структуровану медичну документацію: диктування та амбієнтний запис прийому, розпізнавання, структурування за шаблонами, підказки під час набору, підписання, зберігання з аудитом, а також пошук у доказовій базі.",
              "Склад модулів, ліміти, кількість користувачів і середовище розгортання визначаються замовленням. Ми можемо додавати функції та вдосконалювати наявні; про припинення підтримки суттєвої функції ми повідомляємо не менш ніж за [СТРОК ПОПЕРЕДЖЕННЯ] до її вимкнення.",
            ],
            en: [
              "The Service turns speech into structured clinical documentation: dictation and ambient recording of a consultation, recognition, structuring against templates, in-line suggestions, signing, storage with an audit trail, and evidence retrieval.",
              "Which modules, limits, seat counts and deployment environment apply is set by the order form. We may add features and improve existing ones; if we withdraw a material feature we give at least [NOTICE PERIOD] notice before switching it off.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "4. Доступ та облікові записи", en: "4. Access and accounts" }),
          bullets: t({
            uk: [
              "Доступ надається за запрошенням Адміністратора закладу. Самостійна реєстрація лікаря без закладу не передбачена.",
              "Обліковий запис персональний. Передавати пароль, ключ двофакторної автентифікації чи активну сесію іншій особі заборонено — це руйнує аудит, який робить документацію доказовою.",
              "Замовник відповідає за актуальність переліку користувачів: доступ звільненого працівника має бути відкликаний невідкладно.",
              "Ми можемо вимагати двофакторної автентифікації для ролей із доступом до медичних даних.",
              "Ми можемо негайно припинити сесії облікового запису за ознаками компрометації, повідомивши Адміністратора закладу.",
            ],
            en: [
              "Access is granted by invitation from an Organization Administrator. There is no self-registration for a clinician without an organization.",
              "An account is personal. Sharing a password, a two-factor secret or a live session is prohibited — it destroys the audit trail that makes the documentation defensible.",
              "The Customer is responsible for keeping its user list current: a departing member of staff must have access revoked promptly.",
              "We may require two-factor authentication for roles that reach clinical data.",
              "We may end an account's sessions immediately on signs of compromise, notifying the Organization Administrator.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "5. Обов’язки Замовника", en: "5. Customer responsibilities" }),
          bullets: t({
            uk: [
              "Забезпечити правову підставу для обробки даних пацієнтів і отримати згоду там, де вона потрібна — зокрема до початку запису розмови.",
              "Використовувати Сервіс відповідно до законодавства про медичну документацію, лікарську таємницю та захист персональних даних тієї країни, де надається допомога.",
              "Забезпечити перевірку кожного клінічного документа лікарем до підписання. Сервіс не звільняє від цього обов’язку і не може його виконати.",
              "Керувати ролями за принципом найменших привілеїв і не використовувати екстрений доступ («break-glass») інакше ніж у справжніх невідкладних випадках, які підлягають внутрішньому розгляду.",
              "Підтримувати актуальність даних пацієнтів і виправляти неточності, виявлені під час перевірки транскриптів.",
            ],
            en: [
              "Establish the lawful basis for processing patient data and obtain consent where it is required — in particular before a consultation is recorded.",
              "Use the Service in line with the records, professional-secrecy and data-protection law of the country where care is delivered.",
              "Ensure a clinician reviews every clinical document before signing. The Service does not remove that duty and cannot discharge it.",
              "Manage roles on a least-privilege basis and use emergency access (“break-glass”) only in genuine urgent need, subject to internal review.",
              "Keep patient records accurate and correct inaccuracies found while reviewing transcripts.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "6. Допустиме використання", en: "6. Acceptable use" }),
          paragraphs: t({
            uk: ["Забороняється:"],
            en: ["You must not:"],
          }),
          bullets: t({
            uk: [
              "Обходити або намагатися обійти контроль доступу, ізоляцію закладів чи журнал аудиту.",
              "Використовувати екстрений доступ для перегляду записів, до яких у вас немає клінічного відношення.",
              "Завантажувати шкідливий код або навмисно перевантажувати інфраструктуру.",
              "Здійснювати зворотну розробку, декомпіляцію чи вилучення вагових коефіцієнтів моделей, окрім випадків, прямо дозволених законом.",
              "Публікувати результати тестування продуктивності без нашої письмової згоди.",
              "Вносити до Сервісу дані пацієнтів, щодо яких Замовник не є контролером, а також будь-які дані з метою, не пов’язаною з наданням медичної допомоги.",
              "Використовувати Результат роботи моделі як єдину підставу для діагнозу, призначення чи іншого клінічного рішення.",
            ],
            en: [
              "Bypass or attempt to bypass access controls, organization isolation or the audit log.",
              "Use emergency access to read records you have no clinical relationship with.",
              "Upload malicious code or deliberately overload the infrastructure.",
              "Reverse engineer, decompile or extract model weights, except where law expressly permits it.",
              "Publish benchmark results without our written consent.",
              "Put patient data into the Service where the Customer is not the controller, or any data for a purpose unconnected with delivering care.",
              "Rely on Model Output as the sole basis for a diagnosis, a prescription or any other clinical decision.",
            ],
          }) },

        /* The clinical-safety section. This is the one that matters most in a
           dispute and the one a generic SaaS template does not have. Keep it
           consistent with the product's own language: the system drafts, it
           does not diagnose, and nothing is finalized without a clinician. */
        { type: "prose",
          heading: t({ uk: "7. Клінічна безпека та межі можливостей", en: "7. Clinical safety and limitations" }),
          lead: t({
            uk: "Прочитайте цей розділ уважно — він визначає, чим Klarnote є і чим не є.",
            en: "Read this section carefully — it defines what Klarnote is and is not.",
          }),
          paragraphs: t({
            uk: [
              "Klarnote — інструмент підтримки документування. Система готує чернетку, але не ставить діагноз, не призначає лікування і ніколи не фіналізує документ самостійно.",
              "Розпізнавання мовлення помиляється. Помилки трапляються в назвах препаратів, дозуваннях, числах, одиницях вимірювання, запереченнях і прізвищах — тобто саме там, де вони найнебезпечніші. Слова з низькою впевненістю моделі позначаються в інтерфейсі, але позначення не є гарантією: невиділене слово теж може бути розпізнане неправильно. Перевірка тексту перед підписанням — обов’язок лікаря, і підписання є підтвердженням того, що така перевірка відбулася.",
              "Відповіді доказової бази є довідковими. Вони спираються на джерела, які цитуються, і не враховують повного клінічного контексту пацієнта. Вони не є медичною порадою і не замінюють професійне судження.",
              "Регуляторний статус: [РЕГУЛЯТОРНИЙ СТАТУС]. Сервіс надається як інструмент документування; він не призначений для діагностики, моніторингу чи лікування і не має використовуватися як єдине джерело клінічного рішення.",
              "Сервіс не є системою екстреного сповіщення. Він не відстежує критичних результатів, не надсилає клінічних тривог і не має використовуватися у сценаріях, де затримка чи недоступність створює безпосередню загрозу життю.",
            ],
            en: [
              "Klarnote is a documentation support tool. The system drafts; it does not diagnose, does not prescribe, and never finalizes a document by itself.",
              "Speech recognition makes mistakes. They occur in drug names, doses, numbers, units, negations and surnames — which is to say, exactly where they are most dangerous. Words the model is unsure of are flagged in the interface, but a flag is not a guarantee: an unflagged word can also be wrong. Checking the text before signing is the clinician's duty, and signing is the assertion that the check happened.",
              "Evidence answers are reference material. They rest on the sources they cite and do not account for the patient's full clinical context. They are not medical advice and do not replace professional judgement.",
              "Regulatory status: [REGULATORY STATUS]. The Service is supplied as a documentation tool; it is not intended for diagnosis, monitoring or treatment and must not be used as the sole source of a clinical decision.",
              "The Service is not an alerting system. It does not track critical results, does not raise clinical alarms, and must not be used where delay or unavailability would create an immediate risk to life.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "8. Електронний підпис", en: "8. Electronic signature" }),
          paragraphs: t({
            uk: [
              "Сервіс підтримує підписання документів кваліфікованим електронним підписом, зокрема через Дію та контейнери ключів, видані кваліфікованими надавачами. Юридична сила підпису визначається законодавством країни його видачі, а не цими умовами.",
              "Підписувати клінічні документи може лише Користувач із роллю лікаря та відповідним правом. Адміністративні ролі такого права не мають — і не можуть його собі надати.",
              "Ключі підпису та паролі до контейнерів належать підписувачу; ми їх не зберігаємо. Замовник відповідає за їх належне зберігання.",
              "Конверт підпису зберігається разом із документом як юридичний доказ і не видаляється навіть за запитом на видалення даних — про це прямо повідомляється у звіті про виконання такого запиту.",
            ],
            en: [
              "The Service supports signing documents with a qualified electronic signature, including through Дія (Diia) and key containers issued by qualified providers. The legal effect of a signature is determined by the law of the country that issued it, not by these terms.",
              "Only a User holding a clinician role with the signing permission can sign a clinical document. Administrative roles do not hold that permission — and cannot grant it to themselves.",
              "Signing keys and container passwords belong to the signer; we do not store them. The Customer is responsible for keeping them safe.",
              "The signature envelope is retained with the document as legal evidence and is not deleted even on an erasure request — the execution report for that request says so explicitly.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "9. Права на дані та інтелектуальну власність", en: "9. Data and intellectual property" }),
          bullets: t({
            uk: [
              "Дані Замовника належать Замовнику. Ми не набуваємо на них прав і не використовуємо їх у власних цілях.",
              "Права на Сервіс, його програмне забезпечення, інтерфейс і документацію належать Klarnote. Замовник отримує невиключне право використання на строк дії договору.",
              "Результат роботи моделі є частиною Даних Замовника з моменту створення; відповідальність за його зміст після перевірки й підписання несе лікар.",
              "Ми не навчаємо моделі на Даних Замовника. Використання знеособлених даних для покращення якості розпізнавання можливе лише за окремою письмовою інструкцією Замовника і є вимкненим за замовчуванням.",
              "Пропозиції та зауваження щодо продукту ми можемо вільно використовувати для його вдосконалення без зобов’язань, за умови, що вони не містять Даних Замовника.",
            ],
            en: [
              "Customer Data belongs to the Customer. We acquire no rights in it and do not use it for our own purposes.",
              "The Service, its software, interface and documentation belong to Klarnote. The Customer receives a non-exclusive right to use them for the term of the agreement.",
              "Model Output forms part of Customer Data from the moment it is produced; responsibility for its content once reviewed and signed rests with the clinician.",
              "We do not train models on Customer Data. Using de-identified data to improve recognition quality is possible only on the Customer's separate written instruction and is off by default.",
              "Product suggestions and feedback we may use freely to improve the Service without obligation, provided they contain no Customer Data.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "10. Оплата", en: "10. Fees" }),
          paragraphs: t({
            uk: [
              "Вартість, модель тарифікації, валюта та періодичність визначаються замовленням. Якщо не погоджено інше, рахунки виставляються наперед і оплачуються протягом [СТРОК ОПЛАТИ] з дати рахунка.",
              "Ціни не включають податків, які нараховуються додатково згідно із законодавством. Ми можемо переглядати ціни на наступний період, повідомивши не менш ніж за [СТРОК ПОПЕРЕДЖЕННЯ] до його початку; чинний оплачений період змінам не підлягає.",
              "Прострочення оплати понад 30 днів дає підстави призупинити Сервіс у порядку розділу 15 — але не позбавляє Замовника права вивантажити свої дані згідно з розділом 16.",
            ],
            en: [
              "Price, pricing model, currency and billing period are set by the order form. Unless agreed otherwise, invoices are issued in advance and payable within [PAYMENT TERM] of the invoice date.",
              "Prices exclude taxes, which are added as law requires. We may revise prices for a following period on at least [NOTICE PERIOD] notice before it starts; a period already paid for is not affected.",
              "Payment more than 30 days overdue is grounds for suspension under section 15 — but does not remove the Customer's right to export its data under section 16.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "11. Доступність, підтримка, обслуговування", en: "11. Availability, support, maintenance" }),
          bullets: t({
            uk: [
              "Цільова доступність — [ЦІЛЬОВИЙ РІВЕНЬ SLA] на місяць, без урахування планових робіт і обставин непереборної сили.",
              "Підтримка доступна [ГОДИНИ ПІДТРИМКИ] через support@klarnote.com.",
              "Планові роботи анонсуються заздалегідь і за можливості проводяться поза робочими годинами. Позапланові роботи з усунення загрози безпеці можуть виконуватися без попередження, з подальшим повідомленням.",
              "Поточний стан сервісів опублікований на сторінці статусу.",
              "У розгортаннях на обладнанні Замовника доступність залежить від його інфраструктури, і ці показники до них не застосовуються.",
            ],
            en: [
              "The availability target is [SLA TARGET] per month, excluding planned maintenance and force majeure.",
              "Support is available [SUPPORT HOURS] at support@klarnote.com.",
              "Planned maintenance is announced in advance and, where possible, carried out outside working hours. Unplanned work to close a security exposure may proceed without notice, with notification afterwards.",
              "Live service status is published on the status page.",
              "In deployments on the Customer's own hardware, availability depends on the Customer's infrastructure and these figures do not apply.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "12. Конфіденційність", en: "12. Confidentiality" }),
          paragraphs: t({
            uk: [
              "Кожна сторона зберігає конфіденційність інформації іншої сторони, отриманої у зв’язку з договором, і використовує її лише для його виконання. Обов’язок діє протягом строку договору і п’ять років після його завершення, а щодо медичних даних і лікарської таємниці — безстроково.",
              "Розкриття на вимогу закону допускається за умови попереднього повідомлення іншої сторони, якщо таке повідомлення не заборонене.",
            ],
            en: [
              "Each party keeps the other's information received in connection with the agreement confidential and uses it only to perform the agreement. The obligation runs for the term and five years after it, and indefinitely for clinical data and professional secrecy.",
              "Disclosure required by law is permitted provided the other party is notified first, where notification is not itself prohibited.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "13. Гарантії та їх межі", en: "13. Warranties and disclaimers" }),
          paragraphs: t({
            uk: [
              "Ми гарантуємо, що надаватимемо Сервіс з розумною професійною дбайливістю, відповідно до опублікованої документації, і що маємо право надати передбачені договором права.",
              "В усьому іншому Сервіс надається «як є». Ми не гарантуємо безпомилковості розпізнавання, повноти чи актуальності доказової бази, а також безперебійної роботи. Ці застереження не обмежують гарантій, від яких не можна відмовитися за застосовним законодавством.",
            ],
            en: [
              "We warrant that we will provide the Service with reasonable professional care, in accordance with the published documentation, and that we have the right to grant the rights set out in the agreement.",
              "Otherwise the Service is provided “as is”. We do not warrant that recognition is error-free, that the evidence corpus is complete or current, or that operation will be uninterrupted. These disclaimers do not limit warranties that cannot be excluded under applicable law.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "14. Відповідальність", en: "14. Liability" }),
          paragraphs: t({
            uk: [
              "Сукупна відповідальність кожної сторони за договором обмежується [ЛІМІТ ВІДПОВІДАЛЬНОСТІ]. Жодна зі сторін не відповідає за непрямі збитки та упущену вигоду.",
              "Ці обмеження не застосовуються до: шкоди життю чи здоров’ю; умислу та грубої необережності; порушення обов’язків із захисту персональних даних; порушення прав інтелектуальної власності; обов’язку Замовника сплатити вартість Сервісу.",
              "Окремо і прямо: Klarnote не несе відповідальності за зміст підписаного клінічного документа. Підпис лікаря є підтвердженням перевірки, і клінічна відповідальність за документ належить особі, яка його підписала, та закладу.",
            ],
            en: [
              "Each party's aggregate liability under the agreement is limited to [LIABILITY CAP]. Neither party is liable for indirect loss or loss of profit.",
              "These limits do not apply to: death or personal injury; wilful misconduct and gross negligence; breach of data-protection obligations; infringement of intellectual property rights; the Customer's obligation to pay for the Service.",
              "Separately and explicitly: Klarnote is not liable for the content of a signed clinical document. The clinician's signature is the assertion that it was checked, and clinical responsibility for the document rests with the person who signed it and with the organization.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "15. Строк, призупинення, розірвання", en: "15. Term, suspension, termination" }),
          bullets: t({
            uk: [
              "Договір діє протягом строку, визначеного замовленням, і продовжується на той самий строк, якщо жодна сторона не заперечила за [СТРОК ПОПЕРЕДЖЕННЯ] до його завершення.",
              "Ми можемо призупинити доступ у разі: загрози безпеці, простроченої понад 30 днів оплати, істотного порушення розділу 6 або вимоги закону. Призупинення обмежується необхідним обсягом і триває не довше, ніж потрібно.",
              "Будь-яка сторона може розірвати договір у разі істотного порушення, не усунутого протягом 30 днів після письмової вимоги.",
              "Замовник може розірвати договір, якщо ми змінюємо ці умови на його шкоду і він заперечив протягом 30 днів із дня повідомлення.",
            ],
            en: [
              "The agreement runs for the term set by the order form and renews for the same term unless either party objects [NOTICE PERIOD] before it ends.",
              "We may suspend access for: a security threat, payment more than 30 days overdue, a material breach of section 6, or a legal requirement. Suspension is kept to the necessary scope and no longer than needed.",
              "Either party may terminate for a material breach not cured within 30 days of written notice.",
              "The Customer may terminate if we change these terms to its detriment and it objects within 30 days of notification.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "16. Вивантаження та видалення даних", en: "16. Data export and deletion" }),
          paragraphs: t({
            uk: [
              "Протягом 30 днів після завершення договору Замовник може вивантажити Дані Замовника у машинозчитуваному форматі. На письмовий запит цей строк подовжується, якщо цього вимагає передача документації іншому розпоряднику.",
              "Після завершення цього строку ми видаляємо Дані Замовника з робочих систем протягом 30 днів і з резервних копій — у межах їх звичайного циклу ротації, який не перевищує 90 днів. За письмовим розпорядженням Замовника дані натомість повертаються йому.",
              "Зберігаються лише елементи, видалення яких заборонено законом; їх перелік із зазначенням підстави надається у звіті про виконання.",
            ],
            en: [
              "For 30 days after the agreement ends the Customer may export Customer Data in a machine-readable format. On written request that window is extended where handing records to another custodian requires it.",
              "After that window we delete Customer Data from live systems within 30 days and from backups within their normal rotation cycle, which does not exceed 90 days. On the Customer's written instruction the data is returned instead.",
              "Only items the law forbids us to delete are retained; they are listed with their basis in an execution report.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "17. Зміни умов", en: "17. Changes to these terms" }),
          paragraphs: t({
            uk: [
              "Про суттєві зміни ми повідомляємо Замовника не менш ніж за 30 днів до набрання чинності. Заперечення протягом цього строку дає право розірвати договір без санкцій відповідно до розділу 15.",
              "Зміни, потрібні для дотримання законодавства, можуть набирати чинності швидше, з поясненням причини.",
            ],
            en: [
              "We give the Customer at least 30 days' notice of material changes. Objecting within that period gives the right to terminate without penalty under section 15.",
              "Changes required for legal compliance may take effect sooner, with the reason explained.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "18. Інші положення", en: "18. General" }),
          bullets: t({
            uk: [
              "Застосовне право — [ЗАСТОСОВНЕ ПРАВО]; місце розгляду спорів — [ЮРИСДИКЦІЯ], без шкоди для імперативних норм захисту прав споживача та пацієнта.",
              "Перед зверненням до суду сторони добросовісно намагаються врегулювати спір переговорами протягом 30 днів.",
              "Обставини непереборної сили звільняють від відповідальності за невиконання на час їх дії, крім обов’язку оплати вже наданого.",
              "Передання прав за договором можливе лише за письмовою згодою іншої сторони, крім передання правонаступнику при реорганізації.",
              "Недійсність окремого положення не впливає на решту договору.",
              "Повідомлення надсилаються на адреси, зазначені в замовленні; для нас — legal@klarnote.com.",
            ],
            en: [
              "Governing law is [GOVERNING LAW]; the venue for disputes is [VENUE], without prejudice to mandatory consumer and patient protections.",
              "Before going to court the parties will try in good faith to settle a dispute by negotiation for 30 days.",
              "Force majeure excuses non-performance while it lasts, except the obligation to pay for what has already been delivered.",
              "Assignment requires the other party's written consent, except to a successor on reorganisation.",
              "If a provision is invalid, the rest of the agreement stands.",
              "Notices go to the addresses on the order form; for us, legal@klarnote.com.",
            ],
          }) },

        { type: "contact",
          items: t({
            uk: [
              { icon: "fileText", title: "Договірні питання", value: "legal@klarnote.com", note: "Умови, замовлення, повідомлення за договором." },
              { icon: "shield", title: "Захист даних", value: "privacy@klarnote.com", note: "Угода про обробку даних, запити суб’єктів даних, інциденти." },
              { icon: "activity", title: "Підтримка", value: "support@klarnote.com", note: "[ГОДИНИ ПІДТРИМКИ]. Стан сервісів — на сторінці статусу." },
            ],
            en: [
              { icon: "fileText", title: "Contract questions", value: "legal@klarnote.com", note: "Terms, order forms, contractual notices." },
              { icon: "shield", title: "Data protection", value: "privacy@klarnote.com", note: "The DPA, data subject requests, incidents." },
              { icon: "activity", title: "Support", value: "support@klarnote.com", note: "[SUPPORT HOURS]. Live service state on the status page." },
            ],
          }) },
      ],
    },

    /* ═══════════════════════════════════════════════════════════════════════
       DATA PROCESSING AGREEMENT — the Art. 28(3) clauses, in the order the
       article lists them so a reviewer can tick them off.
       ═══════════════════════════════════════════════════════════════════════ */
    "legal/data": {
      hero: {
        eyebrow: EYEBROW,
        title: t({ uk: "Угода про обробку даних", en: "Data Processing Agreement", pl: "Umowa powierzenia przetwarzania danych", de: "Auftragsverarbeitungsvertrag", ro: "Acord de prelucrare a datelor", cs: "Smlouva o zpracování osobních údajů", sr: "Ugovor o obradi podataka", hu: "Adatfeldolgozási szerződés", ar: "اتفاقية معالجة البيانات", es: "Acuerdo de tratamiento de datos", pt: "Acordo de tratamento de dados" }),
        sub: t({
          uk: "Обов’язкові умови статті 28 GDPR між медичним закладом як контролером і Klarnote як обробником.",
          en: "The mandatory Article 28 GDPR terms between the healthcare organization as controller and Klarnote as processor.",
        }),
        updated: UPDATED,
      },
      blocks: [
        DRAFT_NOTICE,

        { type: "prose",
          heading: t({ uk: "1. Предмет і ролі", en: "1. Subject matter and roles" }),
          paragraphs: t({
            uk: [
              "Ця Угода є невід’ємною частиною договору між [НАЗВА ЮРИДИЧНОЇ ОСОБИ] («Обробник») і медичним закладом («Контролер») і регулює обробку персональних даних, яку Обробник здійснює від імені Контролера при наданні платформи Klarnote.",
              "Контролер визначає мету та засоби обробки. Обробник діє виключно за документованими інструкціями Контролера. У разі суперечності між цією Угодою та іншими документами договору щодо захисту даних переважає ця Угода.",
            ],
            en: [
              "This Agreement forms part of the contract between [LEGAL ENTITY NAME] (“Processor”) and the healthcare organization (“Controller”) and governs the processing of personal data the Processor carries out on the Controller's behalf in providing the Klarnote platform.",
              "The Controller determines the purposes and means of processing. The Processor acts only on the Controller's documented instructions. Where this Agreement conflicts with other contract documents on data protection, this Agreement prevails.",
            ],
          }) },

        { type: "spec",
          heading: t({ uk: "2. Опис обробки (Додаток I)", en: "2. Description of processing (Annex I)" }),
          rows: [
            { key: "a", label: t({ uk: "Предмет", en: "Subject matter" }),
              value: t({ uk: "Надання платформи медичної документації: розпізнавання мовлення, структурування, зберігання, підписання та аудит клінічних документів.", en: "Provision of a clinical documentation platform: speech recognition, structuring, storage, signing and audit of clinical documents." }) },
            { key: "b", label: t({ uk: "Тривалість", en: "Duration" }),
              value: t({ uk: "Строк дії договору та період вивантаження й видалення даних після його завершення.", en: "The term of the contract plus the export and deletion window after it ends." }) },
            { key: "c", label: t({ uk: "Характер і мета", en: "Nature and purpose" }),
              value: t({ uk: "Автоматизована обробка з метою створення, зберігання та захисту медичної документації під відповідальність медичного працівника.", en: "Automated processing to create, store and protect clinical records under the responsibility of a healthcare professional." }) },
            { key: "d", label: t({ uk: "Категорії суб’єктів даних", en: "Categories of data subjects" }),
              value: t({ uk: "Пацієнти Контролера; лікарі та інший персонал Контролера; адміністратори закладу.", en: "The Controller's patients; the Controller's clinicians and other staff; organization administrators." }) },
            { key: "e", label: t({ uk: "Категорії персональних даних", en: "Categories of personal data" }),
              value: t({ uk: "Ідентифікаційні та контактні дані; аудіозаписи; транскрипти; клінічний зміст; записи про згоду; облікові й аудиторські дані.", en: "Identity and contact data; audio recordings; transcripts; clinical content; consent records; account and audit data." }) },
            { key: "f", label: t({ uk: "Особливі категорії", en: "Special categories" }),
              value: t({ uk: "Дані про стан здоров’я (ст. 9 GDPR), включно з голосом пацієнта в режимі запису розмови.", en: "Health data (Art. 9 GDPR), including the patient's voice in conversation recording mode." }) },
            { key: "g", label: t({ uk: "Частота", en: "Frequency" }),
              value: t({ uk: "Постійна, протягом користування Сервісом.", en: "Continuous, for as long as the Service is used." }) },
          ] },

        { type: "prose",
          heading: t({ uk: "3. Обробка лише за інструкцією", en: "3. Processing only on instruction" }),
          paragraphs: t({
            uk: [
              "Обробник обробляє персональні дані лише за документованими інструкціями Контролера, включно з передачею до третіх країн, крім випадків, коли обробки вимагає право ЄС або держави-члена, якому підпорядковується Обробник. У такому разі Обробник повідомляє Контролера про цю вимогу до початку обробки, якщо це не заборонено законом із міркувань суспільного інтересу.",
              "Документованими інструкціями вважаються: цей документ, договір, налаштування, зроблені Контролером у Сервісі, та письмові вказівки уповноважених осіб Контролера. Дії користувачів Контролера в інтерфейсі є інструкціями Контролера.",
              "Обробник негайно повідомляє Контролера, якщо, на його думку, інструкція порушує GDPR або інше застосовне законодавство про захист даних, і має право призупинити виконання такої інструкції.",
            ],
            en: [
              "The Processor processes personal data only on the Controller's documented instructions, including as regards transfers to third countries, unless required to process by Union or Member State law to which the Processor is subject. In that case the Processor informs the Controller of that requirement before processing, unless the law prohibits it on important grounds of public interest.",
              "Documented instructions are: this document, the contract, the configuration the Controller sets in the Service, and written directions from the Controller's authorised personnel. Actions taken by the Controller's users in the interface are the Controller's instructions.",
              "The Processor immediately informs the Controller if, in its opinion, an instruction infringes the GDPR or other applicable data-protection law, and may suspend performance of that instruction.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "4. Конфіденційність персоналу", en: "4. Confidentiality of personnel" }),
          paragraphs: t({
            uk: [
              "Обробник забезпечує, щоб особи, уповноважені на обробку, взяли на себе зобов’язання про конфіденційність або перебували під відповідним законним обов’язком її дотримання, а також отримали інструктаж щодо роботи з даними про здоров’я.",
              "Доступ персоналу Обробника до даних Контролера надається лише за потреби підтримки, у мінімальному обсязі, на обмежений час і з фіксацією в аудиті. За можливості підтримка надається без доступу до змісту клінічних записів.",
            ],
            en: [
              "The Processor ensures that persons authorised to process the data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality, and are trained in handling health data.",
              "Access by the Processor's staff to the Controller's data is granted only where support requires it, in the minimum scope, for a limited time and recorded in the audit log. Where possible support is delivered without access to the content of clinical records.",
            ],
          }) },

        /* Annex II. Same measures as the privacy policy's section 9 — they
           must not drift apart, so if you edit one, edit both. */
        { type: "prose",
          heading: t({ uk: "5. Технічні та організаційні заходи (Додаток II)", en: "5. Technical and organisational measures (Annex II)" }),
          lead: t({
            uk: "Заходи за статтею 32 GDPR, реалізовані в платформі.",
            en: "The Article 32 GDPR measures as implemented in the platform.",
          }),
          bullets: t({
            uk: [
              "Псевдонімізація та шифрування: шифрування під час передачі та зберігання, включно з аудіо; знеособлення даних, що використовуються для покращення якості моделей.",
              "Конфіденційність: ізоляція закладів на рівні бази даних через row-level security; рольова модель найменших привілеїв; двофакторна автентифікація; відкликання сесій; екстрений доступ лише з повторною автентифікацією, зазначенням причини та записом в аудиті.",
              "Цілісність: append-only журнал аудиту з хеш-ланцюгом, незмінність якого контролюється базою даних і звіряється щоночі; версійність клінічних документів; кваліфікований електронний підпис.",
              "Доступність: резервне копіювання з перевіркою цілісності, регламентоване відновлення, моніторинг стану сервісів.",
              "Стійкість: розділення сервісів, обмеження навантаження, контроль джерел підключення на рівні політики безпеки контенту, обчислена з фактичної карти сервісів.",
              "Регулярна перевірка: тестування відновлення, перегляд прав доступу, аналіз журналів аудиту, оцінка змін, що впливають на захист даних.",
            ],
            en: [
              "Pseudonymisation and encryption: encryption in transit and at rest, audio included; de-identification of any data used to improve model quality.",
              "Confidentiality: organization isolation at the database level through row-level security; least-privilege role model; two-factor authentication; session revocation; emergency access only with step-up re-authentication, a stated reason and an audit entry.",
              "Integrity: an append-only, hash-chained audit log whose immutability is enforced by the database and reconciled nightly; versioning of clinical documents; qualified electronic signature.",
              "Availability: backups with integrity verification, a documented restore procedure, service health monitoring.",
              "Resilience: service separation, rate limiting, and connection-source control through a content security policy computed from the actual service map.",
              "Regular testing: restore drills, access reviews, audit-log analysis, and assessment of changes that affect data protection.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "6. Субобробники (Додаток III)", en: "6. Sub-processors (Annex III)" }),
          paragraphs: t({
            uk: [
              "Контролер надає загальний письмовий дозвіл на залучення субобробників. Обробник повідомляє про намір залучити нового субобробника або замінити наявного не менш ніж за 30 днів; Контролер може заперечити з обґрунтованих підстав захисту даних протягом цього строку, і за неможливості усунути заперечення має право розірвати договір без санкцій.",
              "Обробник укладає з кожним субобробником договір із зобов’язаннями, не меншими за передбачені цією Угодою, і несе повну відповідальність за їх виконання.",
              "Станом на дату цієї редакції жоден субобробник не має доступу до медичних даних. Чинний перелік субобробників наведено в Політиці конфіденційності, розділ 7.",
            ],
            en: [
              "The Controller gives general written authorisation for the engagement of sub-processors. The Processor gives at least 30 days' notice of an intended new or replacement sub-processor; the Controller may object on reasonable data-protection grounds within that period and, if the objection cannot be resolved, may terminate without penalty.",
              "The Processor imposes on each sub-processor obligations no less protective than this Agreement and remains fully liable for their performance.",
              "As at the date of this version, no sub-processor has access to clinical data. The current list is in the Privacy Policy, section 7.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "7. Сприяння у реалізації прав суб’єктів даних", en: "7. Assistance with data subject rights" }),
          paragraphs: t({
            uk: [
              "Зважаючи на характер обробки, Обробник забезпечує Контролеру технічні засоби для виконання запитів суб’єктів даних безпосередньо в Сервісі: формування повного архіву даних пацієнта з описом вмісту та виконання запиту на видалення з обов’язковою перевіркою другою особою й періодом очікування до виконання.",
              "Отримавши запит суб’єкта даних напряму, Обробник не відповідає на нього по суті, а невідкладно передає Контролеру.",
              "Обробник надає Контролеру звіт про виконання видалення, у якому перелічено кожен збережений елемент і правову підставу його зберігання.",
            ],
            en: [
              "Taking into account the nature of the processing, the Processor gives the Controller the technical means to answer data subject requests directly in the Service: assembly of a complete archive of a patient's data with a manifest, and execution of an erasure request with mandatory review by a second person and a grace period before execution.",
              "If the Processor receives a data subject request directly, it does not answer it on the merits but passes it to the Controller without delay.",
              "The Processor provides the Controller with an erasure execution report listing every retained item and the legal basis for retaining it.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "8. Сприяння за статтями 32–36", en: "8. Assistance with Articles 32–36" }),
          paragraphs: t({
            uk: [
              "Обробник сприяє Контролеру у забезпеченні безпеки обробки, повідомленні про інциденти, проведенні оцінки впливу на захист даних та попередніх консультаціях із наглядовим органом, надаючи наявну в нього інформацію про архітектуру, заходи захисту та потоки даних.",
              "Обробник надає Контролеру всю інформацію, необхідну для підтвердження виконання обов’язків за статтею 28 GDPR.",
            ],
            en: [
              "The Processor assists the Controller in securing the processing, notifying incidents, carrying out data protection impact assessments and consulting the supervisory authority beforehand, by supplying the information it holds on architecture, safeguards and data flows.",
              "The Processor makes available to the Controller all information necessary to demonstrate compliance with Article 28 GDPR.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "9. Повідомлення про інциденти", en: "9. Incident notification" }),
          paragraphs: t({
            uk: [
              "Обробник повідомляє Контролера про порушення захисту персональних даних без невиправданої затримки і не пізніше ніж через 48 годин після того, як дізнався про нього.",
              "Повідомлення містить характер порушення, орієнтовні категорії та кількість суб’єктів даних і записів, ймовірні наслідки, вжиті та запропоновані заходи, а також контакт для подальшого з’ясування. Якщо повний обсяг відомостей недоступний одразу, він надається поетапно без затримки решти повідомлення.",
            ],
            en: [
              "The Processor notifies the Controller of a personal data breach without undue delay and no later than 48 hours after becoming aware of it.",
              "The notification describes the nature of the breach, the approximate categories and numbers of data subjects and records, the likely consequences, the measures taken and proposed, and a contact point. Where the full information is not available at once it is provided in phases without delaying the rest.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "10. Видалення або повернення даних", en: "10. Deletion or return of data" }),
          paragraphs: t({
            uk: [
              "Після завершення надання послуг Обробник, за вибором Контролера, видаляє або повертає всі персональні дані та знищує наявні копії, крім випадків, коли зберігання вимагає право ЄС чи держави-члена.",
              "Строки та порядок наведені в Умовах використання, розділ 16. Зберігання після видалення обмежене чотирма підставами: підписаний медичний звіт у межах обов’язкового строку зберігання; запис про згоду як доказ правової підстави; конверт кваліфікованого підпису як юридичний доказ; слід виконання самого запиту на видалення.",
            ],
            en: [
              "At the end of the provision of services the Processor, at the Controller's choice, deletes or returns all personal data and destroys existing copies, unless Union or Member State law requires storage.",
              "The timing and mechanics are in the Terms of Service, section 16. Retention after erasure is limited to four bases: a signed clinical report within the statutory retention period; a consent record as evidence of the lawful basis; a qualified signature envelope as legal evidence; and the paper trail of the erasure request itself.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "11. Аудит і перевірки", en: "11. Audits and inspections" }),
          paragraphs: t({
            uk: [
              "Обробник надає Контролеру інформацію, необхідну для підтвердження виконання цієї Угоди, і допускає проведення перевірок, включно з інспекціями, які здійснює Контролер або уповноважений ним аудитор.",
              "Перевірки проводяться не частіше одного разу на рік, крім випадків обґрунтованої підозри порушення або вимоги наглядового органу, за попереднім повідомленням не менш ніж за 30 днів, у робочий час і без непропорційного втручання в роботу Обробника. Аудитор не повинен бути конкурентом Обробника і зобов’язується зберігати конфіденційність.",
              "Наявні звіти незалежних аудитів і сертифікати надаються першочергово; інспекція на місці проводиться, якщо їх недостатньо для відповіді на конкретне питання Контролера.",
            ],
            en: [
              "The Processor makes available the information needed to demonstrate compliance with this Agreement and allows for and contributes to audits, including inspections, conducted by the Controller or an auditor it mandates.",
              "Audits take place no more than once a year, except on reasonable suspicion of a breach or at a supervisory authority's requirement, on at least 30 days' notice, during business hours and without disproportionate interference with the Processor's operations. The auditor must not be a competitor of the Processor and is bound to confidentiality.",
              "Existing independent audit reports and certifications are provided first; an on-site inspection follows where they do not answer the Controller's specific question.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "12. Міжнародна передача", en: "12. International transfers" }),
          paragraphs: t({
            uk: [
              "Обробка медичних даних відбувається всередині розгортання Контролера, і передача таких даних до третіх країн не здійснюється. Моделі розпізнавання та генерації працюють локально, тож немає передачі до зовнішніх постачальників моделей.",
              "Якщо в майбутньому передача стане необхідною, вона здійснюватиметься лише за наявності належної підстави за главою V GDPR — рішення про адекватність або стандартні договірні положення разом з оцінкою впливу законодавства країни призначення — і за попереднім повідомленням Контролера з правом заперечення.",
            ],
            en: [
              "Processing of clinical data takes place inside the Controller's deployment, and such data is not transferred to third countries. Recognition and generation models run locally, so there is no transfer to external model providers.",
              "If a transfer becomes necessary in future it will take place only on a valid Chapter V basis — an adequacy decision or standard contractual clauses together with a transfer impact assessment — and on prior notice to the Controller with a right to object.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "13. Відповідальність і строк дії", en: "13. Liability and term" }),
          paragraphs: t({
            uk: [
              "Відповідальність сторін за цією Угодою регулюється розділом 14 Умов використання, за винятком випадків, коли імперативні норми GDPR передбачають інше.",
              "Ця Угода діє протягом усього часу, поки Обробник обробляє персональні дані від імені Контролера, і припиняється після завершення видалення або повернення даних згідно з розділом 10.",
            ],
            en: [
              "Liability under this Agreement is governed by section 14 of the Terms of Service, except where mandatory GDPR provisions say otherwise.",
              "This Agreement lasts for as long as the Processor processes personal data on the Controller's behalf and ends once deletion or return under section 10 is complete.",
            ],
          }) },
      ],
    },

    /* ═══════════════════════════════════════════════════════════════════════
       CONSENT NOTICE — patient-facing, and the only document here written for
       someone who is not a lawyer or an administrator. Its content must track
       src/patients/consentTexts.js (the approved version registry) and the
       consent copy in ConsentSheet.jsx.
       ═══════════════════════════════════════════════════════════════════════ */
    "legal/consent": {
      hero: {
        eyebrow: EYEBROW,
        title: t({ uk: "Згода на запис і обробку", en: "Consent to recording and processing", pl: "Zgoda", de: "Einwilligung", ro: "Consimțământ", cs: "Souhlas", sr: "Saglasnost", hu: "Hozzájárulás", ar: "الموافقة", es: "Consentimiento", pt: "Consentimento" }),
        sub: t({
          uk: "Для пацієнтів: що саме записується, куди це потрапляє, хто це бачить і як відмовитися. Без юридичної мови.",
          en: "For patients: what is recorded, where it goes, who can see it, and how to say no. Without the legal register.",
        }),
        updated: UPDATED,
      },
      blocks: [
        DRAFT_NOTICE,

        { type: "prose",
          heading: t({ uk: "Коротко", en: "In short" }),
          lead: t({
            uk: "Ваш лікар користується Klarnote, щоб не друкувати нотатки під час прийому, а говорити. Щоб це працювало, потрібен запис голосу — і саме на нього у вас запитують згоду.",
            en: "Your clinician uses Klarnote so they can speak the notes instead of typing them during your appointment. That needs a voice recording — and that is what you are being asked to agree to.",
          }),
          bullets: t({
            uk: [
              "Запис обробляється на обладнанні самої клініки. Він не надсилається до зовнішніх сервісів ШІ.",
              "Готовий текст перевіряє й підписує лікар. Система не ставить діагнозів.",
              "Ви можете відмовитися. Це не вплине на вашу медичну допомогу.",
              "Ви можете відкликати згоду пізніше.",
            ],
            en: [
              "The recording is processed on the clinic's own hardware. It is not sent to any external AI service.",
              "A clinician checks and signs the finished text. The system does not diagnose.",
              "You can say no. It will not affect the care you receive.",
              "You can withdraw your consent later.",
            ],
          }) },

        /* The three consent types are the approved registry in
           src/patients/consentTexts.js. A type not listed there cannot be
           captured — the backend rejects it — so this table is the complete set. */
        { type: "spec",
          heading: t({ uk: "Про що саме вас запитують", en: "What exactly you are asked" }),
          sub: t({
            uk: "Це три різні згоди. Одна не замінює іншу, і система це перевіряє: без потрібної згоди запис просто не почнеться.",
            en: "These are three separate consents. One does not stand in for another, and the system checks: without the right one, recording will not start.",
          }),
          rows: [
            { key: "s1", label: t({ uk: "Запис голосу лікаря", en: "Recording the clinician's voice" }),
              value: t({ uk: "Лікар диктує нотатку, записується лише його голос. Ваш голос не записується.", en: "The clinician dictates the note and only their voice is recorded. Your voice is not." }) },
            { key: "s2", label: t({ uk: "Запис розмови", en: "Recording the consultation" }),
              value: t({ uk: "Записується вся розмова — і голос лікаря, і ваш. Система розділяє голоси, а лікар перевіряє, кому належить кожна репліка. Це окрема згода, і без неї такий запис неможливий.", en: "The whole consultation is recorded — the clinician's voice and yours. The system separates the voices and the clinician reviews who said what. This is a separate consent, and without it such a recording cannot happen." }) },
            { key: "s3", label: t({ uk: "Обробка даних", en: "Processing of your data" }),
              value: t({ uk: "Загальна згода на обробку ваших медичних даних у платформі для ведення документації.", en: "General consent to your clinical data being processed in the platform for record-keeping." }) },
          ] },

        { type: "steps",
          heading: t({ uk: "Що відбувається з записом", en: "What happens to the recording" }),
          items: t({
            uk: [
              { n: "1", title: "Запис", desc: "Аудіо записується на пристрої лікаря та передається у зашифрованому вигляді." },
              { n: "2", title: "Розпізнавання", desc: "Модель на обладнанні клініки перетворює мовлення на текст. Аудіо не залишає розгортання клініки." },
              { n: "3", title: "Структурування", desc: "Текст розкладається за шаблоном нотатки: скарги, огляд, висновок, план." },
              { n: "4", title: "Перевірка лікарем", desc: "Лікар читає, виправляє й доповнює. Слова, у яких модель невпевнена, позначені." },
              { n: "5", title: "Підпис", desc: "Лікар підписує документ електронним підписом. Лише після цього нотатка стає частиною медичної документації." },
              { n: "6", title: "Видалення аудіо", desc: "Після підписання аудіозапис автоматично видаляється — він більше не потрібен." },
            ],
            en: [
              { n: "1", title: "Recording", desc: "Audio is captured on the clinician's device and sent encrypted." },
              { n: "2", title: "Recognition", desc: "A model on the clinic's own hardware turns speech into text. The audio never leaves the clinic's deployment." },
              { n: "3", title: "Structuring", desc: "The text is laid out against a note template: history, examination, findings, plan." },
              { n: "4", title: "Clinician review", desc: "The clinician reads, corrects and adds. Words the model was unsure of are flagged." },
              { n: "5", title: "Signature", desc: "The clinician signs the document electronically. Only then does the note become part of your record." },
              { n: "6", title: "Audio deleted", desc: "Once signed, the recording is deleted automatically — it has no further purpose." },
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "Як фіксується згода", en: "How consent is recorded" }),
          paragraphs: t({
            uk: [
              "Згоду можна дати трьома способами: усно, і тоді лікар засвідчує це у системі; письмово на паперовій формі; або цифрово, підписавши згоду власним кваліфікованим електронним підписом (наприклад, через Дію).",
              "Система зберігає, якого саме типу згода надана, за якою версією тексту, у який спосіб, коли й хто її засвідчив. Тексти згод версіоновані: змінити вже затверджений текст неможливо — нове формулювання стає новою версією. Тому завжди можна встановити, з чим саме ви погодилися того дня.",
            ],
            en: [
              "Consent can be given three ways: verbally, with the clinician attesting it in the system; in writing on a paper form; or digitally, by signing it with your own qualified electronic signature (through Дія, for example).",
              "The system records which consent was given, against which version of the text, by which method, when, and who attested it. Consent texts are versioned: an approved text cannot be edited — new wording becomes a new version. So it is always possible to establish what you agreed to on the day.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "Чого не відбувається", en: "What does not happen" }),
          bullets: t({
            uk: [
              "Запис не надсилається до зовнішніх сервісів розпізнавання чи ШІ — усі моделі працюють на обладнанні клініки.",
              "Дані не продаються й не передаються рекламодавцям.",
              "На вашому записі не навчають моделі, якщо клініка окремо цього не доручила, і навіть тоді — лише в знеособленому вигляді.",
              "Система не ставить діагноз і не приймає рішень щодо вашого лікування.",
              "Персонал Klarnote не переглядає вашу медичну документацію. Технічна підтримка надається без доступу до змісту записів, а будь-який винятковий доступ фіксується в журналі.",
            ],
            en: [
              "The recording is not sent to any external recognition or AI service — every model runs on the clinic's hardware.",
              "Data is not sold and not passed to advertisers.",
              "Your recording is not used to train models unless the clinic has separately instructed that, and even then only in de-identified form.",
              "The system does not diagnose and does not make decisions about your treatment.",
              "Klarnote staff do not read your record. Technical support is delivered without access to record content, and any exceptional access is logged.",
            ],
          }) },

        { type: "prose",
          heading: t({ uk: "Відкликання згоди", en: "Withdrawing consent" }),
          paragraphs: t({
            uk: [
              "Ви можете відкликати згоду будь-коли, звернувшись до клініки. Це не потребує пояснень і не має наслідків для вашого лікування.",
              "Відкликання діє на майбутнє: нові записи не робитимуться, а наявні аудіозаписи, які ще не видалені, буде видалено.",
              "Чого відкликання не скасовує: медичну нотатку, яку лікар уже підписав. Вона є частиною медичної документації, і закон вимагає її зберігання протягом встановленого строку. Так само зберігається сам запис про вашу згоду — як доказ того, що на момент запису підстава була. Якщо ви подасте запит на видалення даних, ви отримаєте перелік усього, що довелося зберегти, із зазначенням підстави: нічого не приховується.",
            ],
            en: [
              "You can withdraw consent at any time by telling the clinic. No explanation is needed and it has no consequences for your care.",
              "Withdrawal works forwards: no new recordings will be made, and any existing audio not yet deleted will be deleted.",
              "What withdrawal does not undo: a clinical note the clinician has already signed. It is part of your medical record, and the law requires it to be kept for a set period. The record of your consent is kept for the same reason — as evidence that there was a basis at the time. If you ask for your data to be erased you will receive a list of everything that had to be retained, with the reason for each: nothing is hidden.",
            ],
          }) },

        { type: "faq",
          heading: t({ uk: "Поширені запитання", en: "Common questions" }),
          items: t({
            uk: [
              { q: "Якщо я відмовлюся, мені гірше лікуватимуть?", a: "Ні. Згода на запис стосується лише способу ведення документації. Лікар оформить нотатку в інший спосіб, а обсяг і якість допомоги не зміняться. Відмова не фіксується у вашій медичній картці як щось негативне." },
              { q: "Хто може прослухати запис?", a: "Лікар, який вас приймав, і персонал клініки з відповідним правом доступу. Кожен доступ фіксується в журналі, який неможливо змінити заднім числом. Після підписання нотатки аудіо видаляється." },
              { q: "Чи можу я побачити, що записала система?", a: "Так. Зверніться до клініки — вона надасть копію ваших даних, включно з транскриптом і нотаткою. Платформа має вбудований інструмент для формування такого архіву." },
              { q: "Що як система неправильно розпізнала слово?", a: "Саме тому текст перевіряє лікар перед підписанням, а слова з низькою впевненістю позначаються. Якщо ви помітили помилку в уже підписаному документі, повідомте клініку: помилка виправляється доповненням, а не тихим переписуванням — попередня версія залишається видимою в історії." },
              { q: "Мій голос теж записується?", a: "Лише якщо ви дали окрему згоду на запис розмови. За згодою на диктування записується тільки голос лікаря." },
              { q: "Куди звертатися зі скаргою?", a: "Спершу до клініки — саме вона відповідає за ваші дані. Ви також маєте право звернутися до [НАГЛЯДОВОГО ОРГАНУ] незалежно від того, зверталися ви до клініки чи ні." },
            ],
            en: [
              { q: "If I refuse, will my care be worse?", a: "No. Consent covers only how the documentation is produced. The clinician will write the note another way, and the scope and quality of your care are unchanged. A refusal is not recorded in your file as anything adverse." },
              { q: "Who can listen to the recording?", a: "The clinician who saw you, and clinic staff holding the relevant access. Every access is written to a log that cannot be altered afterwards. Once the note is signed, the audio is deleted." },
              { q: "Can I see what the system recorded?", a: "Yes. Ask the clinic and it will give you a copy of your data, transcript and note included. The platform has a built-in tool for assembling that archive." },
              { q: "What if the system misheard a word?", a: "That is why a clinician checks the text before signing, and why low-confidence words are flagged. If you spot an error in a document already signed, tell the clinic: it is corrected by an amendment, not a quiet rewrite — the earlier version stays visible in the history." },
              { q: "Is my voice recorded too?", a: "Only if you gave the separate consent to recording the consultation. Under the dictation consent, only the clinician's voice is recorded." },
              { q: "Where do I complain?", a: "To the clinic first — it is responsible for your data. You may also complain to [LEAD SUPERVISORY AUTHORITY] whether or not you went to the clinic first." },
            ],
          }) },

        { type: "contact",
          items: t({
            uk: [
              { icon: "user", title: "Ваша клініка", value: "privacy@klarnote.com", note: "Щодо ваших медичних даних звертайтеся до закладу, який вас лікує — він є контролером даних. Ми передамо звернення, якщо ви напишете нам." },
              { icon: "shield", title: "Захист даних у Klarnote", value: "dpo@klarnote.com", note: "Питання про те, як влаштована платформа: [ІМ’Я ВІДПОВІДАЛЬНОГО ЗА ЗАХИСТ ДАНИХ]." },
            ],
            en: [
              { icon: "user", title: "Your clinic", value: "privacy@klarnote.com", note: "For your clinical data, contact the organization treating you — it is the data controller. We will pass on anything you send us." },
              { icon: "shield", title: "Data protection at Klarnote", value: "dpo@klarnote.com", note: "Questions about how the platform works: [DPO CONTACT]." },
            ],
          }) },
      ],
    },
  };
}
