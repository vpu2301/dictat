// TechnicalTab.jsx — what Klarnote has actually built, as a platform.
//
// Every claim on this page was read out of medical-dictation-backend rather
// than remembered, and each row names the file that backs it so it can be
// re-checked rather than trusted. Service readiness is probed live; the
// inventory itself is static because it describes code, not state.
//
// Deliberately includes what is NOT done (MFA off, no plaintext ASR result
// proxy) in the same tables as what is. A capability list that only lists wins
// is a brochure.
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { fetchPlatformHealth, SERVICE_ROLE } from "../../api/company.js";

// ── Services: what each owns, and what it is backed by ───────────────────
const SERVICES_BUILT = [
  { key: "auth",         port: 8000, uk: "Вхід, ролі, тенанти, аудит",   en: "Identity, roles, tenants, audit",
    src: "services/auth-service" },
  { key: "asr",          port: 8001, uk: "Пакетна транскрипція",          en: "Batch transcription",
    src: "services/asr-service + asr-worker" },
  { key: "dictation",    port: 8002, uk: "Живе диктування (WebSocket)",   en: "Live dictation (WebSocket)",
    src: "services/dictation-service" },
  { key: "core",         port: 8003, uk: "Пацієнти, прийоми, згоди, приватність", en: "Patients, encounters, consents, privacy",
    src: "services/core-service" },
  { key: "notification", port: 8004, uk: "Сповіщення (стрічка + WS)",     en: "Notifications (feed + WS)",
    src: "services/notification-service" },
  { key: "nlp",          port: 8005, uk: "Постобробка тексту",            en: "Text post-processing",
    src: "services/nlp-service" },
  { key: "report",       port: 8006, uk: "Звіти, версії, шаблони, МКХ-10", en: "Reports, versions, templates, ICD-10",
    src: "services/report-service" },
  { key: "autocomplete", port: 8007, uk: "Клінічний автодоповнювач",      en: "Clinical autocomplete",
    src: "services/autocomplete-service" },
  { key: "signing",      port: 8008, uk: "КЕП / Дія.Підпис + перевірка",  en: "Qualified signing + verify",
    src: "services/signing-service" },
];

// ── Security & compliance posture ────────────────────────────────────────
// status: "built" | "partial" | "off"
const POSTURE = [
  { status: "built",
    uk: "Ізоляція тенантів через RLS", en: "Tenant isolation via RLS",
    detailUk: "Кожне читання йде через tenant_connection. Роль app_role НЕ обходить RLS — це стверджує інтеграційний тест.",
    detailEn: "Every read goes through tenant_connection. app_role does NOT bypass RLS — asserted by an integration test.",
    src: "libs/db + tests/integration/test_rls_isolation.py" },
  { status: "built",
    uk: "Незмінний журнал аудиту", en: "Immutable audit trail",
    detailUk: "Події зв'язані хешем; GET /audit/verify повторно проходить ланцюг і виявляє розрив.",
    detailEn: "Hash-chained events; GET /audit/verify re-walks the chain and detects a break.",
    src: "libs/audit + routers/audit.py" },
  { status: "built",
    uk: "Шифрування на рівні записів", en: "Envelope encryption at rest",
    detailUk: "AAD прив'язує шифротекст до tenant_id, тож підміна блоба між тенантами падає на рівні GCM.",
    detailEn: "AAD binds ciphertext to the tenant_id, so a cross-tenant blob swap fails at the GCM layer.",
    src: "libs/crypto/envelope.py" },
  { status: "built",
    uk: "Розділення адміністратора та PHI (S14)", en: "Admin ⟂ PHI split (S14)",
    detailUk: "tenant_admin не має клінічних дозволів; доступ до звіту — лише через запит break-glass із журналюванням.",
    detailEn: "tenant_admin holds no clinical permission; reaching a report needs an audited break-glass request.",
    src: "libs/auth/perms.py + routers/phi_access.py" },
  { status: "built",
    uk: "Право на видалення з правилом двох осіб", en: "Erasure with a two-person rule",
    detailUk: "Запит на видалення затверджує інша особа; DSAR-експорт побудований.",
    detailEn: "An erasure request is approved by a second person; DSAR export is built.",
    src: "core-service/erasure/{engine,dsar}.py" },
  { status: "built",
    uk: "Кваліфікований електронний підпис", en: "Qualified e-signature",
    detailUk: "Дія.Підпис / локальний КЕП, підписані конверти та публічна перевірка.",
    detailEn: "Дія.Підпис / local KEP, signed envelopes, and public verification.",
    src: "services/signing-service" },
  { status: "off",
    uk: "MFA — реалізовано, але вимкнено", en: "MFA — implemented but disabled",
    detailUk: "requires_mfa() є на чутливих ендпоінтах, але MDX_REQUIRE_MFA=false у пілоті, тож це no-op. Немає TOTP-реєстрації.",
    detailEn: "requires_mfa() guards sensitive endpoints, but MDX_REQUIRE_MFA=false in the pilot, so it is a no-op. No TOTP enrolment exists.",
    src: "auth-service/deps.py:requires_mfa + config.py" },
  { status: "partial",
    uk: "Результат ASR недосяжний із браузера", en: "ASR result unreachable from the browser",
    detailUk: "/asr/jobs/{id}/result віддає підписаний URL на зашифрований блоб — браузер не може його розшифрувати.",
    detailEn: "/asr/jobs/{id}/result returns a presigned URL to an encrypted blob the browser cannot decrypt.",
    src: "asr-service/routers/jobs.py" },
];

// ── The SPA's own surface ────────────────────────────────────────────────
const FRONTEND_BUILT = [
  { uk: "Студія диктування", en: "Dictation Studio",
    noteUk: "Живий ASR через WebSocket, секційні шаблони, голосові команди, вибір мікрофона.",
    noteEn: "Live ASR over WebSocket, section-aware templates, voice commands, mic selection." },
  { uk: "Типізовані поля (S13)", en: "Typed fields (S13)",
    noteUk: "5 рендерерів (choice, multi, numeric, date, diagnosis), граматика пропозицій, шлюз фіналізації.",
    noteEn: "5 renderers (choice, multi, numeric, date, diagnosis), proposal grammar, finalize gating." },
  { uk: "Звіти", en: "Reports",
    noteUk: "Версії, порівняння, поправки, PDF, повнотекстовий пошук, підписання.",
    noteEn: "Versions, diff, amendments, PDF, full-text search, signing." },
  { uk: "Пацієнти та приватність", en: "Patients & privacy",
    noteUk: "Реєстр, картка, прийоми, шлюз згоди, DSAR і черга видалення.",
    noteEn: "Roster, record, encounters, consent gate, DSAR and the erasure queue." },
  { uk: "Клінічний скрайб", en: "Clinical scribe",
    noteUk: "Черга на день, консультації, нотатки, структури нотаток, автозбереження." ,
    noteEn: "Day queue, consults, notes, note structures, autosave." },
  { uk: "Сповіщення", en: "Notifications",
    noteUk: "Стрічка, WebSocket-пуш, налаштування, глибокі посилання.",
    noteEn: "Feed, WebSocket push, preferences, deep links." },
  { uk: "Маркетинговий сайт", en: "Marketing site",
    noteUk: "Лендинг, ціни, спеціальності, блог, документація, 10 мов.",
    noteEn: "Landing, pricing, specialties, blog, docs, 10 languages." },
  { uk: "Консоль власника", en: "Owner console",
    noteUk: "Ця консоль: окремий вхід для персоналу, портфель тенантів, використання, телеметрія.",
    noteEn: "This console: separate staff door, tenant portfolio, usage, telemetry." },
];

export function TechnicalTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";
  const healthReq = useAsync(() => fetchPlatformHealth(), []);

  const byKey = Object.fromEntries((healthReq.data?.services || []).map((s) => [s.key, s]));
  const builtCount = POSTURE.filter((p) => p.status === "built").length;

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Кожен рядок нижче звірено з вихідним кодом бекенду й підписано файлом, який його підтверджує — щоб це можна було перевірити, а не просто повірити.",
             "Every row below was read out of the backend source and is annotated with the file that backs it — so it can be re-checked rather than trusted.")}
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Сервіси", "Services")} icon="layers" accent
                  value={SERVICES_BUILT.length}
                  sublabel={healthReq.data ? `${healthReq.data.ready} ${T("готові зараз", "ready right now")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /readyz × 9" />
        </StatCard>
        <StatCard label={T("Контроль безпеки", "Security controls")} icon="shield"
                  value={`${builtCount}/${POSTURE.length}`}
                  sublabel={T("побудовано / усього відстежується", "built / tracked")}>
          <Provenance source="derived" lang={lang}
                      note={T("Підрахунок за таблицею нижче, звіреною з кодом.",
                              "Counted from the table below, itself verified against source.")} />
        </StatCard>
        <StatCard label={T("Поверхні SPA", "SPA surfaces")} icon="grid" value={FRONTEND_BUILT.length}
                  sublabel={T("великих функціональних блоків", "major feature areas")}>
          <Provenance source="derived" lang={lang} note={T("Перелік модулів SPA.", "Inventory of SPA modules.")} />
        </StatCard>
        <StatCard label={T("Мови інтерфейсу", "UI languages")} icon="globe" value={10}
                  sublabel="uk · en · pl · de · ro · cs · sr · hu · es · pt">
          <Provenance source="derived" lang={lang} note="src/i18n.js LANGS registry" />
        </StatCard>
      </div>

      {/* ── Services ─────────────────────────────────────────────────── */}
      <Panel title={T("Сервіси", "Services")} icon="layers"
             sub={healthReq.data ? `${healthReq.data.ready}/${healthReq.data.total} ${T("готові", "ready")}` : undefined}>
        {healthReq.error ? (
          <PanelState error={healthReq.error} onRetry={healthReq.reload} lang={lang} />
        ) : (
          <div className="co-tablewrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>{T("Сервіс", "Service")}</th>
                  <th>{T("Порт", "Port")}</th>
                  <th>{T("Відповідає за", "Owns")}</th>
                  <th>{T("Стан", "State")}</th>
                  <th>{T("Код", "Source")}</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES_BUILT.map((s) => {
                  const h = byKey[s.key];
                  return (
                    <tr key={s.key}>
                      <td className="co-cell-title">{s.key}</td>
                      <td className="co-cell-sub">{s.port}</td>
                      <td>{isUk ? s.uk : s.en}</td>
                      {/* RTT sits beside the badge, not inside it: .status-badge
                          capitalizes its label, which would render "239 Ms". */}
                      <td className="co-statecell">
                        {healthReq.loading ? <span className="co-na">…</span>
                          : !h ? <span className="co-na">—</span>
                          : (
                            <>
                              <StatusBadge tone={h.state === "ready" ? "ok" : h.state === "notready" ? "warn" : "danger"}
                                           label={h.state === "ready" ? T("готовий", "ready")
                                             : h.state === "notready" ? T("запуск", "starting")
                                             : T("недоступний", "down")} />
                              {h.state === "ready" && <span className="co-rtt">{h.ms} ms</span>}
                            </>
                          )}
                      </td>
                      <td className="co-cell-sub"><code>{s.src}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Security posture ─────────────────────────────────────────── */}
      <Panel title={T("Безпека та відповідність", "Security & compliance posture")} icon="shield"
             gapNote={T("Включно з тим, що НЕ зроблено — перелік лише перемог був би рекламою.",
                        "Includes what is NOT done — a list of only wins would be a brochure.")}>
        <ul className="co-posture">
          {POSTURE.map((p) => (
            <li key={p.en} className={"s-" + p.status}>
              <span className="co-posture-icon">
                <Icon name={p.status === "built" ? "check" : p.status === "partial" ? "alert" : "x"} size={13} />
              </span>
              <div>
                <strong>
                  {isUk ? p.uk : p.en}
                  <span className={"co-posture-tag t-" + p.status}>
                    {p.status === "built" ? T("побудовано", "built")
                      : p.status === "partial" ? T("частково", "partial")
                      : T("вимкнено", "disabled")}
                  </span>
                </strong>
                <p>{isUk ? p.detailUk : p.detailEn}</p>
                <code>{p.src}</code>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── Frontend surface ─────────────────────────────────────────── */}
      <Panel title={T("Поверхня застосунку", "Application surface")} icon="grid">
        <div className="co-featgrid">
          {FRONTEND_BUILT.map((f) => (
            <div className="co-feat" key={f.en}>
              <strong>{isUk ? f.uk : f.en}</strong>
              <p>{isUk ? f.noteUk : f.noteEn}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── The constraint that shapes everything ────────────────────── */}
      <Panel title={T("Архітектурне обмеження", "The architectural constraint")} icon="alert">
        <p className="co-prose">
          {T("Платформа однотенантна на рівні токена. Кожне читання даних обмежене RLS до tid у JWT, виданому Keycloak, і жоден пул з'єднань не обходить RLS. Три ендпоінти — GET /tenants, /tenants/{id} і /tenants/{id}/members — є винятком: auth-service обслуговує їх поза RLS-пулом після явної перевірки членства, і саме тому портфель у цій консолі крос-тенантний.",
             "The platform is single-tenant at the token level. Every data read is RLS-scoped to the tid in the Keycloak-issued JWT, and no connection pool bypasses RLS. Three endpoints — GET /tenants, /tenants/{id} and /tenants/{id}/members — are the exception: auth-service serves them off the non-RLS pool after an explicit membership check, which is exactly why this console's portfolio is cross-tenant.")}
        </p>
        <p className="co-prose">
          {T("Наслідок: записи в тенант обмежені активним тенантом (_require_active_tenant), а портфельні цифри використання неможливі без повторної автентифікації. Що це розблокує — на вкладці «Дорожня карта».",
             "The consequence: tenant writes are limited to the active tenant (_require_active_tenant), and portfolio-wide usage figures are impossible without re-authentication. What would unblock this is on the Roadmap tab.")}
        </p>
      </Panel>
    </div>
  );
}
