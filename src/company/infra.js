// infra.js — the infrastructure the platform runs on, and how to reach it.
//
// The Telemetry tab says Prometheus/Grafana/Loki/Jaeger exist but the browser
// cannot query them. That is true for *data* — no CORS, no auth bridge — but it
// is not true for *navigation*: every one of them serves a UI on a host port,
// and an owner console that knows the platform has a Grafana should say where
// it is rather than leaving you to remember the port.
//
// ── How the reachability probe works, and what it cannot tell you ──────────
//
// These are cross-origin and send no CORS headers, so an ordinary fetch() is
// rejected by the browser and reads identically to "not running". A `no-cors`
// fetch avoids that: the response is opaque (status always 0, body unreadable)
// but the PROMISE STILL RESOLVES when something answered and rejects when
// nothing did. That is exactly the distinction worth drawing here.
//
// So the states below are honest about their own resolution:
//   answered  — something is listening and responded. NOT "healthy": an opaque
//               response cannot distinguish 200 from 404 from 500.
//   no answer — nothing responded. The container is down, or the port is not
//               published.
//   n/a       — not an HTTP service (Postgres, Redis, Kafka). Listed anyway,
//               because "where is the database" is a question this console
//               should answer, and a link that cannot exist is better shown as
//               a connection string than omitted.

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

// Env key → default URL, extracted from the registry below so that ONE list
// answers two questions: what the console links to, and what the
// Content-Security-Policy has to admit in `connect-src` (sprint 16).
//
// It has to be both. The reachability probe below is a cross-origin fetch, and
// a policy that does not name these origins does not merely block it — the
// probe's `catch` reports "no answer", which is a lie: it says the container is
// down when in fact the browser refused to ask. A monitoring surface that
// reports healthy infrastructure as dead is worse than no monitoring surface,
// so the policy is derived from this list rather than kept beside it.
export const INFRA_ENDPOINTS = {
  VITE_INFRA_GRAFANA: "http://localhost:3001",
  VITE_INFRA_PROMETHEUS: "http://localhost:9090",
  VITE_INFRA_JAEGER: "http://localhost:16686",
  VITE_INFRA_LOKI: "http://localhost:3100",
  VITE_INFRA_MINIO: "http://localhost:9001",
  VITE_INFRA_MAILPIT: "http://localhost:8025",
  VITE_INFRA_KEYCLOAK: "http://localhost:8088/admin/master/console/",
  VITE_INFRA_KEYCLOAK_BASE: "http://localhost:8088",
  VITE_INFRA_OTEL: "http://localhost:8889/metrics",
  VITE_INFRA_EDGE: "https://localhost:8443",
};

const u = (key) => env[key] || INFRA_ENDPOINTS[key];

/**
 * The distinct origins the infrastructure probe reaches, for `connect-src`.
 * Takes an env bag so vite.config.js can resolve it in Node from `loadEnv`,
 * exactly as it does for the service map.
 */
export function infraOrigins(e = env) {
  const out = new Set();
  for (const [key, fallback] of Object.entries(INFRA_ENDPOINTS)) {
    try { out.add(new URL(e[key] || fallback).origin); } catch { /* unset */ }
  }
  return [...out].sort();
}

/**
 * The infra registry. `url` is what the browser opens; `probe` is what gets
 * pinged (some roots redirect or 404 by design, so the probe path can differ).
 * `web: false` means there is no browser UI at all.
 */
export const INFRA = [
  {
    key: "grafana", name: "Grafana", web: true,
    url: u("VITE_INFRA_GRAFANA"),
    uk: "Дашборди й панелі метрик", en: "Dashboards and metric panels",
    noteUk: "Читає Prometheus і Loki. Тут же зручно дивитися логи — власного UI в Loki немає.",
    noteEn: "Reads Prometheus and Loki. Also the practical way to read logs — Loki has no UI of its own.",
    credsUk: "Логін за замовчуванням admin / admin.", credsEn: "Default login admin / admin.",
  },
  {
    key: "prometheus", name: "Prometheus", web: true,
    url: u("VITE_INFRA_PROMETHEUS"),
    probe: "/-/ready",
    uk: "Метрики та PromQL", en: "Metrics and PromQL",
    noteUk: "Джерело рядів латентності, частоти помилок і глибини черг, яких бракує вкладці «Помилки».",
    noteEn: "The source of the latency, error-rate and queue-depth series the Errors tab is missing.",
  },
  {
    key: "jaeger", name: "Jaeger", web: true,
    url: u("VITE_INFRA_JAEGER"),
    uk: "Розподілені трейси", en: "Distributed traces",
    noteUk: "Проходження одного запиту крізь усі сервіси — найкращий інструмент, коли щось повільне, але не зламане.",
    noteEn: "One request's path across every service — the best tool when something is slow but not broken.",
  },
  {
    key: "loki", name: "Loki", web: false,
    url: u("VITE_INFRA_LOKI"),
    probe: "/ready",
    uk: "Агрегація логів (лише API)", en: "Log aggregation (API only)",
    noteUk: "Власного інтерфейсу не має — запитуйте через Grafana.",
    noteEn: "Has no UI of its own — query it through Grafana.",
  },
  {
    key: "minio", name: "MinIO", web: true,
    url: u("VITE_INFRA_MINIO"),
    uk: "Об'єктне сховище (консоль)", en: "Object storage (console)",
    noteUk: "Тут лежать завантажені аудіофайли — зашифровані конвертом, тож у консолі вони нечитабельні. Так і має бути.",
    noteEn: "Where uploaded audio lives — envelope-encrypted, so the console shows it as unreadable. That is correct.",
    credsUk: "Логін за замовчуванням minioadmin / minioadmin.", credsEn: "Default login minioadmin / minioadmin.",
  },
  {
    key: "mailpit", name: "Mailpit", web: true,
    url: u("VITE_INFRA_MAILPIT"),
    uk: "Перехоплювач пошти (dev)", en: "Email catcher (dev)",
    noteUk: "Кожен лист, який стек «надсилає» — запрошення, сповіщення — зупиняється тут і нікуди не йде.",
    noteEn: "Every mail the stack 'sends' — invitations, notifications — stops here and goes nowhere.",
  },
  {
    key: "keycloak", name: "Keycloak", web: true,
    url: u("VITE_INFRA_KEYCLOAK"),
    probe: "/realms/master/.well-known/openid-configuration",
    probeBase: u("VITE_INFRA_KEYCLOAK_BASE"),
    uk: "Провайдер ідентичності", en: "Identity provider",
    noteUk: "Користувачі, ролі й паролі. Акаунти консолі створюються саме тут.",
    noteEn: "Users, roles and passwords. Console accounts are created here.",
    credsUk: "Логін за замовчуванням admin / admin.", credsEn: "Default login admin / admin.",
  },
  {
    key: "otel", name: "OTel Collector", web: false,
    url: u("VITE_INFRA_OTEL"),
    uk: "Збирач телеметрії", en: "Telemetry collector",
    noteUk: "Приймає трейси й метрики від сервісів і роздає їх Prometheus та Jaeger.",
    noteEn: "Receives traces and metrics from the services and fans them out to Prometheus and Jaeger.",
  },
  {
    key: "edge", name: "public-edge", web: false,
    url: u("VITE_INFRA_EDGE"),
    uk: "Публічний проксі (список дозволених)", en: "Public reverse proxy (allowlist)",
    noteUk: "Єдина поверхня, відкрита в інтернет: рівно два шляхи — колбек Дії та публічна перевірка підпису. 404 на корені — це задум, а не поломка.",
    noteEn: "The only internet-facing surface: exactly two paths — the Дія callback and public signature verification. A 404 at the root is the design, not a fault.",
    selfSigned: true,
  },
];

// Not HTTP. Listed so "where is the database" has an answer here.
export const INFRA_NON_HTTP = [
  { key: "postgres", name: "PostgreSQL", dsn: "postgresql://postgres@localhost:5432/medical_dictation",
    uk: "Основна база (RLS на кожній таблиці)", en: "Primary database (RLS on every table)" },
  { key: "redis", name: "Redis", dsn: "redis://localhost:6379",
    uk: "Кеш, черги, обмеження частоти", en: "Cache, queues, rate limiting" },
  { key: "kafka", name: "Kafka", dsn: "localhost:9092",
    uk: "Шина подій між сервісами", en: "Inter-service event bus" },
];

/**
 * Probe one entry. Resolves to "answered" | "no-answer" | "unverifiable" —
 * never throws.
 *
 * `no-cors` is the whole trick: the response is opaque, but a resolved promise
 * still proves something is listening. Do not "improve" this to a normal fetch;
 * it would report every healthy service as down.
 *
 * `selfSigned` entries get a third state rather than a red cross. The browser
 * rejects an untrusted certificate before any response is visible, so a failed
 * probe there means "could not check" — NOT "not running". public-edge is
 * genuinely up and serving; reporting it down because its dev certificate is
 * self-signed would send someone to debug a container that is working fine.
 */
export async function probeInfra(entry) {
  const base = entry.probeBase || entry.url;
  const target = entry.probe ? `${stripPath(base)}${entry.probe}` : base;
  const t0 = Date.now();
  try {
    await fetch(target, { mode: "no-cors", cache: "no-store" });
    return { state: "answered", ms: Date.now() - t0 };
  } catch (e) {
    const detail = String(e?.message || e);
    if (entry.selfSigned) return { state: "unverifiable", ms: Date.now() - t0, detail };
    return { state: "no-answer", ms: Date.now() - t0, detail };
  }
}

function stripPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

/** Probe everything in parallel → { [key]: {state, ms} }. Never throws. */
export async function probeAllInfra(list = INFRA) {
  const entries = await Promise.all(
    list.map(async (e) => [e.key, { ...(await probeInfra(e)), entry: e }]),
  );
  return Object.fromEntries(entries);
}
