// CompliancePage.jsx — /audit/compliance. An inventory of the evidence THIS
// PRODUCT can produce for an EU data-protection audit, and — just as
// deliberately — of what it cannot yet.
//
// This page is not a compliance assessment and must never read as one. GDPR
// compliance is a property of an organisation: its contracts, its DPIA, its
// processor agreements, its staff training. A screen in a clinical app can
// only tell an auditor which artefacts are obtainable here and where. Saying
// more than that would be the most damaging thing this page could do, so the
// header states the limit and every row is one of exactly two things:
//
//   live — reachable now, with the route that produces it.
//   soon — NOT reachable, with the specific reason it is not.
//
// The `soon` reasons are concrete on purpose ("the server grants privacy.* to
// tenant_admin only") rather than vague, because they are the backlog: each
// one names what has to change for the row to go live.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { tr } from "../i18n.js";

// state: "live" → `route` is required. "soon" → `blocker` is required.
const OBLIGATIONS = [
  {
    art: "Art. 5(2), 30",
    uk: "Підзвітність — журнал усіх дій із записами",
    en: "Accountability — a log of every action on a record",
    state: "live",
    route: "/audit/events",
    evidenceUk: "Журнал подій тенанта: хто, що, коли, з якою серйозністю.",
    evidenceEn: "The tenant's event log: who did what, when, at what severity.",
  },
  {
    art: "Art. 32(1)(b),(d)",
    uk: "Цілісність журналу та її регулярна перевірка",
    en: "Log integrity, and testing it regularly",
    state: "live",
    route: "/audit/verify",
    evidenceUk: "Перевірка геш-ланцюга: розрив або переписування показуються з номером події.",
    evidenceEn: "Hash-chain verification: a gap or a rewrite is reported with the diverging event number.",
  },
  {
    art: "Art. 32(1)(b), 32(4)",
    uk: "Доступ обмежено тими, кому він потрібен",
    en: "Access limited to those who need it",
    state: "live",
    route: "/audit/access",
    evidenceUk: "Огляд доступів: ролі, стан облікових записів і хто може дістатися даних пацієнтів.",
    evidenceEn: "Access review: roles, account status, and who can reach patient data.",
  },
  {
    art: "Art. 4(12), 33",
    uk: "Винятковий доступ до записів (break-glass)",
    en: "Exceptional access to records (break-glass)",
    state: "live",
    route: "/audit/phi-access",
    evidenceUk: "Хто відкривав запис без постійного права, підстава, строк і кількість переглядів.",
    evidenceEn: "Who opened a record without a standing right, on what grounds, for how long, and how often.",
  },
  {
    art: "Art. 15, 20",
    uk: "Право доступу та переносимість (DSAR)",
    en: "Right of access and portability (DSAR)",
    state: "soon",
    blockerUk: "Реалізовано для адміністратора клініки (/admin/privacy). Аудитор туди не має доступу: сервер надає privacy.* лише ролі tenant_admin.",
    blockerEn: "Built for the clinic admin (/admin/privacy). An auditor cannot reach it: the server grants privacy.* to tenant_admin only.",
  },
  {
    art: "Art. 17",
    uk: "Стирання даних і доказ його виконання",
    en: "Erasure, and evidence that it was carried out",
    state: "soon",
    blockerUk: "Звіт про виконання стирання існує в адмінській черзі приватності; окремого перегляду для аудитора немає.",
    blockerEn: "The erasure execution report exists in the admin privacy queue; there is no auditor-facing view of it.",
  },
  {
    art: "Art. 12(3)",
    uk: "Строки відповіді на запити суб'єктів (1 місяць)",
    en: "Deadlines for answering data-subject requests (one month)",
    state: "soon",
    blockerUk: "Ніде не рахується. Потрібен лічильник строку на запитах приватності та його показ аудитору.",
    blockerEn: "Not tracked anywhere. Needs an SLA clock on privacy requests plus an auditor-facing view of it.",
  },
  {
    art: "Art. 30",
    uk: "Реєстр операцій обробки (RoPA)",
    en: "Records of processing activities (RoPA)",
    state: "soon",
    blockerUk: "Немає в продукті: цілі, категорії даних, отримувачі та строки зберігання ніде не описані машинно.",
    blockerEn: "Not in the product: purposes, data categories, recipients and retention periods are nowhere described as data.",
  },
  {
    art: "Art. 5(1)(e)",
    uk: "Обмеження строку зберігання",
    en: "Storage limitation (retention schedule)",
    state: "soon",
    blockerUk: "Політики зберігання не задані в системі, тож і показати чи проконтролювати їх тут неможливо.",
    blockerEn: "Retention policies are not expressed in the system, so nothing here can show or check them.",
  },
  {
    art: "Art. 33, 34",
    uk: "Реєстр інцидентів і сповіщення протягом 72 годин",
    en: "Breach register and 72-hour notification",
    state: "soon",
    blockerUk: "Реєстру інцидентів немає. Події рівня «sec» у журналі — сировина для нього, але не заміна.",
    blockerEn: "There is no breach register. The log's `sec`-severity events are raw material for one, not a substitute.",
  },
  {
    art: "Art. 28, 44–49",
    uk: "Процесори, субпроцесори та передавання за межі ЄС",
    en: "Processors, sub-processors and transfers outside the EU",
    state: "soon",
    blockerUk: "Договірні артефакти — поза цим застосунком. Тут може з'явитися хіба перелік субпроцесорів.",
    blockerEn: "Contractual artefacts — outside this application. At most a sub-processor list could live here.",
  },
  {
    art: "Art. 7(1), 9(2)(h)",
    uk: "Записи згод пацієнтів",
    en: "Patient consent records",
    state: "soon",
    blockerUk: "Згоди зберігаються в картці пацієнта — клінічній поверхні, до якої аудитор доступу не має (patient.read виключає роль).",
    blockerEn: "Consents live in the patient record — a clinical surface the auditor has no access to (patient.read excludes the role).",
  },
];

export function CompliancePage({ lang = "en", navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const live = OBLIGATIONS.filter((o) => o.state === "live");
  const soon = OBLIGATIONS.filter((o) => o.state === "soon");

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{T("Докази для аудиту (ЄС)", "Audit evidence (EU)")}</h1>
          <p className="sub">
            {T("Що з вимог захисту даних цей продукт може підтвердити зараз — і чого ще не може. Це не висновок про відповідність: відповідність забезпечує організація (DPIA, договори з процесорами, навчання персоналу), а застосунок лише постачає докази.",
               "Which data-protection obligations this product can evidence today — and which it cannot yet. This is not a compliance assessment: compliance is achieved by the organisation (DPIA, processor agreements, staff training); the application only supplies evidence.")}
          </p>
        </div>
      </div>

      <div className="cmp-summary">
        <span className="cmp-count live">{live.length}</span>
        <span>{T("доступно тут", "available here")}</span>
        <span className="cmp-count soon">{soon.length}</span>
        <span>{T("ще ні — з причиною нижче", "not yet — reason given below")}</span>
      </div>

      <section className="card cmp-card">
        <table className="audit-table cmp-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>{T("Норма", "Article")}</th>
              <th>{T("Вимога", "Obligation")}</th>
              <th>{T("Доказ у продукті", "Evidence in the product")}</th>
              <th style={{ width: 150 }}></th>
            </tr>
          </thead>
          <tbody>
            {OBLIGATIONS.map((o) => (
              <tr key={o.art + o.en} className={o.state === "soon" ? "cmp-soon" : ""}>
                <td className="mono cmp-art">{o.art}</td>
                <td className="cmp-obl">{tr(lang, o.uk, o.en)}</td>
                <td className="cmp-eviq">
                  {o.state === "live"
                    ? tr(lang, o.evidenceUk, o.evidenceEn)
                    : <span className="cmp-blocker">{tr(lang, o.blockerUk, o.blockerEn)}</span>}
                </td>
                <td className="cmp-act">
                  {o.state === "live" ? (
                    <button type="button" className="btn ghost sm" onClick={() => navigate(o.route)}>
                      {T("Відкрити", "Open")} <Icon name="chevRight" size={12} />
                    </button>
                  ) : (
                    <span className="soon-pill">{T("незабаром", "soon")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="psub cmp-foot">
        {T("Кожен рядок «незабаром» називає конкретну перешкоду — це й є перелік того, що треба зробити, щоб доказ з'явився тут.",
           "Every “soon” row names its specific blocker — that list is exactly what has to be built for the evidence to appear here.")}
      </p>
    </div>
  );
}
