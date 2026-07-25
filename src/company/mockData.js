// mockData.js — EVERY fabricated number in the owner console lives here.
//
// Nothing in this file is measured. It exists so the Business tab can show the
// shape of the report we want before the systems that would populate it exist,
// and so that the complete inventory of fiction is one file you can read in a
// minute rather than something scattered through six panels.
//
// Rules:
//   1. No panel may hard-code a business figure. It imports from here, or it is
//      live/derived. Enforced by src/company/noInlineMocks.test.js.
//   2. Every entry carries `need` — the concrete thing that would replace it
//      with a real number. A placeholder without a route to becoming real is
//      just a lie with a nice font.
//   3. Every entry renders behind a `mock` provenance badge. No exceptions.
//
// When a real source lands, delete the entry here and switch the panel to
// `live`/`derived`. The test that counts mocks will drop, which is the point.

export const MOCK_NOTICE_EN =
  "Not measured. Klarnote has no billing, CRM or support system wired up, so these are illustrative.";
export const MOCK_NOTICE_UK =
  "Не виміряно. У Klarnote немає підключеного білінгу, CRM чи сервісу підтримки — це ілюстративні значення.";

// ── Revenue ────────────────────────────────────────────────────────────────
export const MOCK_REVENUE = {
  mrrUsd: 18_400,
  mrrPrevUsd: 16_950,
  arrUsd: 220_800,
  expansionMrrUsd: 2_100,
  contractionMrrUsd: 480,
  churnedMrrUsd: 650,
  need: "A billing service (or Stripe bridge) exposing subscriptions and invoices.",
  needUk: "Сервіс білінгу (або міст до Stripe) з підписками та рахунками.",
};

// ── Retention & churn ──────────────────────────────────────────────────────
export const MOCK_RETENTION = {
  netRevenueRetentionPct: 108,
  grossLogoChurnPct: 2.1,
  averageContractMonths: 14,
  need: "Subscription lifecycle events (started / upgraded / cancelled) over ≥ 12 months.",
  needUk: "Події життєвого циклу підписки (старт / апгрейд / скасування) за ≥ 12 місяців.",
};

// ── Acquisition ────────────────────────────────────────────────────────────
export const MOCK_ACQUISITION = {
  cacUsd: 1_250,
  ltvUsd: 7_900,
  paybackMonths: 9,
  need: "Marketing spend + a CRM that attributes a signed tenant to a campaign.",
  needUk: "Витрати на маркетинг + CRM, яка прив'язує підписаного тенанта до кампанії.",
};

// ── Funnel ─────────────────────────────────────────────────────────────────
// Ordered stages; each `count` is the number that REACHED that stage.
export const MOCK_FUNNEL = {
  stages: [
    { key: "lead",   labelEn: "Leads",          labelUk: "Ліди",            count: 340 },
    { key: "demo",   labelEn: "Demo booked",    labelUk: "Демо заплановано", count: 96 },
    { key: "trial",  labelEn: "Trial started",  labelUk: "Пробний період",   count: 41 },
    { key: "paid",   labelEn: "Converted",      labelUk: "Конвертовано",     count: 14 },
  ],
  need: "The /signup 'request access' leads are emailed, not stored — they need a CRM or a leads table.",
  needUk: "Заявки з /signup надсилаються поштою, а не зберігаються — потрібна CRM або таблиця лідів.",
};

// ── Support ────────────────────────────────────────────────────────────────
export const MOCK_SUPPORT = {
  openTickets: 7,
  medianFirstResponseHours: 3.4,
  csatPct: 94,
  need: "A helpdesk (Zendesk / Intercom / email queue) with an API.",
  needUk: "Служба підтримки (Zendesk / Intercom / поштова черга) з API.",
};

// ── Runway ─────────────────────────────────────────────────────────────────
export const MOCK_RUNWAY = {
  monthlyBurnUsd: 41_000,
  cashUsd: 615_000,
  runwayMonths: 15,
  need: "Finance data — this will always be entered, never measured by the product.",
  needUk: "Фінансові дані — їх завжди вводять вручну, продукт їх не вимірює.",
};

// ── Support tickets ────────────────────────────────────────────────────────
// Klarnote has no helpdesk at all, so the whole queue is fiction — including
// the rows, not just the totals.
export const MOCK_TICKETS = {
  byPriority: { urgent: 1, high: 2, normal: 3, low: 1 },
  byStatus: { open: 7, pending: 4, solved: 38 },
  slaBreaches: 1,
  backlogTrend: [12, 10, 11, 9, 8, 9, 7].map((v, i) => ({ key: `d${i + 1}`, value: v, count: v })),
  rows: [
    { id: "KN-412", subject: "Dictation cuts out after ~40 s on Safari", tenant: "Dev Hospital A",
      priority: "urgent", status: "open", ageHours: 6 },
    { id: "KN-410", subject: "Request: add ICD-10 favourites per clinician", tenant: "Klinic",
      priority: "normal", status: "pending", ageHours: 52 },
    { id: "KN-408", subject: "PDF export missing the signature block", tenant: "Dev Hospital B",
      priority: "high", status: "open", ageHours: 19 },
    { id: "KN-405", subject: "Nurse cannot see the patient roster", tenant: "Dev Hospital A",
      priority: "high", status: "open", ageHours: 27 },
    { id: "KN-401", subject: "Invoice address needs updating", tenant: "Klinic",
      priority: "low", status: "pending", ageHours: 96 },
  ],
  need: "A helpdesk with an API (Zendesk / Intercom / a mailbox with a queue).",
  needUk: "Служба підтримки з API (Zendesk / Intercom / поштова скринька з чергою).",
};

// ── Incidents ──────────────────────────────────────────────────────────────
// Live service health is real (probed each load); incident HISTORY is not —
// nothing records an incident anywhere in the stack.
export const MOCK_INCIDENTS = {
  rows: [
    { id: "INC-07", title: "ASR worker backlog — transcripts delayed ~25 min",
      severity: "major", startedAgoH: 74, durationMin: 96, service: "asr", resolved: true },
    { id: "INC-06", title: "Keycloak restart dropped active sessions",
      severity: "minor", startedAgoH: 210, durationMin: 14, service: "auth", resolved: true },
    { id: "INC-05", title: "Report PDF rendering timeouts under load",
      severity: "major", startedAgoH: 480, durationMin: 132, service: "report", resolved: true },
  ],
  mttrMinutes: 81,
  incidentsThisQuarter: 3,
  need: "An incident record (even a table) plus alerting — Prometheus rules exist but nothing persists an incident.",
  needUk: "Запис інцидентів (бодай таблиця) і алертинг — правила Prometheus є, але інциденти ніде не зберігаються.",
};

// ── SLO / uptime ───────────────────────────────────────────────────────────
export const MOCK_SLO = {
  uptimePct: 99.82,
  targetPct: 99.9,
  errorBudgetUsedPct: 64,
  p95LatencyMs: 410,
  need: "A Prometheus read proxy — the series exist in the cluster, the browser just cannot reach them.",
  needUk: "Проксі до Prometheus — ряди є в кластері, але браузер до них не дістається.",
};

// ── Releases ───────────────────────────────────────────────────────────────
export const MOCK_RELEASES = {
  rows: [
    { version: "S14", agoDays: 4,  note: "Admin ⟂ PHI split, break-glass access", services: "auth, report" },
    { version: "S13", agoDays: 18, note: "Typed fields, proposal grammar, 5 renderers", services: "report, dictation" },
    { version: "S12", agoDays: 33, note: "Notifications: feed, WebSocket push, preferences", services: "notification" },
  ],
  deployFrequencyPerWeek: 2.4,
  changeFailurePct: 8,
  need: "A CI/CD API (GitHub Actions or the deploy pipeline) reporting what shipped when.",
  needUk: "API CI/CD (GitHub Actions або конвеєр деплою), який повідомляє, що і коли випущено.",
};

// ── Monthly series (12 points, oldest → newest) ────────────────────────────
export const MOCK_MRR_SERIES = [
  8_200, 9_100, 10_400, 11_200, 12_600, 13_100,
  14_000, 14_900, 15_600, 16_300, 16_950, 18_400,
].map((v, i) => ({ key: `m${i + 1}`, value: v, count: v }));

export const MOCK_TENANT_SERIES = [
  3, 4, 4, 5, 6, 7, 8, 9, 9, 11, 12, 14,
].map((v, i) => ({ key: `m${i + 1}`, value: v, count: v }));

// One place to count how much of the Business tab is fiction — the number is
// shown in the legend so it is impossible to lose track of.
export const MOCK_METRIC_COUNT =
  Object.keys(MOCK_REVENUE).length - 2      // minus need/needUk
  + Object.keys(MOCK_RETENTION).length - 2
  + Object.keys(MOCK_ACQUISITION).length - 2
  + Object.keys(MOCK_SUPPORT).length - 2
  + Object.keys(MOCK_RUNWAY).length - 2
  + MOCK_FUNNEL.stages.length;
