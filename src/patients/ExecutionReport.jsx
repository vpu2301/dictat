// ExecutionReport.jsx — sprint 11 step 06: the erasure execution report,
// rendered VERBATIM from the backend's report_of_execution:
//   { executed_at, engine_version, operator,
//     destroyed: [{kind, id, detail}], retained: [{kind, id, legal_basis}],
//     counts: {destroyed, retained, inventory_before} }
//
// No client-side editorializing: every destroyed row and every retained row
// the backend reported is rendered, completely — the honesty is the
// feature. Document-like layout; printable as-is for the patient
// (@media print rules in sprints-11-15.css).

import React from "react";
import { Icon } from "../components/UI.jsx";
import { legalBasisText } from "./legalBasis.js";

const KIND_LABEL = {
  recording:  { uk: "Аудіозаписи", en: "Recordings" },
  audio_file: { uk: "Аудіозаписи", en: "Recordings" },
  transcript: { uk: "Транскрипти", en: "Transcripts" },
  report:     { uk: "Звіти", en: "Reports" },
  report_draft: { uk: "Чернетки звітів", en: "Draft reports" },
  note:       { uk: "Клінічні нотатки", en: "Clinical notes" },
  patient:    { uk: "Ідентифікаційні дані картки", en: "Patient identity data" },
  anamnesis:  { uk: "Анамнез", en: "Anamnesis" },
  consent:    { uk: "Записи про згоди", en: "Consent records" },
  envelope:   { uk: "Конверти підписів", en: "Signature envelopes" },
  ipn:        { uk: "ІПН (криптографічно знищено)", en: "ІПН (crypto-shredded)" },
};
const kindLabel = (k, lang) => (KIND_LABEL[k] ? (KIND_LABEL[k][lang] || KIND_LABEL[k].en) : String(k));

function groupByKind(items) {
  const groups = new Map();
  for (const it of items || []) {
    const k = it?.kind ?? "—";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return [...groups.entries()];
}

export function ExecutionReport({ report, lang = "uk" }) {
  if (!report) return null;
  const destroyed = report.destroyed || [];
  const retained = report.retained || [];
  const counts = report.counts || {};

  return (
    <div className="exec-report" data-testid="execution-report">
      <div className="exec-report-head">
        <h3>{lang === "uk" ? "Звіт про виконання видалення" : "Erasure execution report"}</h3>
        <button type="button" className="btn sm exec-report-print" onClick={() => window.print()}>
          <Icon name="print" size={13} /> {lang === "uk" ? "Друк" : "Print"}
        </button>
      </div>

      <section className="exec-report-section">
        <h4>{lang === "uk" ? "Знищено" : "Destroyed"} <span className="exec-count">{counts.destroyed ?? destroyed.length}</span></h4>
        {destroyed.length === 0 && (
          <p className="exec-empty">{lang === "uk" ? "Нічого не було знищено." : "Nothing was destroyed."}</p>
        )}
        {groupByKind(destroyed).map(([kind, items]) => (
          <div key={kind} className="exec-group">
            <div className="exec-group-h">{kindLabel(kind, lang)} — {items.length}</div>
            <ul>
              {items.map((it, i) => (
                <li key={`${it.id}-${i}`} className="pmono">
                  {it.id}{it.detail ? <span className="exec-detail"> — {it.detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="exec-report-section retained">
        <h4>{lang === "uk" ? "Збережено згідно із законом" : "Retained as required by law"} <span className="exec-count">{counts.retained ?? retained.length}</span></h4>
        {retained.length === 0 && (
          <p className="exec-empty">{lang === "uk" ? "Нічого не збережено." : "Nothing was retained."}</p>
        )}
        {retained.map((it, i) => (
          <div key={`${it.id}-${i}`} className="exec-retained-row">
            <div className="exec-retained-what">
              {kindLabel(it.kind, lang)} <span className="pmono">{it.id}</span>
            </div>
            <div className="exec-retained-basis">{legalBasisText(it.legal_basis, lang)}</div>
          </div>
        ))}
      </section>

      <footer className="exec-report-foot">
        <span>{lang === "uk" ? "Виконано" : "Executed"}: {report.executed_at ? new Date(report.executed_at).toLocaleString(lang === "uk" ? "uk-UA" : "en-GB") : "—"}</span>
        <span>{lang === "uk" ? "Оператор" : "Operator"}: <span className="pmono">{report.operator || "—"}</span></span>
        <span>{lang === "uk" ? "Рушій" : "Engine"}: <span className="pmono">{report.engine_version || "—"}</span></span>
        {counts.inventory_before != null && (
          <span>{lang === "uk" ? "Обʼєктів до виконання" : "Objects before execution"}: {counts.inventory_before}</span>
        )}
      </footer>
    </div>
  );
}
