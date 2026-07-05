// blog.js — Blog registry: metadata + full article bodies for every post.
//
// One source of truth shared by the /blog listing (BlogPage) and each article
// page (BlogPostPage). Bilingual (uk/en). A body is an ordered list of blocks:
//   { p }      paragraph
//   { h2 }     section heading
//   { ul: [] } bullet list
//   { quote }  pull quote
export const BLOG_POSTS = [
  {
    slug: "ambient-scribe-visit",
    tag: { uk: "Продукт", en: "Product" },
    date: { uk: "12 трав. 2026", en: "May 12, 2026" },
    read: { uk: "6 хв", en: "6 min" },
    title: {
      uk: "Як амбулаторний скрайб змінює прийом",
      en: "How the ambient scribe changes a visit",
    },
    excerpt: {
      uk: "Розбираємо, що відбувається від першого слова пацієнта до структурованої нотатки.",
      en: "What happens from the patient's first word to a structured note.",
    },
    body: {
      uk: [
        { p: "Для більшості лікарів прийом і документація відбуваються в різний час: спершу розмова з пацієнтом, потім — вечір за клавіатурою, коли деталі вже стерлися з пам'яті. Амбулаторний скрайб прибирає цей розрив: нотатка формується під час візиту, а не після нього." },
        { h2: "Що чує скрайб" },
        { p: "Від моменту, коли ви починаєте прийом, Dictat слухає розмову. Він відділяє мову лікаря від мови пацієнта, розпізнає її в реальному часі й ніколи не надсилає аудіо до сторонніх сервісів — уся обробка відбувається у вашому розгортанні." },
        { p: "Перш ніж записати бодай слово, система показує явний індикатор запису та фіксує згоду пацієнта. Прозорість тут не опція, а вимога." },
        { h2: "Від розмови до структури" },
        { p: "Сирий транскрипт — це ще не нотатка. Dictat розкладає розмову на структуру, яку очікує ваша спеціальність: скарги, анамнез, об'єктивний огляд, висновок, план. Ви редагуєте готовий каркас, а не порожню сторінку." },
        { ul: [
          "Згода та видимий індикатор запису перед стартом",
          "Розпізнавання з розділенням мовців",
          "Автоматична структура нотатки, яку можна редагувати",
        ] },
        { h2: "Останнє слово — за лікарем" },
        { p: "Скрайб готує чернетку, але не діагностує. Жоден документ не фіналізується автоматично: ви перевіряєте, за потреби правите й підписуєте. Слова низької впевненості підсвічуються, тож перевірка займає секунди." },
        { quote: "Результат — прийом, де ви дивитеся на пацієнта, а не на клавіатуру." },
      ],
      en: [
        { p: "For most clinicians, the visit and the paperwork happen at different times: first the conversation, then an evening at the keyboard once the details have already faded. An ambient scribe collapses that gap — the note takes shape during the encounter, not after it." },
        { h2: "What the scribe hears" },
        { p: "From the moment you start an encounter, Dictat listens to the conversation. It separates clinician speech from patient speech, recognizes it in real time, and never sends audio to a third party — all processing runs inside your own deployment." },
        { p: "Before a single word is captured, the system shows a clear recording indicator and records the patient's consent. Transparency here isn't optional; it's a requirement." },
        { h2: "From conversation to structure" },
        { p: "A raw transcript is not a note. Dictat maps the conversation onto the structure your specialty expects — history, examination, assessment, plan. You edit a finished scaffold instead of a blank page." },
        { ul: [
          "Consent and a visible recording indicator before anything is captured",
          "Speaker-aware transcription",
          "Automatic, editable note structure",
        ] },
        { h2: "The clinician stays in control" },
        { p: "The scribe drafts; it does not diagnose. Nothing is finalized automatically: you review, correct where needed, and sign. Low-confidence words are highlighted, so the check takes seconds." },
        { quote: "The result is a visit where you look at the patient, not the keyboard." },
      ],
    },
  },
  {
    slug: "low-confidence-words",
    tag: { uk: "Дослідження", en: "Research" },
    date: { uk: "28 квіт. 2026", en: "Apr 28, 2026" },
    read: { uk: "8 хв", en: "8 min" },
    title: {
      uk: "Чому ми підсвічуємо слова низької впевненості",
      en: "Why we highlight low-confidence words",
    },
    excerpt: {
      uk: "Прозорість моделі робить перевірку швидшою та безпечнішою.",
      en: "Model transparency makes review faster and safer.",
    },
    body: {
      uk: [
        { p: "Розпізнавання мови ніколи не буває стовідсотково впевненим. Модель завжди оцінює ймовірність кожного слова. Питання не в тому, чи є невпевненість, а в тому, показувати її лікарю чи ховати. Ми вирішили показувати." },
        { h2: "Впевненість — це сигнал, а не шум" },
        { p: "Кожен токен, який повертає ASR-модель, має оцінку ймовірності. Слова нижче порогу отримують тонке підсвічування прямо в тексті. Це не помилка й не попередження — це підказка, куди варто глянути уважніше." },
        { h2: "Швидша та безпечніша перевірка" },
        { p: "Лікарю не потрібно перечитувати кожне слово — лише ті, у яких модель сумнівалася. Так вичитування перетворюється з лінійного читання на точкову перевірку. Найчастіше сумнівними є саме критичні елементи:" },
        { ul: [
          "Назви препаратів і дозування",
          "Рідкісні епоніми та анатомічні терміни",
          "Числа й одиниці вимірювання",
        ] },
        { h2: "Спроектовано для довіри" },
        { p: "Модель, яка чесно каже, де вона могла помилитися, безпечніша за ту, що приховує невпевненість. Підсвічування — це маленький жест прозорості, який економить хвилини на кожній нотатці й запобігає тихим помилкам." },
        { quote: "Ми не автоматизуємо довіру. Ми робимо її вимірюваною." },
      ],
      en: [
        { p: "Speech recognition is never 100% certain. A model always estimates a probability for every word. The question isn't whether uncertainty exists — it's whether you show it to the clinician or hide it. We chose to show it." },
        { h2: "Confidence is a signal, not noise" },
        { p: "Every token the ASR model returns carries a probability score. Words below a threshold get a subtle highlight right in the text. It isn't an error or a warning — it's a hint about where to look more closely." },
        { h2: "Faster, safer review" },
        { p: "A clinician doesn't need to re-read every word — only the ones the model was unsure about. That turns proofreading from a linear read into a targeted check. And the uncertain words are usually the ones that matter most:" },
        { ul: [
          "Drug names and dosages",
          "Rare eponyms and anatomical terms",
          "Numbers and units",
        ] },
        { h2: "Designed for trust" },
        { p: "A model that honestly tells you where it might be wrong is safer than one that hides its uncertainty. Highlighting is a small gesture of transparency that saves minutes on every note and prevents silent mistakes." },
        { quote: "We don't automate trust. We make it measurable." },
      ],
    },
  },
  {
    slug: "immutable-audit",
    tag: { uk: "Безпека", en: "Security" },
    date: { uk: "9 квіт. 2026", en: "Apr 9, 2026" },
    read: { uk: "5 хв", en: "5 min" },
    title: {
      uk: "Незмінний аудит на практиці",
      en: "Immutable audit in practice",
    },
    excerpt: {
      uk: "Як ми гарантуємо цілісність кожного запису в журналі подій.",
      en: "How we guarantee the integrity of every entry in the event log.",
    },
    body: {
      uk: [
        { p: "У медицині «хто, що і коли зробив» — це не опція, а вимога. Аудит має бути таким, щоб йому можна було довіряти навіть тоді, коли хтось зацікавлений його змінити." },
        { h2: "Тільки додавання, за задумом" },
        { p: "Кожна дія — початок запису, редагування нотатки, підписання документа — створює запис у журналі, який неможливо змінити чи видалити. Журнал append-only: до нього можна лише додавати. Виправлення теж стає новим записом, а не переписуванням старого." },
        { h2: "Цілісність, яку можна перевірити" },
        { p: "Кожен запис зчеплений із попереднім через хеш. Це утворює ланцюг: зміна будь-якого запису розриває ланцюг і одразу стає помітною. Перевірка цілісності — це одна операція, а не ручний аудит." },
        { ul: [
          "Кожна подія має мітку часу й автора",
          "Записи зчеплені хешами в ланцюг",
          "Перевірка — це один прохід по журналу",
        ] },
        { p: "Такий підхід означає, що аудит не залежить від довіри до адміністратора чи бази даних. Математика ланцюга або сходиться, або ні." },
      ],
      en: [
        { p: "In healthcare, who did what and when is not a nice-to-have — it's a requirement. An audit trail has to be trustworthy even when someone has an interest in changing it." },
        { h2: "Append-only by design" },
        { p: "Every action — a recording started, a note edited, a document signed — writes an entry that can never be altered or deleted. The log is append-only: you can only add to it. Even a correction becomes a new entry rather than a rewrite of the old one." },
        { h2: "Integrity you can verify" },
        { p: "Each entry is chained to the previous one with a hash. That forms a chain: tampering with any record breaks the chain and becomes immediately visible. Integrity is a single check, not a manual audit." },
        { ul: [
          "Every event is timestamped and attributed",
          "Entries are hash-chained together",
          "Verification is a single pass over the log",
        ] },
        { p: "This means the audit trail doesn't depend on trusting an administrator or a database. The math of the chain either adds up or it doesn't." },
      ],
    },
  },
  {
    slug: "streaming-asr",
    tag: { uk: "Інженерія", en: "Engineering" },
    date: { uk: "21 бер. 2026", en: "Mar 21, 2026" },
    read: { uk: "10 хв", en: "10 min" },
    title: {
      uk: "Потокове ASR із низькою затримкою",
      en: "Low-latency streaming ASR",
    },
    excerpt: {
      uk: "Архітектура, що дає розпізнавання в реальному часі без втрати точності.",
      en: "The architecture behind real-time recognition without losing accuracy.",
    },
    body: {
      uk: [
        { p: "Диктування відчувається природним лише тоді, коли слова з'являються синхронно з мовленням. Затримка навіть у секунду розриває потік думки. Тому Dictat розпізнає мову потоково, а не пакетно." },
        { h2: "Потік, а не пакет" },
        { p: "Замість того щоб чекати, доки ви закінчите речення, Dictat обробляє аудіо невеликими перекривними вікнами. Проміжний результат з'являється майже миттєво й уточнюється, коли надходить більше контексту." },
        { h2: "Компроміс із точністю" },
        { p: "Потокова обробка ризикує нижчою точністю, бо модель бачить менше контексту. Ми компенсуємо це двопрохідним підходом: швидкий проміжний результат для відгуку, а потім виправлений фінальний, коли речення завершене." },
        { ul: [
          "Перекривні вікна для безперервного потоку",
          "Проміжний результат для миттєвого відгуку",
          "Фінальний прохід із повним контекстом речення",
        ] },
        { h2: "Чому це важливо клінічно" },
        { p: "Низька затримка — це не про технічну елегантність. Коли лікар бачить слова одразу, він ловить помилки на льоту, а не через годину. Швидкість тут напряму працює на точність документа." },
      ],
      en: [
        { p: "Dictation only feels natural when the words appear in step with your speech. Even a second of lag breaks the train of thought. That's why Dictat recognizes speech as a stream, not in batches." },
        { h2: "Streaming, not batch" },
        { p: "Instead of waiting for you to finish a sentence, Dictat processes audio in small overlapping windows. An interim result appears almost instantly and is refined as more context arrives." },
        { h2: "The accuracy tradeoff" },
        { p: "Streaming risks lower accuracy because the model sees less context at once. We recover it with a two-pass approach: a fast interim result for responsiveness, then a corrected final result once the sentence is complete." },
        { ul: [
          "Overlapping windows for a continuous stream",
          "Interim results for instant feedback",
          "A final pass with full sentence context",
        ] },
        { h2: "Why it matters clinically" },
        { p: "Low latency isn't about technical elegance. When a clinician sees the words immediately, they catch mistakes on the spot rather than an hour later. Here, speed works directly in service of an accurate document." },
      ],
    },
  },
  {
    slug: "templates-save-hours",
    tag: { uk: "Продукт", en: "Product" },
    date: { uk: "3 бер. 2026", en: "Mar 3, 2026" },
    read: { uk: "4 хв", en: "4 min" },
    title: {
      uk: "Шаблони, які економлять години",
      en: "Templates that save hours",
    },
    excerpt: {
      uk: "Як структури нотаток адаптуються під спеціальність.",
      en: "How note structures adapt to your specialty.",
    },
    body: {
      uk: [
        { p: "Порожня сторінка — ворог швидкої документації. Найбільше часу з'їдає не набір тексту, а рішення, з чого почати й що куди вписати. Шаблони знімають саме це навантаження." },
        { h2: "Структура під вашу спеціальність" },
        { p: "Радіологічний опис, виписка, амбулаторна нотатка й консультація мають різну логіку. Dictat пропонує готові структури під кожен сценарій — з правильними секціями в правильному порядку, які ви можете адаптувати під заклад." },
        { h2: "Голосові команди, що ведуть вас далі" },
        { p: "Не потрібно торкатися клавіатури, щоб перейти між секціями. Голосові команди переміщують курсор, вставляють стандартні фрази й ставлять пунктуацію — понад 30 інтентів, які тримають руки вільними." },
        { ul: [
          "Системні шаблони плюс власні шаблони закладу",
          "Перехід між секціями голосом",
          "Стандартні фрази й нормалізація одиниць",
        ] },
        { p: "У сумі це перетворює десятихвилинну нотатку на двохвилинну — і кожна виглядає так, ніби її писала одна дисциплінована рука." },
      ],
      en: [
        { p: "A blank page is the enemy of fast documentation. The biggest time sink isn't typing — it's deciding where to start and what goes where. Templates take exactly that load off." },
        { h2: "Structure that matches your specialty" },
        { p: "A radiology report, a discharge summary, an outpatient note and a consult all follow different logic. Dictat offers ready-made structures for each scenario — the right sections in the right order, which you can adapt to your organisation." },
        { h2: "Voice commands that move you through" },
        { p: "You don't need to touch the keyboard to jump between sections. Voice commands move the cursor, insert standard phrases and add punctuation — over 30 intents that keep your hands free." },
        { ul: [
          "System templates plus custom organisation templates",
          "Move between sections by voice",
          "Standard phrases and unit normalization",
        ] },
        { p: "Together, this turns a ten-minute note into a two-minute one — and every note reads as if one disciplined hand wrote it." },
      ],
    },
  },
  {
    slug: "started-with-radiology",
    tag: { uk: "Компанія", en: "Company" },
    date: { uk: "15 лют. 2026", en: "Feb 15, 2026" },
    read: { uk: "7 хв", en: "7 min" },
    title: {
      uk: "Чому ми починали з радіології",
      en: "Why we started with radiology",
    },
    excerpt: {
      uk: "Історія першого прототипу Dictat і чому він спрацював.",
      en: "The story of Dictat's first prototype and why it worked.",
    },
    body: {
      uk: [
        { p: "Кожен продукт десь починається. Наш почався в кабінеті рентгенолога — і це був не випадковий вибір." },
        { h2: "Ідеальна перша задача" },
        { p: "Радіологія майже створена для диктування. Опис має чітку структуру, лексика спеціалізована, але скінченна, а лікарі вже звикли проговорювати висновки вголос. Це дало нам вузьку, але глибоку задачу, на якій можна було довести цінність швидко." },
        { h2: "Чого ми навчилися" },
        { p: "Ми зрозуміли, що точність термінів важливіша за красу тексту, що лікарі не пробачають затримки, і що довіра будується на прозорості, а не на обіцянках. Ці уроки заклали принципи, на яких стоїть уся система сьогодні." },
        { ul: [
          "Спеціалізована лексика б'є універсальну модель",
          "Затримка вбиває відчуття потоку",
          "Прозорість важливіша за «магію»",
        ] },
        { h2: "Від однієї спеціальності до платформи" },
        { p: "Довівши підхід на радіології, ми розширилися на амбулаторний скрайб, виписки й консультації. Але фундамент лишився тим самим: суверенітет даних, лікар у контурі, ізоляція тенантів. Радіологія навчила нас, як будувати все інше." },
        { quote: "Почни там, де задача найгостріша, — і вона навчить тебе рештти." },
      ],
      en: [
        { p: "Every product starts somewhere. Ours started in a radiology reading room — and that wasn't an accident." },
        { h2: "A perfect first problem" },
        { p: "Radiology is almost made for dictation. Reports have a clear structure, the vocabulary is specialized but finite, and clinicians already speak their findings aloud. That gave us a narrow but deep problem where we could prove value quickly." },
        { h2: "What we learned" },
        { p: "We learned that term accuracy matters more than pretty prose, that clinicians won't forgive latency, and that trust is built on transparency rather than promises. Those lessons became the principles the whole system stands on today." },
        { ul: [
          "Specialized vocabulary beats a generic model",
          "Latency kills the sense of flow",
          "Transparency matters more than 'magic'",
        ] },
        { h2: "From one specialty to a platform" },
        { p: "Having proven the approach in radiology, we expanded to the ambient scribe, discharge summaries and consults. But the foundation stayed the same: data sovereignty, clinician in the loop, tenant isolation. Radiology taught us how to build everything else." },
        { quote: "Start where the problem is sharpest — and it will teach you the rest." },
      ],
    },
  },
];

export function listPosts(lang) {
  const l = lang === "uk" ? "uk" : "en";
  return BLOG_POSTS.map((p) => ({
    slug: p.slug,
    tag: p.tag[l], title: p.title[l], excerpt: p.excerpt[l],
    date: p.date[l], read: p.read[l],
  }));
}

export function getPost(slug, lang) {
  const l = lang === "uk" ? "uk" : "en";
  const p = BLOG_POSTS.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    slug: p.slug,
    tag: p.tag[l], title: p.title[l], excerpt: p.excerpt[l],
    date: p.date[l], read: p.read[l], body: p.body[l],
  };
}
