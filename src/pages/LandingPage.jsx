// LandingPage.jsx — Public marketing landing for Dictat.
// Sticky menu, hero, products, features, workflow, security, CTA, footer.
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";

/* ── Copy ─────────────────────────────────────────────────────
   One bilingual dictionary keeps the marketing surface readable
   and easy to keep in sync between Ukrainian and English. */
const COPY = {
  uk: {
    nav: { product: "Продукт", features: "Можливості", workflow: "Як це працює", security: "Безпека", signin: "Увійти", start: "Запросити доступ" },
    hero: {
      eyebrow: "Медичне диктування нового покоління",
      title: "Клінічна документація голосом — швидко, точно, безпечно",
      sub: "Dictat перетворює мову лікаря на структуровані медичні нотатки в реальному часі. Менше друку, більше часу для пацієнта.",
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
      { n: "01", t: "Говоріть", d: "Почніть прийом або диктування — Dictat розпізнає мову в реальному часі." },
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
    ctaSub: "Спробуйте Dictat у вашій клініці вже сьогодні.",
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
      sub: "Dictat turns a clinician's speech into structured medical notes in real time. Less typing, more time for the patient.",
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
      { n: "01", t: "Speak", d: "Start an encounter or dictation — Dictat recognizes speech in real time." },
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
    ctaSub: "Try Dictat in your clinic today.",
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

        {/* ── Features ─────────────────────────────────────── */}
        <section className="lp-section lp-section-alt" id="features">
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
                <span className="mk-card-more">{lang === "uk" ? "Докладніше" : "Learn more"} <Icon name="arrowRight" size={14} /></span>
              </a>
            ))}
          </div>
          <div className="lp-section-cta">
            <a className="btn lp-cta-lg" href="#/features" onClick={go("/features")}>{lang === "uk" ? "Усі можливості" : "All features"}</a>
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────── */}
        <section className="lp-section" id="workflow">
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
        <section className="lp-section lp-section-alt" id="security">
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
