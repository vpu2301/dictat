// RoadmapTab.jsx — two lists that belong together.
//
//   1. GAPS — capabilities this console shows but cannot truly serve, each with
//      the exact blocker, verified against medical-dictation-backend.
//   2. NEXT — what I would build, ordered by what unblocks the most.
//
// Kept as one page because a gap without a proposed fix is a complaint, and a
// roadmap that ignores the blockers is a wish list. Effort figures are my
// estimates, not measurements — badged accordingly.
import React from "react";
import { Panel } from "../../components/dashboard/Panel.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { BACKEND_GAPS } from "../../api/company.js";

// Ordered by leverage: each entry unblocks the ones below it more than the
// reverse. `unlocks` names what stops being a placeholder once it ships.
const NEXT = [
  {
    id: "platform-role",
    priority: "P0",
    effort: "S",
    titleUk: "Платформна роль із крос-тенантним читанням",
    titleEn: "A platform role with cross-tenant read",
    whyUk: "Найбільший важіль на платформі. Сьогодні консоль охоплює лише ті тенанти, до яких власник є учасником, а глибокі дані — лише активний тенант. Одна роль знімає обидва обмеження.",
    whyEn: "The highest-leverage change on the platform. Today the console only reaches tenants the owner is a member of, and deep data only for the active tenant. One role removes both limits.",
    howUk: "Додати роль до KNOWN_ROLES + ALLOW, видавати через Keycloak, і відкрити /platform/* лише для неї — з окремим пулом БД, який має право читати між тенантами, і обов'язковим записом в аудит на кожне таке читання.",
    howEn: "Add the role to KNOWN_ROLES + ALLOW, issue it via Keycloak, and gate /platform/* on it — with a distinct DB pool allowed to read across tenants, and a mandatory audit write on every such read.",
    unlocksUk: "Портфельне використання · справжній серверний шлюз консолі · крос-тенантне керування",
    unlocksEn: "Portfolio-wide usage · a real server-side console gate · cross-tenant management",
  },
  {
    id: "billing",
    priority: "P0",
    effort: "L",
    titleUk: "Сервіс білінгу",
    titleEn: "A billing service",
    whyUk: "Уся вкладка «Бізнес» вище пояса — заповнювачі саме тому, що цього немає. Без нього немає ні MRR, ні відтоку, ні лімітів місць, ні рахунків.",
    whyEn: "Everything above the waist on the Business tab is a placeholder precisely because this does not exist. Without it there is no MRR, no churn, no seat limits, no invoices.",
    howUk: "Міст до Stripe плюс власна таблиця підписок: план, ліміт місць, стан пробного періоду, історія рахунків. Ліміт місць має також застосовуватися при запрошенні користувача.",
    howEn: "A Stripe bridge plus an owned subscriptions table: plan, seat limit, trial state, invoice history. The seat limit should also be enforced at user-invite time.",
    unlocksUk: "MRR · ARR · NRR · відтік · окупність CAC · застосування лімітів місць",
    unlocksEn: "MRR · ARR · NRR · churn · CAC payback · seat-limit enforcement",
  },
  {
    id: "usage-rollup",
    priority: "P1",
    effort: "M",
    titleUk: "Агрегація використання на боці сервера",
    titleEn: "Server-side usage roll-ups",
    whyUk: "Консоль зараз обходить сторінки й рахує в браузері — з обмеженнями, які доводиться чесно позначати як «приблизно». Це не масштабується далі кількох тенантів.",
    whyEn: "The console currently walks pages and counts in the browser — with caps it has to honestly badge as approximate. That does not scale past a handful of tenants.",
    howUk: "Нічне матеріалізоване подання на тенанта й день: хвилини, сесії, завдання ASR, звіти за статусом, активні місця. Один ендпоінт GET /platform/usage.",
    howEn: "A nightly materialised view per tenant per day: minutes, sessions, ASR jobs, reports by status, active seats. One GET /platform/usage endpoint.",
    unlocksUk: "точні тренди · порівняння тенантів · когортні графіки утримання",
    unlocksEn: "exact trends · tenant comparison · cohort retention charts",
  },
  {
    id: "asr-quota",
    priority: "P1",
    effort: "S",
    titleUk: "Читання спожитої квоти ASR",
    titleEn: "An ASR quota readout",
    whyUk: "Ліміт застосовується, але спожитий обсяг не видно ніде — про перевищення дізнаємося лише з події аудиту, тобто заднім числом.",
    whyEn: "The cap is enforced but consumption is invisible — we only learn about an overrun from an audit event, i.e. after the fact.",
    howUk: "GET /asr/quota → { used_bytes, limit_bytes, period_start }. Значення вже рахується всередині транзакції завантаження — його треба лише віддати.",
    howEn: "GET /asr/quota → { used_bytes, limit_bytes, period_start }. The number is already computed inside the upload transaction — it just needs exposing.",
    unlocksUk: "попередження до перевищення · тарифікація за обсягом",
    unlocksEn: "warn-before-overrun · usage-based pricing",
  },
  {
    id: "metrics-proxy",
    priority: "P2",
    effort: "M",
    titleUk: "Проксі до Prometheus лише для читання",
    titleEn: "A read-only Prometheus proxy",
    whyUk: "Prometheus, Grafana, Loki й Jaeger уже працюють у цьому стеку, але браузер до них не дістається — консоль показує лише миттєвий стан і час відгуку.",
    whyEn: "Prometheus, Grafana, Loki and Jaeger already run in this stack, but the browser cannot reach them — the console can only show instantaneous state and round-trip time.",
    howUk: "GET /platform/metrics?q=… з авторизацією власника й білим списком запитів. Білий список важливий: довільний PromQL — це вектор відмови в обслуговуванні.",
    howEn: "GET /platform/metrics?q=… with owner auth and an allow-list of queries. The allow-list matters: arbitrary PromQL is a denial-of-service vector.",
    unlocksUk: "ряди латентності · частота помилок · глибина черг · SLO-бюджети",
    unlocksEn: "latency series · error rates · queue depth · SLO budgets",
  },
  {
    id: "lifecycle",
    priority: "P2",
    effort: "M",
    titleUk: "Життєвий цикл тенанта",
    titleEn: "Tenant lifecycle",
    whyUk: "Клініку можна створити, але не призупинити, не архівувати й не перенести власника — а це саме те, що потрібно, коли клієнт перестає платити або йде.",
    whyEn: "A clinic can be created but not suspended, archived or handed to a new owner — which is exactly what is needed when a customer stops paying or leaves.",
    howUk: "Призупинення на рівні клініки (не платформне деактивування користувача), архівація зі збереженням даних, передача власника, експорт при відході.",
    howEn: "Clinic-scoped suspend (not the platform-wide user deactivate), archive-with-retention, owner handover, and an export-on-exit path.",
    unlocksUk: "стягнення заборгованості · відповідність вимогам зберігання · чистий вихід клієнта",
    unlocksEn: "dunning · retention compliance · clean customer offboarding",
  },
  {
    id: "crm",
    priority: "P3",
    effort: "M",
    titleUk: "Збереження лідів",
    titleEn: "Lead capture",
    whyUk: "Заявки з /signup надсилаються поштою й ніде не зберігаються, тож воронка на вкладці «Бізнес» повністю вигадана.",
    whyEn: "The /signup requests are emailed and stored nowhere, which is why the Business funnel is entirely invented.",
    howUk: "Таблиця лідів зі станом і джерелом, або інтеграція з CRM. Достатньо навіть мінімальної версії, щоб воронка стала справжньою.",
    howEn: "A leads table with state and source, or a CRM integration. Even a minimal version makes the funnel real.",
    unlocksUk: "конверсія воронки · атрибуція CAC · час до першої нотатки",
    unlocksEn: "funnel conversion · CAC attribution · time-to-first-note",
  },
];

const PRIORITY_TONE = { P0: "p0", P1: "p1", P2: "p2", P3: "p3" };

export function RoadmapTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";
  const pick = (row, key) => (isUk ? row[key + "Uk"] : row[key + "En"]);

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Нижче — спершу те, що блокує (звірено з кодом бекенду), потім те, що я збудував би далі, за спаданням важеля. Оцінки складності — мої, не виміряні.",
             "Below: first what blocks (verified against backend source), then what I would build next, in descending order of leverage. Effort figures are my estimates, not measurements.")}
        </span>
      </div>

      {/* ── What I would build next ──────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Що будувати далі", "What to build next")}</h3>
      {NEXT.map((n) => (
        <Panel key={n.id} title={pick(n, "title")} icon="sparkle"
               sub={`${n.priority} · ${T("складність", "effort")} ${n.effort}`}>
          <div className="co-next">
            <span className={"co-prio p-" + PRIORITY_TONE[n.priority]}>{n.priority}</span>
            <div>
              <p className="co-next-why">{pick(n, "why")}</p>
              <p className="co-next-how"><strong>{T("Як:", "How:")}</strong> {pick(n, "how")}</p>
              <p className="co-next-unlocks">
                <Icon name="check" size={12} />
                <strong>{T("Розблоковує:", "Unlocks:")}</strong> {pick(n, "unlocks")}
              </p>
              <Provenance source="mock" lang={lang}
                          note={T("Пріоритет і складність — оцінка, а не вимірювання.",
                                  "Priority and effort are an estimate, not a measurement.")} />
            </div>
          </div>
        </Panel>
      ))}

      {/* ── The verified blockers ────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Прогалини бекенду", "Backend gaps")}</h3>
      <div className="co-note">
        <Icon name="check" size={13} />
        <span>{T("Кожен пункт звірено з medical-dictation-backend, а не припущено.",
                  "Every entry is verified against medical-dictation-backend, not assumed.")}</span>
      </div>
      {BACKEND_GAPS.map((g) => (
        <Panel key={g.id} title={pick(g, "title")} icon="alert">
          <dl className="co-gap">
            <dt className="ok">{T("Є зараз", "Have today")}</dt>
            <dd>{pick(g, "have")}</dd>
            <dt className="bad">{T("Що блокує", "Blocker")}</dt>
            <dd>{pick(g, "blocker")}</dd>
            <dt className="ask">{T("Потрібно від бекенду", "Backend ask")}</dt>
            <dd><code>{pick(g, "need")}</code></dd>
          </dl>
        </Panel>
      ))}

      {/* ── What already works ───────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Що вже працює по-справжньому", "What already works for real")}</h3>
      <Panel title={T("Живі ендпоінти цієї консолі", "This console's live endpoints")} icon="check">
        <ul className="co-worklist">
          <li><code>GET /tenants</code> — {T("портфель тенантів, крос-тенантно", "the tenant portfolio, cross-tenant")}</li>
          <li><code>GET /tenants/{"{id}"}</code> — {T("повний профіль будь-якого вашого тенанта", "full profile of any tenant you belong to")}</li>
          <li><code>GET /tenants/{"{id}"}/members</code> — {T("склад учасників, крос-тенантно", "the member roster, cross-tenant")}</li>
          <li><code>POST /tenants</code> — {T("створення клініки (ви стаєте власником)", "create a clinic (you become its owner)")}</li>
          <li><code>PATCH /tenants/{"{id}"}</code> + <code>/members</code> — {T("керування, лише активний тенант", "management, active tenant only")}</li>
          <li><code>GET/POST/PUT/DELETE /templates</code> — {T("повний життєвий цикл шаблонів із версіюванням", "full template lifecycle with versioning")}</li>
          <li><code>GET /admin/users</code> — {T("реєстр місць активного тенанта", "the active tenant's seat roster")}</li>
          <li><code>GET /audit/events</code> + <code>/audit/verify</code> — {T("хеш-ланцюг подій із перевіркою", "hash-chained events with verification")}</li>
          <li><code>GET /readyz</code> + <code>/healthz</code> × 9 — {T("живий стан платформи", "live platform health")}</li>
          <li><code>/v1/reports/search</code>, <code>/sessions</code>, <code>/asr/jobs</code> — {T("використання активного тенанта", "the active tenant's usage")}</li>
        </ul>
      </Panel>
    </div>
  );
}
