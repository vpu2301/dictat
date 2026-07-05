// LandingPage.jsx — Public marketing landing for Dictat.
// Renders inside MarketingShell (shared dropdown nav + footer) with:
// hero, stats, principles, products, features, workflow, testimonials,
// specialties, security and a closing CTA.
// Bilingual (uk/en) via the shared `lang` tweak; no auth required.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";

/* ── Copy ─────────────────────────────────────────────────────
   One bilingual dictionary keeps the marketing surface readable
   and easy to keep in sync between Ukrainian and English. */
const COPY = {
  uk: {
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
      { v: "6+ год", l: "економії на тиждень на лікаря" },
      { v: "2 мови", l: "українська та англійська" },
      { v: "12+", l: "клінічних спеціальностей" },
    ],
    principlesKicker: "Основа",
    principlesTitle: "Збудовано на трьох непорушних принципах",
    principlesSub: "Це не маркетинг, а архітектурні обмеження — закладені в систему, а не дописані згори.",
    principles: [
      { icon: "home", t: "Суверенітет даних", d: "Усе ASR і генерація працюють на self-hosted відкритих моделях. Жодне аудіо, транскрипт чи нотатка не йдуть до сторонніх API." },
      { icon: "user", t: "Лікар у контурі", d: "Система готує чернетку, але не діагностує. Жоден документ не фіналізується автоматично — останнє слово за лікарем." },
      { icon: "layers", t: "Ізоляція тенантів", d: "Код ніколи не фільтрує за тенантом — це робить база даних через row-level security. Відсутній фільтр не може призвести до витоку." },
    ],
    productsKicker: "Два режими",
    productsTitle: "Два продукти — один робочий процес",
    productsSub: "Оберіть режим під свій сценарій: амбулаторний прийом або класичне диктування звітів.",
    products: [
      {
        icon: "waveform", tag: "Scribe", path: "/product/scribe",
        title: "Амбулаторний скрайб",
        body: "Веде прийом разом з вами: фіксує розмову з пацієнтом, формує структуровану нотатку та підказує наступні кроки.",
        points: ["Згода пацієнта та індикатор запису", "Профілі пацієнтів і таймлайн візитів", "Автоматична структура нотатки"],
      },
      {
        icon: "fileText", tag: "Dictate", path: "/product/dictate",
        title: "Диктування звітів",
        body: "Класичне диктування для радіології, патології та виписок із шаблонами, голосовими командами та порівнянням версій.",
        points: ["Шаблони звітів і голосові команди", "Порівняння змін та амендменти", "Експорт, друк і підписання"],
      },
    ],
    featuresKicker: "Можливості",
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
    workflowKicker: "Як це працює",
    workflowTitle: "Від голосу до підписаного документа",
    workflow: [
      { n: "01", t: "Говоріть", d: "Почніть прийом або диктування — Dictat розпізнає мову в реальному часі." },
      { n: "02", t: "Перевірте", d: "Структурована нотатка з підсвіченими сумнівними місцями для швидкої правки." },
      { n: "03", t: "Підпишіть", d: "Підпишіть через Дія та поділіться посиланням для перевірки." },
    ],
    quotesKicker: "З клінік",
    quotesTitle: "Лікарі вже повернули собі вечори",
    quotesSub: "Реальні робочі процеси в клініках, які документують голосом.",
    quotes: [
      { text: "Раніше я закінчувала виписки о дев'ятій вечора. Тепер документ готовий, щойно пацієнт виходить з кабінету.", name: "Олена К.", role: "Сімейна лікарка", org: "Медичний центр, Київ" },
      { text: "Висновок КТ, який я друкував пів години, тепер диктую за п'ять хвилин.", name: "Андрій М.", role: "Радіолог", org: "Обласна лікарня, Львів" },
      { text: "Dictat прибрав ноутбук, що стояв між мною та пацієнтом.", name: "Марія С.", role: "Психотерапевтка", org: "Приватна практика, Одеса" },
    ],
    quotesMore: "Усі історії клієнтів",
    specKicker: "Ваша галузь",
    specTitle: "Створено для вашої спеціальності",
    specSub: "Шаблони, термінологія та робочі процеси — під те, як документує саме ваша галузь.",
    specialties: [
      { icon: "home", t: "Сімейна медицина", path: "/specialties/general-practice" },
      { icon: "scan", t: "Радіологія", path: "/specialties/radiology" },
      { icon: "heart", t: "Психіатрія і психологія", path: "/specialties/mental-health" },
      { icon: "scalpel", t: "Хірургія", path: "/specialties/surgery" },
      { icon: "users", t: "Педіатрія", path: "/specialties/pediatrics" },
      { icon: "waveform", t: "Кардіологія", path: "/specialties/cardiology" },
    ],
    specMore: "Усі спеціальності",
    securityKicker: "Довіра",
    securityTitle: "Безпека та приватність за замовчуванням",
    securitySub: "Дані пацієнтів захищені на кожному етапі — від запису до архіву.",
    security: [
      { icon: "shield", t: "Рольовий доступ", d: "Доступ за ролями: лікар, адміністратор, аудитор." },
      { icon: "history", t: "Незмінний аудит", d: "Кожна дія фіксується з можливістю перевірки цілісності." },
      { icon: "check", t: "Згода пацієнта", d: "Явна згода перед записом і прозорий індикатор стану." },
    ],
    securityMore: "Докладніше про безпеку",
    ctaTitle: "Готові повернути час лікарям?",
    ctaSub: "Спробуйте Dictat у вашій клініці вже сьогодні.",
    ctaPrimary: "Запросити доступ",
    ctaSecondary: "Подивитися ціни",
  },
  en: {
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
      { v: "6+ hrs", l: "saved per clinician per week" },
      { v: "2 languages", l: "Ukrainian and English" },
      { v: "12+", l: "clinical specialties" },
    ],
    principlesKicker: "Foundations",
    principlesTitle: "Built on three non-negotiable principles",
    principlesSub: "Not marketing but architectural constraints — built into the system, not bolted on afterwards.",
    principles: [
      { icon: "home", t: "Data sovereignty", d: "All ASR and generation run on self-hosted, open-licensed models. No audio, transcript or note ever goes to a third-party API." },
      { icon: "user", t: "Clinician in the loop", d: "The system drafts, it does not diagnose. Nothing is finalized automatically — the clinician always has the last word." },
      { icon: "layers", t: "Tenant isolation", d: "Application code never filters by tenant — the database does, via row-level security. A missing filter can't leak data." },
    ],
    productsKicker: "Two modes",
    productsTitle: "Two products — one workflow",
    productsSub: "Pick the mode for your scenario: ambient encounters or classic report dictation.",
    products: [
      {
        icon: "waveform", tag: "Scribe", path: "/product/scribe",
        title: "Ambient scribe",
        body: "Runs the visit with you: captures the patient conversation, builds a structured note and suggests next steps.",
        points: ["Patient consent & recording indicator", "Patient profiles and visit timeline", "Automatic note structure"],
      },
      {
        icon: "fileText", tag: "Dictate", path: "/product/dictate",
        title: "Report dictation",
        body: "Classic dictation for radiology, pathology and discharge summaries with templates, voice commands and version diffs.",
        points: ["Report templates and voice commands", "Change diffs and amendments", "Export, print and sign"],
      },
    ],
    featuresKicker: "Capabilities",
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
    workflowKicker: "How it works",
    workflowTitle: "From voice to a signed document",
    workflow: [
      { n: "01", t: "Speak", d: "Start an encounter or dictation — Dictat recognizes speech in real time." },
      { n: "02", t: "Review", d: "A structured note with uncertain spots highlighted for fast edits." },
      { n: "03", t: "Sign", d: "Sign via Дія and share a verification link." },
    ],
    quotesKicker: "From the field",
    quotesTitle: "Clinicians already got their evenings back",
    quotesSub: "Real workflows from clinics documenting by voice.",
    quotes: [
      { text: "I used to finish discharge summaries at nine in the evening. Now the document is ready by the time the patient leaves the room.", name: "Olena K.", role: "Family physician", org: "Medical center, Kyiv" },
      { text: "A CT report that took me half an hour to type is now a five-minute dictation.", name: "Andrii M.", role: "Radiologist", org: "Regional hospital, Lviv" },
      { text: "Dictat removed the laptop that used to sit between me and my patient.", name: "Maria S.", role: "Psychotherapist", org: "Private practice, Odesa" },
    ],
    quotesMore: "All customer stories",
    specKicker: "Your field",
    specTitle: "Built for your specialty",
    specSub: "Templates, terminology and workflows shaped by how your field documents.",
    specialties: [
      { icon: "home", t: "General practice", path: "/specialties/general-practice" },
      { icon: "scan", t: "Radiology", path: "/specialties/radiology" },
      { icon: "heart", t: "Psychiatry & psychology", path: "/specialties/mental-health" },
      { icon: "scalpel", t: "Surgery", path: "/specialties/surgery" },
      { icon: "users", t: "Pediatrics", path: "/specialties/pediatrics" },
      { icon: "waveform", t: "Cardiology", path: "/specialties/cardiology" },
    ],
    specMore: "All specialties",
    securityKicker: "Trust",
    securityTitle: "Security and privacy by default",
    securitySub: "Patient data is protected at every step — from recording to archive.",
    security: [
      { icon: "shield", t: "Role-based access", d: "Access by role: clinician, administrator, auditor." },
      { icon: "history", t: "Immutable audit", d: "Every action is logged with integrity verification." },
      { icon: "check", t: "Patient consent", d: "Explicit consent before recording with a clear status indicator." },
    ],
    securityMore: "More about security",
    ctaTitle: "Ready to give clinicians their time back?",
    ctaSub: "Try Dictat in your clinic today.",
    ctaPrimary: "Request access",
    ctaSecondary: "See pricing",
  },
};

/* ── Hero dictation demo ──────────────────────────────────────
   Interactive product mock: a live recorder with player controls
   (stop / pause / restart), a running timer, a JS-driven waveform
   and speech-to-text that types itself out word by word. Purely a
   simulation — no mic access — but it behaves like the real Studio. */
const DEMO_TRANSCRIPT = {
  uk: ["Пацієнт", "скаржиться", "на", "легкий", "дискомфорт", "у", "грудях.",
       "ЕКГ —", "синусовий", "ритм", "у", "нормі.", "Ознак", "гострої",
       "ішемії", "не", "виявлено."],
  en: ["Patient", "reports", "mild", "chest", "discomfort.", "ECG", "shows",
       "normal", "sinus", "rhythm.", "No", "signs", "of", "acute",
       "ischemia", "identified."],
};
const DEMO_BARS = 30;

function HeroDictationDemo({ lang }) {
  const uk = lang === "uk";
  const words = DEMO_TRANSCRIPT[uk ? "uk" : "en"];
  const [phase, setPhase] = React.useState("recording"); // recording | paused | done
  const [elapsed, setElapsed] = React.useState(0);
  const [nWords, setNWords] = React.useState(0);
  const [bars, setBars] = React.useState(() => Array.from({ length: DEMO_BARS }, () => 8));

  const recording = phase === "recording";

  // Running timer (tenths of a second for a lively readout).
  React.useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [recording]);

  // Reveal the transcript one word at a time, then auto-finalize.
  React.useEffect(() => {
    if (!recording) return;
    if (nWords >= words.length) {
      const t = setTimeout(() => setPhase("done"), 950);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setNWords((n) => n + 1), 340);
    return () => clearTimeout(t);
  }, [recording, nWords, words.length]);

  // Live waveform: a quick random walk while recording, flat otherwise.
  React.useEffect(() => {
    if (!recording) {
      setBars((bs) => bs.map(() => 5));
      return;
    }
    const id = setInterval(() => {
      setBars((bs) => bs.map((h) => {
        const next = h + (Math.random() * 40 - 20);
        return Math.max(5, Math.min(52, next));
      }));
    }, 110);
    return () => clearInterval(id);
  }, [recording]);

  const finish = () => { setNWords(words.length); setPhase("done"); };
  const restart = () => { setElapsed(0); setNWords(0); setPhase("recording"); };
  const togglePause = () => setPhase((p) => (p === "recording" ? "paused" : "recording"));

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");
  const done = phase === "done";

  return (
    <div className="lp-mock lp-mock-live">
      <div className="lp-mock-bar">
        <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
        <span className="lp-mock-title">{uk ? "Студія Dictat" : "Dictat Studio"}</span>
      </div>
      <div className="lp-mock-body">
        <div className={`lp-mock-rec ${phase}`}>
          {done ? (
            <><Icon name="check" size={14} /> {uk ? "Нотатку готово" : "Note ready"}</>
          ) : (
            <><span className="lp-pulse" /> {phase === "paused"
              ? (uk ? "Пауза" : "Paused")
              : (uk ? "Запис…" : "Recording…")}</>
          )}
          <span className="lp-timer">{mm}:{ss}</span>
        </div>

        <div className={`lp-wave ${phase}`}>
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${h}px` }} />
          ))}
        </div>

        <div className="lp-transcript">
          {nWords === 0 && !done ? (
            <span className="lp-transcript-hint">
              {uk ? "Говоріть — текст з'явиться тут" : "Start speaking — text appears here"}
            </span>
          ) : (
            <>{words.slice(0, nWords).join(" ")}{!done && <span className="lp-caret" />}</>
          )}
        </div>

        <div className="lp-player">
          {done ? (
            <button className="lp-player-btn" onClick={restart}
                    aria-label={uk ? "Записати ще раз" : "Record again"}>
              <Icon name="mic" size={20} />
            </button>
          ) : (
            <>
              <button className="lp-player-btn rec" onClick={finish}
                      aria-label={uk ? "Зупинити запис" : "Stop recording"}>
                <Icon name="stop" size={20} />
              </button>
              <button className="lp-mini-btn" onClick={togglePause}
                      aria-label={phase === "paused"
                        ? (uk ? "Продовжити" : "Resume")
                        : (uk ? "Пауза" : "Pause")}>
                <Icon name={phase === "paused" ? "play" : "pause"} size={16} />
              </button>
            </>
          )}
          <div className="lp-player-meta">
            {done ? (
              <span className="lp-mock-chip"><Icon name="sign" size={13} /> {uk ? "Підписано · Дія" : "Signed · Дія"}</span>
            ) : (
              <span className="lp-player-status">{uk ? "Розпізнавання в реальному часі" : "Real-time recognition"}</span>
            )}
          </div>
        </div>
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

        {/* Interactive product mock — live recorder, pure CSS + state. */}
        <div className="lp-hero-art">
          <HeroDictationDemo lang={lang} />
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
          <span className="lp-kicker">{c.principlesKicker}</span>
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
          <span className="lp-kicker">{c.productsKicker}</span>
          <h2 className="lp-h2">{c.productsTitle}</h2>
          <p className="lp-sub">{c.productsSub}</p>
        </div>
        <div className="lp-products">
          {c.products.map((p, i) => (
            <a className="lp-product" href={`#${p.path}`} onClick={go(p.path)} key={i}>
              <div className="lp-product-icon"><Icon name={p.icon} size={22} /></div>
              <span className="lp-product-tag">{p.tag}</span>
              <h3 className="lp-product-title">{p.title}</h3>
              <p className="lp-product-body">{p.body}</p>
              <ul className="lp-product-points">
                {p.points.map((pt, j) => (
                  <li key={j}><Icon name="check" size={14} /> {pt}</li>
                ))}
              </ul>
              <span className="mk-card-more">{lang === "uk" ? "Докладніше" : "Learn more"} <Icon name="arrowRight" size={14} /></span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="features">
        <div className="lp-head">
          <span className="lp-kicker">{c.featuresKicker}</span>
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
          <span className="lp-kicker">{c.workflowKicker}</span>
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

      {/* ── Testimonials ─────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="customers">
        <div className="lp-head">
          <span className="lp-kicker">{c.quotesKicker}</span>
          <h2 className="lp-h2">{c.quotesTitle}</h2>
          <p className="lp-sub">{c.quotesSub}</p>
        </div>
        <div className="mk-quotes">
          {c.quotes.map((q, i) => (
            <figure className="mk-quote" key={i}>
              <blockquote>“{q.text}”</blockquote>
              <figcaption>
                <span className="mk-quote-ava" aria-hidden="true">{q.name.slice(0, 1)}</span>
                <span className="mk-quote-who">
                  <span className="mk-quote-name">{q.name}</span>
                  <span className="mk-quote-role">{q.role} · {q.org}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="lp-section-cta">
          <a className="btn lp-cta-lg" href="#/customers" onClick={go("/customers")}>{c.quotesMore}</a>
        </div>
      </section>

      {/* ── Specialties ──────────────────────────────────── */}
      <section className="lp-section" id="specialties">
        <div className="lp-head">
          <span className="lp-kicker">{c.specKicker}</span>
          <h2 className="lp-h2">{c.specTitle}</h2>
          <p className="lp-sub">{c.specSub}</p>
        </div>
        <div className="lp-specs">
          {c.specialties.map((s, i) => (
            <a className="lp-spec" href={`#${s.path}`} onClick={go(s.path)} key={i}>
              <span className="lp-spec-ic"><Icon name={s.icon} size={17} /></span>
              <span className="lp-spec-t">{s.t}</span>
              <Icon name="arrowRight" size={15} />
            </a>
          ))}
        </div>
        <div className="lp-section-cta">
          <a className="btn lp-cta-lg" href="#/specialties" onClick={go("/specialties")}>{c.specMore}</a>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="security">
        <div className="lp-head">
          <span className="lp-kicker">{c.securityKicker}</span>
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
        <div className="lp-section-cta">
          <a className="btn lp-cta-lg" href="#/security" onClick={go("/security")}>{c.securityMore}</a>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="lp-cta">
        <h2 className="lp-cta-title">{c.ctaTitle}</h2>
        <p className="lp-cta-sub">{c.ctaSub}</p>
        <div className="lp-cta-actions">
          <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{c.ctaPrimary}</a>
          <a className="btn lp-cta-lg" href="#/pricing" onClick={go("/pricing")}>{c.ctaSecondary}</a>
        </div>
      </section>
    </MarketingShell>
  );
}
