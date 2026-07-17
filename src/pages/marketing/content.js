// content.js — Bilingual content registry for every public marketing sub-page.
//
// Each entry is keyed by route slug and holds a `hero` plus a list of `blocks`.
// ContentPage.jsx renders the blocks by `type`:
//   prose   { heading, lead?, paragraphs?, bullets? }
//   grid    { heading?, sub?, cols?, items:[{icon,title,desc}] }
//   steps   { heading?, items:[{n,title,desc}] }
//   stats   { items:[{v,l}] }
//   faq     { heading?, items:[{q,a}] }
//   roles   { heading?, sub?, items:[{title,team,location,type}] }
//   posts   { heading?, items:[{tag,title,excerpt,date,read}] }
//   contact { items:[{icon,title,value,note}] }
//   feature-hero { icon, points:[...] }   (rendered inside hero)
//   cta     { title, sub, primary, secondary }
//
// Legal pages use `updated` for the "last updated" line.

const T = (uk, en) => ({ uk, en });

/* Reusable closing CTA so every page ends with a clear next step. */
const CTA = {
  uk: { type: "cta", title: "Готові спробувати Klarnote?", sub: "Зареєструйтесь — і поверніть лікарям час для пацієнтів.", primary: { label: "Зареєструватися", path: "/signup" }, secondary: { label: "Зв'язатися з нами", path: "/contact" } },
  en: { type: "cta", title: "Ready to try Klarnote?", sub: "Sign up and give clinicians their time back.", primary: { label: "Sign up", path: "/signup" }, secondary: { label: "Talk to us", path: "/contact" } },
};

function build(lang) {
  const uk = lang === "uk";
  const cta = uk ? CTA.uk : CTA.en;

  return {
    /* ───────────────────────── Company ───────────────────────── */
    about: {
      hero: {
        eyebrow: uk ? "Про Klarnote" : "About Klarnote",
        title: uk ? "Ми повертаємо лікарям час для пацієнтів" : "We give clinicians their time back",
        sub: uk
          ? "Klarnote народився з простого спостереження: лікарі витрачають години на документацію замість того, щоб лікувати. Ми будуємо голосову платформу, яка пише нотатки за них."
          : "Klarnote began with a simple observation: clinicians spend hours on paperwork instead of care. We build the voice platform that writes the notes for them.",
      },
      blocks: [
        { type: "stats", items: uk
          ? [{ v: "2024", l: "рік заснування" }, { v: "98%", l: "точність розпізнавання" }, { v: "2 мови", l: "українська та англійська" }, { v: "12+", l: "клінічних спеціальностей" }]
          : [{ v: "2024", l: "founded" }, { v: "98%", l: "recognition accuracy" }, { v: "2 langs", l: "Ukrainian & English" }, { v: "12+", l: "clinical specialties" }] },
        { type: "prose", heading: uk ? "Наша місія" : "Our mission",
          paragraphs: uk
            ? ["Кожна хвилина, яку лікар витрачає на друк, — це хвилина, відібрана у пацієнта. Ми хочемо, щоб документація відбувалася сама собою — точно, безпечно та зрозумілою мовою.",
               "Klarnote поєднує потокове розпізнавання медичної мови, структуровані шаблони та електронний підпис в одному робочому процесі, створеному разом із лікарями.",
               "Наш головний принцип незмінний: система готує чернетку, але не ставить діагноз. Жоден документ не фіналізується без лікаря — а всі моделі розпізнавання та генерації працюють на власному, self-hosted обладнанні, тож дані пацієнтів не залишають вашого розгортання."]
            : ["Every minute a clinician spends typing is a minute taken from the patient. We want documentation to happen on its own — accurately, securely, and in plain language.",
               "Klarnote combines streaming medical speech recognition, structured templates and e-signature into one workflow, built together with clinicians.",
               "Our core principle never changes: the system drafts, it does not diagnose. Nothing is finalized without a clinician — and every recognition and generation model runs on self-hosted hardware, so patient data never leaves your deployment."] },
        { type: "grid", heading: uk ? "Наші цінності" : "Our values", cols: 3, items: uk
          ? [
              { icon: "heart", title: "Пацієнт понад усе", desc: "Кожне рішення оцінюємо за тим, чи дає воно лікарю більше часу з пацієнтом." },
              { icon: "shield", title: "Безпека за замовчуванням", desc: "Дані пацієнтів захищені на кожному етапі — від запису до архіву." },
              { icon: "sparkle", title: "Точність важливіша за хайп", desc: "Ми вимірюємо реальну якість розпізнавання, а не обіцянки." },
              { icon: "users", title: "Створено з лікарями", desc: "Продукт формують ті, хто щодня веде прийоми." },
              { icon: "check", title: "Прозорість", desc: "Зрозуміло, як обробляються дані та як працює модель." },
              { icon: "history", title: "Надійність", desc: "Незмінний аудит і повна історія змін кожного документа." },
            ]
          : [
              { icon: "heart", title: "Patient first", desc: "Every decision is judged by whether it gives clinicians more time with patients." },
              { icon: "shield", title: "Secure by default", desc: "Patient data is protected at every step — from recording to archive." },
              { icon: "sparkle", title: "Accuracy over hype", desc: "We measure real recognition quality, not promises." },
              { icon: "users", title: "Built with clinicians", desc: "The product is shaped by the people running visits every day." },
              { icon: "check", title: "Transparency", desc: "Clear about how data is processed and how the model works." },
              { icon: "history", title: "Reliability", desc: "Immutable audit and a full change history for every document." },
            ] },
        { type: "prose", heading: uk ? "Наша історія" : "Our story",
          paragraphs: uk
            ? ["Команда Klarnote складається з інженерів та лікарів, які втомилися від нескінченної паперової роботи. Ми почали з прототипу для радіологів і швидко зрозуміли, що проблема — універсальна.",
               "Сьогодні Klarnote обслуговує амбулаторні прийоми та класичне диктування звітів, підтримує українську та англійську мови й інтегрується з електронним підписом Дія."]
            : ["The Klarnote team is engineers and clinicians tired of endless paperwork. We started with a prototype for radiologists and quickly saw the problem was universal.",
               "Today Klarnote powers ambient encounters and classic report dictation, supports Ukrainian and English, and integrates with the Дія e-signature."] },
        cta,
      ],
    },

    contact: {
      hero: {
        eyebrow: uk ? "Контакти" : "Contact",
        title: uk ? "Поговоримо" : "Let's talk",
        sub: uk
          ? "Питання про продукт, демо для вашої клініки чи партнерство — ми відповідаємо швидко."
          : "Product questions, a demo for your clinic, or a partnership — we reply fast.",
      },
      blocks: [
        { type: "contact", items: uk
          ? [
              { icon: "inbox", title: "Загальні питання", value: "hello@klarnote.example", note: "Відповідаємо протягом робочого дня." },
              { icon: "users", title: "Продажі та демо", value: "sales@klarnote.example", note: "Демо для клінік і лікарень." },
              { icon: "shield", title: "Безпека та приватність", value: "security@klarnote.example", note: "Питання щодо обробки даних." },
              { icon: "help", title: "Підтримка", value: "support@klarnote.example", note: "Для наявних користувачів." },
            ]
          : [
              { icon: "inbox", title: "General", value: "hello@klarnote.example", note: "We reply within a business day." },
              { icon: "users", title: "Sales & demos", value: "sales@klarnote.example", note: "Demos for clinics and hospitals." },
              { icon: "shield", title: "Security & privacy", value: "security@klarnote.example", note: "Data-processing questions." },
              { icon: "help", title: "Support", value: "support@klarnote.example", note: "For existing customers." },
            ] },
        { type: "form" },
        { type: "grid", heading: uk ? "Офіси" : "Offices", cols: 2, items: uk
          ? [
              { icon: "home", title: "Київ", desc: "вул. Хрещатик, 1 · Україна" },
              { icon: "home", title: "Львів", desc: "пл. Ринок, 1 · Україна" },
            ]
          : [
              { icon: "home", title: "Kyiv", desc: "1 Khreshchatyk St · Ukraine" },
              { icon: "home", title: "Lviv", desc: "1 Rynok Sq · Ukraine" },
            ] },
      ],
    },

    careers: {
      hero: {
        eyebrow: uk ? "Кар'єра" : "Careers",
        title: uk ? "Будуйте майбутнє медичної документації" : "Build the future of medical documentation",
        sub: uk
          ? "Ми невелика команда з великою місією. Якщо вам близька ідея повернути лікарям час — приєднуйтесь."
          : "We're a small team with a big mission. If giving clinicians their time back resonates with you — join us.",
      },
      blocks: [
        { type: "grid", heading: uk ? "Чому Klarnote" : "Why Klarnote", cols: 3, items: uk
          ? [
              { icon: "heart", title: "Реальний вплив", desc: "Ваша робота щодня економить години лікарям." },
              { icon: "home", title: "Віддалено", desc: "Гнучкий графік і робота з будь-якої точки." },
              { icon: "sparkle", title: "Сучасний стек", desc: "Передові моделі розпізнавання мови та чистий код." },
              { icon: "book", title: "Навчання", desc: "Бюджет на конференції, книги та курси." },
              { icon: "calendar", title: "Відпустка", desc: "Достатньо часу, щоб відновитися." },
              { icon: "users", title: "Сильна команда", desc: "Інженери та лікарі, які поважають одне одного." },
            ]
          : [
              { icon: "heart", title: "Real impact", desc: "Your work saves clinicians hours every day." },
              { icon: "home", title: "Remote-first", desc: "Flexible hours and work from anywhere." },
              { icon: "sparkle", title: "Modern stack", desc: "State-of-the-art speech models and clean code." },
              { icon: "book", title: "Learning", desc: "Budget for conferences, books and courses." },
              { icon: "calendar", title: "Time off", desc: "Enough time to actually recharge." },
              { icon: "users", title: "Great team", desc: "Engineers and clinicians who respect each other." },
            ] },
        { type: "roles", heading: uk ? "Відкриті вакансії" : "Open roles", items: uk
          ? [
              { title: "Senior ML Engineer (Speech)", team: "Дослідження", location: "Віддалено", type: "Повна зайнятість" },
              { title: "Full-Stack Engineer (React)", team: "Продукт", location: "Київ / Віддалено", type: "Повна зайнятість" },
              { title: "Clinical Product Specialist", team: "Продукт", location: "Віддалено", type: "Повна зайнятість" },
              { title: "Security Engineer", team: "Платформа", location: "Віддалено", type: "Повна зайнятість" },
            ]
          : [
              { title: "Senior ML Engineer (Speech)", team: "Research", location: "Remote", type: "Full-time" },
              { title: "Full-Stack Engineer (React)", team: "Product", location: "Kyiv / Remote", type: "Full-time" },
              { title: "Clinical Product Specialist", team: "Product", location: "Remote", type: "Full-time" },
              { title: "Security Engineer", team: "Platform", location: "Remote", type: "Full-time" },
            ] },
        { type: "prose", heading: uk ? "Не бачите своєї ролі?" : "Don't see your role?",
          paragraphs: uk
            ? ["Ми завжди раді талановитим людям. Напишіть нам на careers@klarnote.example — розкажіть, чим хочете займатися."]
            : ["We're always glad to meet talented people. Write to careers@klarnote.example and tell us what you'd love to work on."] },
        cta,
      ],
    },

    blog: {
      hero: {
        eyebrow: uk ? "Блог" : "Blog",
        title: uk ? "Ідеї, оновлення та дослідження" : "Ideas, updates and research",
        sub: uk
          ? "Як ми будуємо голосову документацію для медицини — без води."
          : "How we build voice documentation for healthcare — no fluff.",
      },
      blocks: [
        { type: "posts", items: uk
          ? [
              { tag: "Продукт", title: "Як амбулаторний скрайб змінює прийом", excerpt: "Розбираємо, що відбувається від першого слова пацієнта до структурованої нотатки.", date: "12 трав. 2026", read: "6 хв" },
              { tag: "Дослідження", title: "Чому ми підсвічуємо слова низької впевненості", excerpt: "Прозорість моделі робить перевірку швидшою та безпечнішою.", date: "28 квіт. 2026", read: "8 хв" },
              { tag: "Безпека", title: "Незмінний аудит на практиці", excerpt: "Як ми гарантуємо цілісність кожного запису в журналі подій.", date: "9 квіт. 2026", read: "5 хв" },
              { tag: "Інженерія", title: "Потокове ASR із низькою затримкою", excerpt: "Архітектура, що дає розпізнавання в реальному часі без втрати точності.", date: "21 бер. 2026", read: "10 хв" },
              { tag: "Продукт", title: "Шаблони, які економлять години", excerpt: "Як структури нотаток адаптуються під спеціальність.", date: "3 бер. 2026", read: "4 хв" },
              { tag: "Компанія", title: "Чому ми починали з радіології", excerpt: "Історія першого прототипу Klarnote і чому він спрацював.", date: "15 лют. 2026", read: "7 хв" },
            ]
          : [
              { tag: "Product", title: "How the ambient scribe changes a visit", excerpt: "What happens from the patient's first word to a structured note.", date: "May 12, 2026", read: "6 min" },
              { tag: "Research", title: "Why we highlight low-confidence words", excerpt: "Model transparency makes review faster and safer.", date: "Apr 28, 2026", read: "8 min" },
              { tag: "Security", title: "Immutable audit in practice", excerpt: "How we guarantee the integrity of every entry in the event log.", date: "Apr 9, 2026", read: "5 min" },
              { tag: "Engineering", title: "Low-latency streaming ASR", excerpt: "The architecture behind real-time recognition without losing accuracy.", date: "Mar 21, 2026", read: "10 min" },
              { tag: "Product", title: "Templates that save hours", excerpt: "How note structures adapt to your specialty.", date: "Mar 3, 2026", read: "4 min" },
              { tag: "Company", title: "Why we started with radiology", excerpt: "The story of Klarnote's first prototype and why it worked.", date: "Feb 15, 2026", read: "7 min" },
            ] },
      ],
    },

    /* ───────────────────────── Legal ───────────────────────── */
    "legal/privacy": {
      hero: {
        eyebrow: uk ? "Правове" : "Legal",
        title: uk ? "Політика конфіденційності" : "Privacy Policy",
        sub: uk ? "Як Klarnote збирає, використовує та захищає дані." : "How Klarnote collects, uses and protects data.",
        updated: uk ? "Оновлено: 1 червня 2026" : "Last updated: June 1, 2026",
      },
      blocks: [
        { type: "prose", heading: uk ? "1. Які дані ми обробляємо" : "1. Data we process",
          paragraphs: uk
            ? ["Klarnote обробляє аудіозаписи прийомів, транскрипти, структуровані медичні нотатки та облікові дані користувачів. Дані пацієнтів обробляються виключно за дорученням медичного закладу."]
            : ["Klarnote processes encounter audio, transcripts, structured medical notes and user account data. Patient data is processed solely on behalf of the healthcare organization."] },
        { type: "prose", heading: uk ? "2. Мета обробки" : "2. Purpose",
          bullets: uk
            ? ["Перетворення мови на структуровані нотатки", "Зберігання та пошук документів", "Аудит дій та забезпечення безпеки", "Покращення якості розпізнавання у знеособленому вигляді"]
            : ["Turning speech into structured notes", "Storing and retrieving documents", "Auditing actions and ensuring security", "Improving recognition quality in de-identified form"] },
        { type: "prose", heading: uk ? "3. Правова підстава" : "3. Legal basis",
          paragraphs: uk
            ? ["Обробка здійснюється на підставі договору з медичним закладом та згоди пацієнта, отриманої перед записом."]
            : ["Processing is based on the agreement with the healthcare organization and the patient consent captured before recording."] },
        { type: "prose", heading: uk ? "4. Зберігання та видалення" : "4. Retention & deletion",
          paragraphs: uk
            ? ["Дані зберігаються стільки, скільки вимагає медичний заклад або законодавство. Ви можете запросити видалення даних, що не підпадають під обов'язкове зберігання."]
            : ["Data is retained for as long as the organization or law requires. You can request deletion of data not subject to mandatory retention."] },
        { type: "prose", heading: uk ? "5. Ваші права" : "5. Your rights",
          bullets: uk
            ? ["Доступ до своїх даних", "Виправлення неточних даних", "Видалення там, де це дозволено", "Перенесення даних", "Скарга до наглядового органу"]
            : ["Access your data", "Correct inaccurate data", "Deletion where permitted", "Data portability", "Complaint to a supervisory authority"] },
        { type: "prose", heading: uk ? "6. Контакт" : "6. Contact",
          paragraphs: uk
            ? ["З питань конфіденційності пишіть на privacy@klarnote.example."]
            : ["For privacy questions write to privacy@klarnote.example."] },
      ],
    },

    "legal/terms": {
      hero: {
        eyebrow: uk ? "Правове" : "Legal",
        title: uk ? "Умови використання" : "Terms of Service",
        sub: uk ? "Правила користування платформою Klarnote." : "The rules for using the Klarnote platform.",
        updated: uk ? "Оновлено: 1 червня 2026" : "Last updated: June 1, 2026",
      },
      blocks: [
        { type: "prose", heading: uk ? "1. Прийняття умов" : "1. Acceptance",
          paragraphs: uk
            ? ["Користуючись Klarnote, ви погоджуєтеся з цими умовами. Якщо ви не згодні — не використовуйте сервіс."]
            : ["By using Klarnote you agree to these terms. If you do not agree, do not use the service."] },
        { type: "prose", heading: uk ? "2. Обліковий запис" : "2. Accounts",
          paragraphs: uk
            ? ["Доступ надається через запрошення адміністратора закладу. Ви відповідаєте за збереження своїх облікових даних."]
            : ["Access is granted by your organization's admin via invitation. You are responsible for safeguarding your credentials."] },
        { type: "prose", heading: uk ? "3. Допустиме використання" : "3. Acceptable use",
          bullets: uk
            ? ["Використовуйте сервіс лише в законних медичних цілях", "Не намагайтеся обійти контроль доступу", "Не завантажуйте шкідливий код", "Поважайте права пацієнтів і колег"]
            : ["Use the service only for lawful medical purposes", "Do not attempt to bypass access controls", "Do not upload malicious code", "Respect the rights of patients and colleagues"] },
        { type: "prose", heading: uk ? "4. Доступність сервісу" : "4. Service availability",
          paragraphs: uk
            ? ["Ми прагнемо до високої доступності, але не гарантуємо безперебійну роботу. Планові роботи анонсуються заздалегідь."]
            : ["We aim for high availability but do not guarantee uninterrupted operation. Planned maintenance is announced in advance."] },
        { type: "prose", heading: uk ? "5. Відповідальність" : "5. Liability",
          paragraphs: uk
            ? ["Klarnote — інструмент підтримки документації. Остаточна відповідальність за зміст медичних записів лежить на лікарі."]
            : ["Klarnote is a documentation support tool. Final responsibility for the content of medical records rests with the clinician."] },
        { type: "prose", heading: uk ? "6. Зміни умов" : "6. Changes",
          paragraphs: uk
            ? ["Ми можемо оновлювати ці умови; про суттєві зміни повідомимо заздалегідь."]
            : ["We may update these terms; we will notify you of material changes in advance."] },
      ],
    },

    "legal/data": {
      hero: {
        eyebrow: uk ? "Правове" : "Legal",
        title: uk ? "Обробка даних" : "Data Processing",
        sub: uk ? "Як ми діємо як обробник даних для медичних закладів." : "How we act as a data processor for healthcare organizations.",
        updated: uk ? "Оновлено: 1 червня 2026" : "Last updated: June 1, 2026",
      },
      blocks: [
        { type: "prose", heading: uk ? "Ролі сторін" : "Roles",
          paragraphs: uk
            ? ["Медичний заклад є контролером даних. Klarnote діє як обробник і обробляє дані виключно за документованими інструкціями закладу."]
            : ["The healthcare organization is the data controller. Klarnote acts as a processor and processes data only on the organization's documented instructions."] },
        { type: "grid", heading: uk ? "Заходи захисту" : "Safeguards", cols: 3, items: uk
          ? [
              { icon: "shield", title: "Шифрування", desc: "Дані шифруються під час передачі та зберігання." },
              { icon: "users", title: "Рольовий доступ", desc: "Доступ за принципом найменших привілеїв." },
              { icon: "history", title: "Аудит", desc: "Кожна дія з даними фіксується незмінно." },
              { icon: "archive", title: "Резервні копії", desc: "Регулярне резервне копіювання з контролем цілісності." },
              { icon: "scan", title: "Знеособлення", desc: "Дані для покращення моделі знеособлюються." },
              { icon: "check", title: "Субобробники", desc: "Перелік субобробників доступний за запитом." },
            ]
          : [
              { icon: "shield", title: "Encryption", desc: "Data is encrypted in transit and at rest." },
              { icon: "users", title: "Role-based access", desc: "Least-privilege access throughout." },
              { icon: "history", title: "Audit", desc: "Every data action is logged immutably." },
              { icon: "archive", title: "Backups", desc: "Regular backups with integrity checks." },
              { icon: "scan", title: "De-identification", desc: "Data used to improve the model is de-identified." },
              { icon: "check", title: "Sub-processors", desc: "A list of sub-processors is available on request." },
            ] },
        { type: "prose", heading: uk ? "Передача даних" : "Data transfers",
          paragraphs: uk
            ? ["Дані обробляються в межах узгоджених юрисдикцій. Будь-яка транскордонна передача супроводжується належними гарантіями."]
            : ["Data is processed within agreed jurisdictions. Any cross-border transfer is covered by appropriate safeguards."] },
        { type: "prose", heading: uk ? "Інциденти" : "Incidents",
          paragraphs: uk
            ? ["У разі інциденту безпеки ми повідомляємо заклад без невиправданих затримок і надаємо інформацію для оцінки впливу."]
            : ["In the event of a security incident we notify the organization without undue delay and provide information to assess impact."] },
      ],
    },

    "legal/consent": {
      hero: {
        eyebrow: uk ? "Правове" : "Legal",
        title: uk ? "Згода пацієнта" : "Patient Consent",
        sub: uk ? "Як Klarnote фіксує та поважає згоду перед записом." : "How Klarnote captures and respects consent before recording.",
        updated: uk ? "Оновлено: 1 червня 2026" : "Last updated: June 1, 2026",
      },
      blocks: [
        { type: "prose", heading: uk ? "Згода перед записом" : "Consent before recording",
          paragraphs: uk
            ? ["Жоден запис не починається без явної згоди пацієнта. Лікар фіксує згоду на екрані згоди, а прозорий індикатор показує стан запису протягом усього прийому."]
            : ["No recording starts without the patient's explicit consent. The clinician captures consent on the consent screen, and a transparent indicator shows the recording state throughout the visit."] },
        { type: "steps", heading: uk ? "Як це працює" : "How it works", items: uk
          ? [
              { n: "01", title: "Пояснення", desc: "Лікар пояснює, що прийом записуватиметься для документації." },
              { n: "02", title: "Згода", desc: "Пацієнт надає згоду, яка фіксується разом із часом." },
              { n: "03", title: "Індикатор", desc: "Видимий індикатор показує, що триває запис." },
              { n: "04", title: "Відкликання", desc: "Пацієнт може відкликати згоду будь-коли — запис зупиняється." },
            ]
          : [
              { n: "01", title: "Explain", desc: "The clinician explains the visit will be recorded for documentation." },
              { n: "02", title: "Consent", desc: "The patient grants consent, captured with a timestamp." },
              { n: "03", title: "Indicator", desc: "A visible indicator shows recording is in progress." },
              { n: "04", title: "Withdraw", desc: "The patient can withdraw consent at any time — recording stops." },
            ] },
        { type: "prose", heading: uk ? "Зберігання згоди" : "Consent records",
          paragraphs: uk
            ? ["Факт згоди зберігається разом із нотаткою та фіксується в незмінному журналі аудиту."]
            : ["The fact of consent is stored alongside the note and recorded in the immutable audit log."] },
      ],
    },

    /* ─────────────────────── Features overview ─────────────────────── */
    features: {
      hero: {
        eyebrow: uk ? "Можливості" : "Features",
        title: uk ? "Усе для впевненої документації" : "Everything for confident documentation",
        sub: uk
          ? "Від розпізнавання мови до підпису — повний цикл в одному застосунку."
          : "From speech recognition to signature — the full cycle in one app.",
      },
      blocks: [
        { type: "grid", cols: 3, link: true, items: uk
          ? [
              { icon: "mic", title: "Розпізнавання в реальному часі", desc: "Потокове ASR на self-hosted Whisper із підсвічуванням слів низької впевненості.", path: "/features/recognition" },
              { icon: "keyboard", title: "Голосові команди", desc: "Понад 30 інтентів: нові абзаци, пунктуація, перехід між секціями, збереження.", path: "/features/commands" },
              { icon: "sliders", title: "Нормалізація медичного тексту", desc: "Тиск, пульс, дози й одиниці перетворюються детерміновано: «сто двадцять на вісімдесят» → «120/80».", path: "/features/normalization" },
              { icon: "sparkle", title: "Розумне автодоповнення", desc: "Контекстні підказки термінів, діагнозів і фраз.", path: "/features/autocomplete" },
              { icon: "layers", title: "Шаблони та структури", desc: "16 системних шаблонів плюс власні версіоновані шаблони закладу.", path: "/features/templates" },
              { icon: "history", title: "Версії та амендменти", desc: "Append-only історія, порівняння діфів, амендменти після підпису.", path: "/features/versions" },
              { icon: "sign", title: "Електронний підпис Дія / ІІТ", desc: "КЕП через Дія або ІІТ, підписаний PADES PDF, публічна перевірка.", path: "/features/signature" },
              { icon: "shield", title: "Аудит і відповідність", desc: "Хеш-ланцюговий журнал, нічна звірка цілісності, рольовий доступ.", path: "/features/audit" },
            ]
          : [
              { icon: "mic", title: "Real-time recognition", desc: "Streaming ASR on self-hosted Whisper with low-confidence words highlighted.", path: "/features/recognition" },
              { icon: "keyboard", title: "Voice commands", desc: "30+ intents: new paragraph, punctuation, jump between sections, save draft.", path: "/features/commands" },
              { icon: "sliders", title: "Medical text normalization", desc: "Blood pressure, heart rate, doses and units rendered deterministically: \"one twenty over eighty\" → \"120/80\".", path: "/features/normalization" },
              { icon: "sparkle", title: "Smart autocomplete", desc: "Context-aware suggestions for terms, diagnoses and phrases.", path: "/features/autocomplete" },
              { icon: "layers", title: "Templates & structures", desc: "16 system templates plus your tenant's own versioned templates.", path: "/features/templates" },
              { icon: "history", title: "Versions & amendments", desc: "Append-only history, diff comparison, post-signature amendments.", path: "/features/versions" },
              { icon: "sign", title: "Дія / ІІТ e-signature", desc: "Qualified signature via Дія or ІІТ, signed PADES PDF, public verification.", path: "/features/signature" },
              { icon: "shield", title: "Audit & compliance", desc: "Hash-chained log, nightly integrity reconciliation, role-based access.", path: "/features/audit" },
            ] },
        cta,
      ],
    },

    security: {
      hero: {
        eyebrow: uk ? "Безпека" : "Security",
        title: uk ? "Безпека та приватність за замовчуванням" : "Security and privacy by default",
        sub: uk
          ? "Дані пацієнтів захищені на кожному етапі — від запису до архіву. Не на словах, а конструктивно: ізоляція тенантів у базі даних, незмінний хеш-ланцюговий аудит і моделі, що працюють лише на вашому обладнанні."
          : "Patient data is protected at every step — from recording to archive. Not by policy alone but by construction: tenant isolation in the database, an immutable hash-chained audit, and models that run only on your own hardware.",
      },
      blocks: [
        { type: "grid", heading: uk ? "Непорушні принципи" : "Non-negotiable principles", cols: 3, items: uk
          ? [
              { icon: "home", title: "Суверенітет даних", desc: "Жодне аудіо, транскрипт чи нотатка не надсилаються до сторонніх пропрієтарних API. Усе ASR і генерація працюють на self-hosted відкритих моделях." },
              { icon: "user", title: "Лікар у контурі", desc: "Система готує чернетку, але не діагностує й ніколи не фіналізує документ автоматично." },
              { icon: "layers", title: "Ізоляція тенантів", desc: "Код ніколи не фільтрує за тенантом — це робить база даних через row-level security. Відсутній фільтр не може призвести до витоку." },
              { icon: "history", title: "Захищений від підробки аудит", desc: "Append-only, хеш-ланцюговий журнал з контролем незмінності на рівні БД, що звіряється щоночі." },
              { icon: "save", title: "Шифрування", desc: "Аудіо й транскрипти шифруються під час передачі та зберігання." },
            ]
          : [
              { icon: "home", title: "Data sovereignty", desc: "No audio, transcript or note is sent to any third-party proprietary API. All ASR and generation run on self-hosted, open-licensed models." },
              { icon: "user", title: "Clinician in the loop", desc: "The system drafts, it does not diagnose, and it never auto-finalizes a document." },
              { icon: "layers", title: "Tenant isolation", desc: "Application code never filters by tenant — the database does, via row-level security. A missing filter therefore can't leak data." },
              { icon: "history", title: "Tamper-evident audit", desc: "Append-only, hash-chained log with immutability enforced at the database level and reconciled nightly." },
              { icon: "save", title: "Encryption", desc: "Audio and transcripts are encrypted in transit and at rest." },
            ] },
        { type: "grid", heading: uk ? "Ролі та доступ" : "Roles & access", sub: uk
            ? "Доступ — заборонено за замовчуванням і перевіряється за явною матрицею дозволів на кожному ендпоінті. Свідомо немає крос-тенантної ролі суперадміністратора."
            : "Access is deny-by-default and checked against an explicit permission matrix on every endpoint. There is deliberately no cross-tenant super-admin role.",
          cols: 3, items: uk
          ? [
              { icon: "user", title: "Лікар (clinician)", desc: "Диктує, генерує, редагує, фіналізує та підписує нотатки." },
              { icon: "heart", title: "Медсестра (nurse)", desc: "Та сама клінічна поверхня, що й у лікаря, окрім підписання звітів." },
              { icon: "settings", title: "Адміністратор тенанта", desc: "Онбординг і деактивація користувачів, скидання MFA, налаштування, читання аудиту." },
              { icon: "eye", title: "Аудитор (auditor)", desc: "Лише читання аудиту та контексту тенанта — жодних записів." },
              { icon: "bot", title: "Сервіс (service)", desc: "Машинна ідентичність для внутрішніх сервісів; без людських операцій." },
            ]
          : [
              { icon: "user", title: "Clinician", desc: "Dictate, generate, edit, finalize and sign notes." },
              { icon: "heart", title: "Nurse", desc: "The same clinical surface as a clinician, minus report signing." },
              { icon: "settings", title: "Tenant admin", desc: "User onboarding and deactivation, MFA reset, settings, audit read." },
              { icon: "eye", title: "Auditor", desc: "Read-only audit and tenant context — no writes anywhere." },
              { icon: "bot", title: "Service", desc: "Machine identity for internal services; no human-facing operations." },
            ] },
        { type: "prose", heading: uk ? "Доступ до чужих записів" : "Access to colleagues' records",
          paragraphs: uk
            ? ["Доступ до звіту іншого лікаря вимагає явно задекларованої мети — клінічна спадковість, аудит, юридична потреба, контроль якості чи консультація. Ця мета фіксується в журналі аудиту.",
               "Сніпети, показані будь-кому поза лікувальною командою, очищаються від персональних даних — як другий рубіж захисту за рольовою перевіркою. Записи в журналі аудиту містять лише ідентифікатори, ніколи клінічний зміст, тож сам аудит не може стати джерелом витоку."]
            : ["Opening a colleague's report requires an explicitly declared purpose — clinical continuity, audit, legal, QA review or consultation. That purpose is captured into the audit trail.",
               "Snippets shown to anyone outside the treatment team are PII-redacted as a second line of defense behind the role check. Audit entries carry IDs only, never clinical content, so the audit trail can't itself become a data leak."] },
        { type: "faq", heading: uk ? "Часті запитання" : "FAQ", items: uk
          ? [
              { q: "Чи надсилаються дані пацієнтів до зовнішніх AI-сервісів?", a: "Ні. Усе розпізнавання мови та генерація нотаток виконуються на self-hosted моделях з відкритими ліцензіями. Жодне аудіо, транскрипт чи нотатка не залишають вашого розгортання." },
              { q: "Де зберігаються дані пацієнтів?", a: "У межах узгоджених із закладом юрисдикцій (регіон ЄС/України або суверенний хостинг), із шифруванням під час передачі та зберігання." },
              { q: "Як забезпечується ізоляція між клініками?", a: "Через row-level security у базі даних, а не у коді застосунку. Кожна клініка — окремий тенант із жорсткою ізоляцією на рівні БД." },
              { q: "Чи можна перевірити цілісність аудиту?", a: "Так. Журнал append-only та хеш-ланцюговий; нічний звіряльник проходить ланцюг і сповіщає про будь-яке розходження. Цілісність також можна перевірити на сторінці перевірки." },
              { q: "Що з багатофакторною автентифікацією?", a: "Механізм MFA вже вбудовано. Під час пілота він вимкнений політикою; повторне ввімкнення — це конфігурація плюс флоу реєстрації." },
              { q: "Хто має доступ до записів?", a: "Лише авторизовані ролі в межах закладу, за принципом найменших привілеїв; доступ до чужих записів потребує задекларованої мети." },
            ]
          : [
              { q: "Is patient data sent to external AI services?", a: "No. All speech recognition and note generation run on self-hosted, open-licensed models. No audio, transcript or note leaves your deployment." },
              { q: "Where is patient data stored?", a: "Within jurisdictions agreed with your organization (EU/Ukraine-region or sovereign hosting), encrypted in transit and at rest." },
              { q: "How is isolation between clinics enforced?", a: "Via row-level security in the database, not in application code. Each clinic is a separate tenant with hard isolation at the database layer." },
              { q: "Can audit integrity be verified?", a: "Yes. The log is append-only and hash-chained; a nightly reconciler walks the chain and alerts on any divergence. Integrity can also be checked on the verify page." },
              { q: "What about multi-factor authentication?", a: "MFA is already wired in. It is off by pilot policy today; re-enabling it is a configuration plus an enrollment flow." },
              { q: "Who can access records?", a: "Only authorized roles within your organization, on a least-privilege basis; accessing a colleague's record requires a declared purpose." },
            ] },
        cta,
      ],
    },

    /* ─────────────────────── Products ─────────────────────── */
    "product/scribe": {
      hero: {
        eyebrow: "Scribe",
        title: uk ? "Амбулаторний скрайб" : "Ambient scribe",
        sub: uk
          ? "Веде прийом разом з вами: фіксує розмову з пацієнтом, формує структуровану нотатку та підказує наступні кроки."
          : "Runs the visit with you: captures the patient conversation, builds a structured note and suggests next steps.",
        cta: { label: uk ? "Зареєструватися" : "Sign up", path: "/signup" },
      },
      blocks: [
        { type: "grid", cols: 3, items: uk
          ? [
              { icon: "check", title: "Згода та індикатор", desc: "Явна згода пацієнта та видимий індикатор запису протягом усього прийому." },
              { icon: "mic", title: "Живий транскрипт", desc: "Потокова диктація через WebSocket: частковий транскрипт з'являється під час мовлення." },
              { icon: "users", title: "Профілі пацієнтів", desc: "Картки пацієнтів і таймлайн візитів в одному місці." },
              { icon: "layers", title: "Автоструктура", desc: "Нотатка автоматично розкладається на секції шаблону." },
              { icon: "eye", title: "Підсвічування сумнівів", desc: "Слова низької впевненості виділяються для швидкої перевірки." },
              { icon: "save", title: "Автозбереження", desc: "Правки зберігаються автоматично з виявленням конфліктів між пристроями." },
            ]
          : [
              { icon: "check", title: "Consent & indicator", desc: "Explicit patient consent and a visible recording indicator throughout the visit." },
              { icon: "mic", title: "Live transcript", desc: "Streaming dictation over WebSocket: a partial transcript appears as you speak." },
              { icon: "users", title: "Patient profiles", desc: "Patient cards and a visit timeline in one place." },
              { icon: "layers", title: "Auto-structure", desc: "The note is laid out into the template's sections automatically." },
              { icon: "eye", title: "Low-confidence flags", desc: "Words the model is unsure about are highlighted for quick review." },
              { icon: "save", title: "Autosave", desc: "Edits save automatically with cross-device conflict detection." },
            ] },
        { type: "steps", heading: uk ? "Як проходить прийом" : "How a visit flows", items: uk
          ? [
              { n: "01", title: "Згода", desc: "Зафіксуйте згоду пацієнта на екрані згоди." },
              { n: "02", title: "Розмова", desc: "Ведіть прийом — Klarnote слухає й розпізнає мову." },
              { n: "03", title: "Нотатка", desc: "Отримайте структуровану нотатку для перевірки." },
              { n: "04", title: "Підпис", desc: "Перевірте, підпишіть і збережіть у картці пацієнта." },
            ]
          : [
              { n: "01", title: "Consent", desc: "Capture patient consent on the consent screen." },
              { n: "02", title: "Conversation", desc: "Run the visit — Klarnote listens and recognizes speech." },
              { n: "03", title: "Note", desc: "Get a structured note ready for review." },
              { n: "04", title: "Sign", desc: "Review, sign and save to the patient record." },
            ] },
        cta,
      ],
    },

    "product/dictate": {
      hero: {
        eyebrow: "Dictate",
        title: uk ? "Диктування звітів" : "Report dictation",
        sub: uk
          ? "Класичне диктування для радіології, патології та виписок із шаблонами, голосовими командами та порівнянням версій."
          : "Classic dictation for radiology, pathology and discharge summaries with templates, voice commands and version diffs.",
        cta: { label: uk ? "Зареєструватися" : "Sign up", path: "/signup" },
      },
      blocks: [
        { type: "grid", cols: 3, items: uk
          ? [
              { icon: "layers", title: "Шаблони звітів", desc: "16 системних структур під спеціальність плюс версіоновані шаблони закладу." },
              { icon: "keyboard", title: "Голосові команди", desc: "Понад 30 інтентів для керування структурою документа голосом." },
              { icon: "inbox", title: "Пакетне завантаження", desc: "Завантажте запис, зроблений деінде, — він шифрується й транскрибується асинхронно." },
              { icon: "check", title: "Перевірка фіналізації", desc: "Перед блокуванням версії перевіряються обов'язкові секції та дійсний код МКХ-10." },
              { icon: "diff", title: "Порівняння версій", desc: "Append-only історія: бачте кожну зміну та вносьте коректні амендменти." },
              { icon: "sign", title: "Підписання", desc: "КЕП через Дія або ІІТ, підписаний PADES PDF із публічною перевіркою." },
            ]
          : [
              { icon: "layers", title: "Report templates", desc: "16 system structures per specialty plus your tenant's versioned templates." },
              { icon: "keyboard", title: "Voice commands", desc: "30+ intents to control the document structure with your voice." },
              { icon: "inbox", title: "Batch upload", desc: "Upload audio recorded elsewhere — it's encrypted and transcribed asynchronously." },
              { icon: "check", title: "Finalization checks", desc: "Required sections and a valid ICD-10 code are validated before the version locks." },
              { icon: "diff", title: "Version diffs", desc: "Append-only history: see every change and make correct amendments." },
              { icon: "sign", title: "Signing", desc: "Qualified signature via Дія or ІІТ, a signed PADES PDF with public verification." },
            ] },
        cta,
      ],
    },
  };
}

/* ── Individual feature detail pages ──────────────────────────
   Generated from one table so the six pages stay consistent. */
const FEATURE_DETAIL = {
  recognition: {
    icon: "mic",
    uk: { eyebrow: "Можливість", title: "Розпізнавання в реальному часі",
      sub: "Потокове ASR на self-hosted faster-whisper перетворює мову на текст із мінімальною затримкою — і підсвічує слова, у яких модель не впевнена.",
      points: ["Вікно 4 секунди з перекриттям 2 секунди для безперервного транскрипту", "Розпізнавання українсько-російського перемикання кодів", "Активна секція нотатки зміщує розпізнавання до релевантної лексики", "Усе працює на власному обладнанні — без сторонніх API"],
      cards: [
        { icon: "clock", title: "Мінімальна затримка", desc: "Текст з'являється під час мовлення, а не після; останні токени праймлять кожне наступне вікно." },
        { icon: "eye", title: "Прозорість моделі", desc: "Сумнівні слова видно одразу — перевірка швидша." },
        { icon: "home", title: "Суверенність", desc: "Модель розгорнута локально; аудіо не залишає вашого периметра." },
      ] },
    en: { eyebrow: "Feature", title: "Real-time recognition",
      sub: "Streaming ASR on self-hosted faster-whisper turns speech into text with minimal latency — and highlights words the model is unsure about.",
      points: ["A 4-second window with 2-second overlap keeps the transcript continuous", "Handles Ukrainian/Russian code-switching", "The active note section biases recognition toward relevant vocabulary", "Runs entirely on your own hardware — no third-party APIs"],
      cards: [
        { icon: "clock", title: "Minimal latency", desc: "Text appears as you speak, not after; the last tokens prime each subsequent window." },
        { icon: "eye", title: "Model transparency", desc: "Uncertain words are visible instantly — review is faster." },
        { icon: "home", title: "Sovereign", desc: "The model is deployed locally; audio never leaves your perimeter." },
      ] },
  },
  autocomplete: {
    icon: "sparkle",
    uk: { eyebrow: "Можливість", title: "Розумне автодоповнення",
      sub: "Контекстні підказки термінів, діагнозів і фраз під час диктування — менше повторів, більше швидкості.",
      points: ["Підказки медичних термінів", "Часті фрази та діагнози", "Навчається на ваших шаблонах"],
      cards: [
        { icon: "book", title: "Медичний словник", desc: "Підказує точні терміни вашої спеціальності." },
        { icon: "keyboard", title: "Менше друку", desc: "Завершуйте фрази одним рухом." },
        { icon: "layers", title: "Контекст", desc: "Підказки враховують структуру нотатки." },
      ] },
    en: { eyebrow: "Feature", title: "Smart autocomplete",
      sub: "Context-aware suggestions for terms, diagnoses and phrases as you dictate — fewer repeats, more speed.",
      points: ["Medical term suggestions", "Frequent phrases and diagnoses", "Learns from your templates"],
      cards: [
        { icon: "book", title: "Medical vocabulary", desc: "Suggests the exact terms of your specialty." },
        { icon: "keyboard", title: "Less typing", desc: "Complete phrases in a single move." },
        { icon: "layers", title: "Context-aware", desc: "Suggestions respect the note structure." },
      ] },
  },
  templates: {
    icon: "layers",
    uk: { eyebrow: "Можливість", title: "Шаблони та структури",
      sub: "16 системних шаблонів плюс власні версіоновані шаблони закладу — однаковий вигляд документів у всій команді.",
      points: ["16 системних шаблонів як базовий каталог", "JSONB-документи з типізованими полями (текст, діагноз, дата, число з одиницею)", "Структурні зміни створюють нову версію — фінальні нотатки знають, який шаблон їх породив"],
      cards: [
        { icon: "fileText", title: "Типізовані поля", desc: "Вільний текст, структурований діагноз, дата, число з одиницею тощо." },
        { icon: "edit", title: "Клонування й кастомізація", desc: "Тенанти клонують системні шаблони та налаштовують власні." },
        { icon: "history", title: "Версіонування", desc: "Косметичні правки — на місці; структурні створюють нову версію." },
      ] },
    en: { eyebrow: "Feature", title: "Templates & structures",
      sub: "16 system templates plus your tenant's own versioned templates — consistent documents across the team.",
      points: ["16 system templates as the base catalogue", "JSONB documents with typed fields (free text, diagnosis, date, numeric-with-unit)", "Structural edits create a new version — finalized notes record exactly which template produced them"],
      cards: [
        { icon: "fileText", title: "Typed fields", desc: "Free text, structured diagnosis, date, numeric-with-unit and more." },
        { icon: "edit", title: "Clone & customize", desc: "Tenants clone the system templates and customize their own." },
        { icon: "history", title: "Versioning", desc: "Cosmetic edits update in place; structural edits create a new version." },
      ] },
  },
  versions: {
    icon: "history",
    uk: { eyebrow: "Можливість", title: "Версії та амендменти",
      sub: "Повна історія змін, порівняння діфів і коректне внесення правок — нічого не губиться.",
      points: ["Повна історія кожного документа", "Порівняння версій (діф)", "Коректні амендменти після підпису"],
      cards: [
        { icon: "diff", title: "Порівняння змін", desc: "Бачте, що саме змінилося між версіями." },
        { icon: "history", title: "Історія", desc: "Кожна правка зберігається й відстежується." },
        { icon: "edit", title: "Амендменти", desc: "Вносьте правки після підпису за правилами." },
      ] },
    en: { eyebrow: "Feature", title: "Versions & amendments",
      sub: "Full change history, diff comparison and a correct amendment flow — nothing gets lost.",
      points: ["Full history for every document", "Version diff comparison", "Correct post-signature amendments"],
      cards: [
        { icon: "diff", title: "Change comparison", desc: "See exactly what changed between versions." },
        { icon: "history", title: "History", desc: "Every edit is stored and tracked." },
        { icon: "edit", title: "Amendments", desc: "Make post-signature edits by the rules." },
      ] },
  },
  signature: {
    icon: "sign",
    uk: { eyebrow: "Можливість", title: "Електронний підпис Дія / ІІТ",
      sub: "Кваліфікований електронний підпис (КЕП) через Дія (мобільний) або ІІТ (смарткарта) згідно із Законом України 2155-VIII — юридично значимо й прозоро.",
      points: ["КЕП через Дія або ІІТ", "Підписаний артефакт — PADES PDF із вбудованим канонічним JSON нотатки", "Публічне посилання на перевірку без облікового запису"],
      cards: [
        { icon: "sign", title: "Дія та ІІТ", desc: "Підписання з мобільного через Дія або смарткартою через ІІТ." },
        { icon: "eye", title: "Публічна перевірка", desc: "Кожен підписаний документ має неавтентифіковане посилання для перевірки автентичності." },
        { icon: "shield", title: "Цілісність", desc: "Канонічний JSON вбудовано в PDF; підписаний документ захищено від змін." },
      ] },
    en: { eyebrow: "Feature", title: "Дія / ІІТ e-signature",
      sub: "Qualified electronic signature (КЕП) via Дія (mobile) or ІІТ (smart card) under Ukrainian Law 2155-VIII — legally meaningful and transparent.",
      points: ["Qualified signature via Дія or ІІТ", "The signed artifact is a PADES PDF with the canonical note JSON embedded", "A public, account-free verification link for every signed document"],
      cards: [
        { icon: "sign", title: "Дія and ІІТ", desc: "Sign from mobile via Дія or with a smart card via ІІТ." },
        { icon: "eye", title: "Public verification", desc: "Every signed document gets an unauthenticated link to confirm authenticity." },
        { icon: "shield", title: "Integrity", desc: "The canonical JSON is embedded in the PDF; a signed document is protected from changes." },
      ] },
  },
  audit: {
    icon: "shield",
    uk: { eyebrow: "Можливість", title: "Аудит і відповідність",
      sub: "Захищений від підробки хеш-ланцюговий журнал, нічна звірка цілісності та рольовий доступ — повна прозорість для відповідності.",
      points: ["Append-only, хеш-ланцюговий журнал з незмінністю на рівні БД", "Нічний звіряльник проходить ланцюг і сповіщає про розходження", "Записи містять лише ідентифікатори, ніколи клінічний зміст"],
      cards: [
        { icon: "history", title: "Хеш-ланцюг", desc: "Кожна подія пов'язана з попередньою — підробку видно одразу." },
        { icon: "check", title: "Нічна звірка", desc: "Автоматична перевірка цілісності ланцюга щоночі." },
        { icon: "users", title: "Рольовий доступ", desc: "Доступ заборонено за замовчуванням, за принципом найменших привілеїв." },
      ] },
    en: { eyebrow: "Feature", title: "Audit & compliance",
      sub: "A tamper-evident, hash-chained event log, nightly integrity reconciliation and role-based access — full transparency for compliance.",
      points: ["Append-only, hash-chained log with immutability enforced at the database level", "A nightly reconciler walks the chain and alerts on divergence", "Entries carry IDs only, never clinical content"],
      cards: [
        { icon: "history", title: "Hash chain", desc: "Each event is linked to the previous one — tampering is immediately visible." },
        { icon: "check", title: "Nightly reconciliation", desc: "The chain's integrity is verified automatically every night." },
        { icon: "users", title: "Role-based access", desc: "Deny-by-default, least-privilege access throughout." },
      ] },
  },
  normalization: {
    icon: "sliders",
    uk: { eyebrow: "Можливість", title: "Нормалізація медичного тексту",
      sub: "Усну клінічну мову детерміновано приводимо до канонічного вигляду: тиск, пульс, дози, одиниці, діапазони, час і частоти.",
      points: ["«сто двадцять на вісімдесят» → «120/80»", "Правила, а не чорна скринька — критичні значення можна перевірити", "Нетеговані числа проходять без змін"],
      cards: [
        { icon: "sliders", title: "Детерміновані правила", desc: "Перетворення прозоре й відтворюване — жодних здогадок моделі на дозах і тиску." },
        { icon: "check", title: "Критичні значення", desc: "Дози, одиниці та АТ обробляються за явними правилами, які можна перевірити." },
        { icon: "shield", title: "Безпечно за замовчуванням", desc: "Те, що не розпізнано як величину, лишається недоторканим." },
      ] },
    en: { eyebrow: "Feature", title: "Medical text normalization",
      sub: "Spoken clinical phrasing is rendered to a canonical form deterministically: blood pressure, heart rate, doses, units, ranges, times and frequencies.",
      points: ["\"one twenty over eighty\" → \"120/80\"", "Rule-based, not a black box — critical values stay verifiable", "Untagged numbers pass through untouched"],
      cards: [
        { icon: "sliders", title: "Deterministic rules", desc: "The transform is transparent and reproducible — no model guesswork on doses and BP." },
        { icon: "check", title: "Critical values", desc: "Doses, units and BP are handled by explicit, auditable rules." },
        { icon: "shield", title: "Safe by default", desc: "Anything not recognized as a quantity is left untouched." },
      ] },
  },
  commands: {
    icon: "keyboard",
    uk: { eyebrow: "Можливість", title: "Голосові команди",
      sub: "Керуйте документом, не торкаючись клавіатури: новий абзац, пунктуація, перехід до секції, збереження чернетки, скасування, стоп.",
      points: ["Каталог із 30 інтентів — 15 українських і 15 англійських", "Кожна команда долає три бар'єри: пауза, впевненість, допуск на відстань редагування", "600-мс вікно скасування на випадок хибних спрацювань"],
      cards: [
        { icon: "keyboard", title: "Природні команди", desc: "«розділ діагноз», новий абзац, крапка — без виходу з диктування." },
        { icon: "shield", title: "Обережність понад усе", desc: "Система радше не спрацює, ніж виконає хибну команду." },
        { icon: "refresh", title: "Захист від ідіом", desc: "«крапка над і» не вставляє крапку; миттєве скасування покриває промахи." },
      ] },
    en: { eyebrow: "Feature", title: "Voice commands",
      sub: "Control the document without touching the keyboard: new paragraph, punctuation, jump to a section, save draft, undo, stop.",
      points: ["A catalogue of 30 intents — 15 Ukrainian and 15 English", "Each command clears three gates: a pause, recognition confidence and an edit-distance tolerance", "A 600-ms undo window covers misfires"],
      cards: [
        { icon: "keyboard", title: "Natural commands", desc: "\"section diagnosis\", new paragraph, period — without leaving dictation." },
        { icon: "shield", title: "Caution first", desc: "The system errs toward not firing rather than running a false command." },
        { icon: "refresh", title: "Idiom guards", desc: "\"dot the i\" won't insert a period; instant undo covers any misfire." },
      ] },
  },
};

function buildFeatureDetail(slug, lang) {
  const d = FEATURE_DETAIL[slug];
  if (!d) return null;
  const uk = lang === "uk";
  const t = uk ? d.uk : d.en;
  const cta = uk ? CTA.uk : CTA.en;
  return {
    hero: { eyebrow: t.eyebrow, title: t.title, sub: t.sub, icon: d.icon, points: t.points,
      cta: { label: uk ? "Зареєструватися" : "Sign up", path: "/signup" } },
    blocks: [
      { type: "grid", cols: 3, items: t.cards },
      { type: "backlink", label: uk ? "Усі можливості" : "All features", path: "/features" },
      cta,
    ],
  };
}

/* Public resolver used by ContentPage. Returns null for unknown slugs. */
export function getContent(slug, lang) {
  const m = slug.match(/^features\/(.+)$/);
  if (m) return buildFeatureDetail(m[1], lang);
  return build(lang)[slug] || null;
}
