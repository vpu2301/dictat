// VersionInfoModal.jsx — the audit record of ONE report version: who wrote it,
// when, why (for amendments), what it said, and the identifiers that tie it to
// the signature. Opened from any line that shows "version · author · time" —
// the diff column headers, the diff attribution strip, and the version lists.
//
// Export options and why they differ:
//   Print  — client-side; works for EVERY version (the print stylesheet hides
//            the app and lays this modal out as a document).
//   JSON   — the exact ReportVersionDetail payload, for audit/hand-off.
//   PDF    — the server-rendered, letterheaded document. Offered only for the
//            report's CURRENT version: GET /v1/reports/{id}/pdf always renders
//            `report.current_version_id` and takes no version parameter, so
//            offering it on a historical version would silently export the
//            wrong text.
import React, { useMemo, useState } from "react";
import { Modal, Icon } from "./UI.jsx";
import { Loading } from "./DataStates.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import { getReportVersion, downloadReportPdf } from "../api/reports.js";
import { useMemberNames } from "../api/memberNames.js";

const tr = (lang, uk, en) => (lang === "uk" ? uk : en);

function fullStamp(iso, lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "uk" ? "uk-UA" : "en-US", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const AMENDMENT_LABEL = {
  correction:    { uk: "Виправлення",  en: "Correction" },
  addition:      { uk: "Доповнення",   en: "Addition" },
  clarification: { uk: "Уточнення",    en: "Clarification" },
};

function Row({ label, children, mono }) {
  if (children == null || children === "") return null;
  return (
    <div className="vi-row">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{children}</dd>
    </div>
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function VersionInfoModal({ report, versionNumber, lang, onClose, sectionLabels }) {
  const reportId = report?.id || report?.report_id;
  const req = useAsync(() => getReportVersion(reportId, versionNumber), [reportId, versionNumber]);
  const { nameFor, memberFor } = useMemberNames();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState(null);

  const labelMap = useMemo(() => Object.fromEntries(
    (sectionLabels || []).filter(l => l?.section_key).map(l => [l.section_key, l.name || {}]),
  ), [sectionLabels]);
  const sectionTitle = (key) => {
    const n = labelMap[key];
    const v = n && (typeof n === "object" ? (n[lang] ?? n.en) : n);
    return v || String(key).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const v = req.data;
  const isCurrent = !!v && report?.current_version_number === v.version_number;
  const sections = v?.content?.sections || [];
  const words = sections.reduce(
    (n, s) => n + String(s.text || "").split(/\s+/).filter(Boolean).length, 0);
  const author = v ? memberFor(v.created_by) : null;

  const doPdf = async () => {
    setPdfBusy(true); setPdfErr(null);
    try {
      await downloadReportPdf(reportId, {
        variant: report?.status === "signed" || report?.status === "amended" ? "clean" : "draft",
        lang,
      });
    } catch (e) {
      setPdfErr((e && e.message) || tr(lang, "Не вдалося завантажити PDF", "Could not download the PDF"));
    } finally {
      setPdfBusy(false);
    }
  };

  const doJson = () => download(
    `report-${report?.code || reportId}-v${versionNumber}.json`,
    JSON.stringify(v, null, 2),
    "application/json",
  );

  return (
    <Modal onClose={onClose} className="version-info-modal">
      <div className="vi-head">
        <div>
          <h2>
            {tr(lang, "Версія", "Version")} v{versionNumber}
            {v?.is_amendment && (
              <span className="vi-chip">
                {tr(lang,
                  AMENDMENT_LABEL[v.amendment_type]?.uk || "Правка",
                  AMENDMENT_LABEL[v.amendment_type]?.en || "Amendment")}
              </span>
            )}
            {isCurrent && <span className="vi-chip current">{tr(lang, "Поточна", "Current")}</span>}
          </h2>
          <p className="muted">{[report?.code, report?.title].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="btn ghost sm no-print" onClick={onClose}
          aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="vi-body">
        {req.loading ? <Loading lang={lang} />
          : req.error ? <ApiErrorView error={req.error} lang={lang} />
          : (
          <>
            <dl className="vi-grid">
              <Row label={tr(lang, "Автор версії", "Version author")}>
                {nameFor(v.created_by)}
                {author?.role && <span className="vi-sub"> · {author.role}</span>}
              </Row>
              <Row label={tr(lang, "Створено", "Created")}>{fullStamp(v.created_at, lang)}</Row>
              <Row label={tr(lang, "Тип", "Type")}>
                {v.is_amendment
                  ? tr(lang,
                      AMENDMENT_LABEL[v.amendment_type]?.uk || "Правка",
                      AMENDMENT_LABEL[v.amendment_type]?.en || "Amendment")
                  : tr(lang, "Редакція звіту", "Report revision")}
              </Row>
              {v.is_amendment && (
                <Row label={tr(lang, "Причина правки", "Reason")}>{v.amendment_reason || "—"}</Row>
              )}
              {v.signed_at && (
                <>
                  <Row label={tr(lang, "Підписав(ла)", "Signed by")}>{nameFor(v.signed_by)}</Row>
                  <Row label={tr(lang, "Підписано", "Signed at")}>{fullStamp(v.signed_at, lang)}</Row>
                </>
              )}
              <Row label={tr(lang, "Слів", "Words")}>{String(words)}</Row>
              <Row label={tr(lang, "Ідентифікатор версії", "Version ID")} mono>{v.id}</Row>
              <Row label={tr(lang, "Попередня версія", "Parent version")} mono>
                {v.parent_version_id || "—"}
              </Row>
            </dl>

            <h3 className="vi-sub-h">{tr(lang, "Зміст версії", "Version content")}</h3>
            {sections.length === 0 ? (
              <div className="psub">{tr(lang, "— порожня версія —", "— empty version —")}</div>
            ) : (
              <div className="vi-sections">
                {sections.map(s => (
                  <div key={s.section_key} className="vi-section">
                    <div className="vi-section-h">{sectionTitle(s.section_key)}</div>
                    <div className="vi-section-b">
                      {s.text || <span className="muted">— {tr(lang, "порожньо", "empty")} —</span>}
                    </div>
                    {Array.isArray(s.icd10) && s.icd10.length > 0 && (
                      <div className="vi-icd">
                        {s.icd10.map(c => (
                          <span key={typeof c === "string" ? c : c.code} className="chip">
                            {typeof c === "string" ? c : c.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="vi-foot no-print">
        {pdfErr && <div className="form-error vi-err">{pdfErr}</div>}
        <div className="spacer" />
        <button type="button" className="btn ghost sm" onClick={() => window.print()} disabled={!v}>
          <Icon name="print" size={13} /> {tr(lang, "Друк", "Print")}
        </button>
        <button type="button" className="btn ghost sm" onClick={doJson} disabled={!v}>
          <Icon name="download" size={13} /> JSON
        </button>
        {isCurrent && report?.status !== "cancelled" && (
          <button type="button" className="btn accent sm" onClick={doPdf} disabled={pdfBusy}>
            <Icon name="fileText" size={13} />
            {pdfBusy ? tr(lang, "Готуємо…", "Preparing…") : tr(lang, "PDF", "PDF")}
          </button>
        )}
      </div>
      {v && !isCurrent && (
        <p className="vi-note no-print">
          {tr(lang,
            "Офіційний PDF сервер формує лише для поточної версії. Для цієї версії скористайтесь друком або JSON.",
            "The server renders the official PDF for the current version only. Use Print or JSON for this one.")}
        </p>
      )}
    </Modal>
  );
}
