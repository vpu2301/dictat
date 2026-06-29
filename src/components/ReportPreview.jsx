// ReportPreview.jsx — the "written report" produced when dictation is completed.
//
// Renders the dictated body against the template's section structure as a clean
// document, clearly stamped as a DRAFT that is NOT yet signed. From here the
// clinician can:
//   • run AI synthesis (frontend guide §1) — turn raw dictation into clean prose
//     and accept/revert per section against an inline diff,
//   • download the server-rendered, watermarked draft PDF (guide §2),
//   • finalize the report with field-level validation (guide §4),
//   • or move on to signing.
//
// Synthesis is READ-ONLY on the backend: it proposes text; accepting writes it
// back via the draft autosave (the parent's onApplySynthesis). Low-confidence
// `[[ … ]]` spans are preserved through synthesis and stay flagged here.
import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "./UI.jsx";
import { synthesizeReport, downloadReportPdf } from "../api/reports.js";

const T = (lang, uk, en) => (lang === "uk" ? uk : en);

const nameOf = (s, lang) => s?.name?.[lang] || s?.name?.en || s?.id || "";

// Resolve a section title, preferring the backend's localized section_labels
// (guide §3), falling back to the template's own name, then the key.
function labelFor(section, lang, labelMap) {
  const fromBackend = labelMap?.[section.id];
  if (fromBackend) return fromBackend[lang] || fromBackend.en || section.id;
  return nameOf(section, lang);
}

function todayLabel(lang) {
  try {
    return new Date().toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Render text with `[[low-confidence]]` spans highlighted so the reviewer
// confirms them. Markers survive synthesis verbatim.
function LowConf({ text }) {
  const parts = String(text == null ? "" : text).split(/(\[\[[^\]]*\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[\[[^\]]*\]\]$/.test(p)
          ? <mark key={i} className="rp-lowconf" title="Low-confidence — please confirm">{p.slice(2, -2)}</mark>
          : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </>
  );
}

// Map a backend finalize `reason` to a localized message (guide §4).
function finalizeReason(reason, lang) {
  switch (reason) {
    case "required_empty":  return T(lang, "Обов'язковий розділ не заповнено", "Required section is empty");
    case "below_min_chars": return T(lang, "Замало тексту в розділі", "Section text is too short");
    case "missing_icd10":   return T(lang, "Відсутній код МКХ-10", "Missing ICD-10 code");
    default:                return reason || T(lang, "Помилка перевірки", "Validation error");
  }
}

// ── On-screen preview modal ───────────────────────────────────────────────────
export function ReportPreview({
  open, lang = "en", template, body = {}, patient, author,
  reportId, sectionLabels, onClose, onSign, onApplySynthesis, onFinalize,
}) {
  // Synthesis state.
  const [synthState, setSynthState] = useState("idle"); // idle | loading | ready | error
  const [synthErr, setSynthErr] = useState(null);
  const [proposed, setProposed] = useState({});         // section_key -> { original, text }
  const [accepted, setAccepted] = useState({});         // section_key -> true once applied
  // Finalize state.
  const [finalizing, setFinalizing] = useState(false);
  const [problems, setProblems] = useState(null);       // [{ section_key, reason, ... }] | null
  const [finalErr, setFinalErr] = useState(null);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setSynthState("idle"); setSynthErr(null); setProposed({}); setAccepted({});
    setFinalizing(false); setProblems(null); setFinalErr(null);
  }, [open]);

  const labelMap = React.useMemo(() => {
    const m = {};
    (sectionLabels || []).forEach((l) => { if (l?.section_key) m[l.section_key] = l.name || {}; });
    return m;
  }, [sectionLabels]);

  const runSynthesis = useCallback(async () => {
    if (!reportId) { setSynthState("error"); setSynthErr("no_report"); return; }
    setSynthState("loading"); setSynthErr(null);
    try {
      const r = await synthesizeReport(reportId, { language: lang });
      const map = {};
      (r?.sections || []).forEach((s) => { map[s.section_key] = { original: s.original, text: s.text }; });
      setProposed(map);
      setSynthState("ready");
    } catch (e) {
      setSynthErr((e && e.message) || "error");
      setSynthState("error");
    }
  }, [reportId, lang]);

  // "Complete dictation" → synthesize automatically once the preview opens on a
  // saved report (guide §1). Idempotent on the backend, so re-opening is cheap.
  useEffect(() => {
    if (open && reportId) runSynthesis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reportId]);

  if (!open || !template) return null;

  const sections = template.sections || [];
  const problemBySection = (problems || []).reduce((acc, p) => {
    (acc[p.section_key] = acc[p.section_key] || []).push(p);
    return acc;
  }, {});
  const missingRequired = sections.filter((s) => s.required && !(body[s.id] || "").trim());
  const title = template.name?.[lang] || template.name?.en || template.code;

  // Apply one section's synthesized prose back to the draft.
  const acceptSection = (key) => {
    const text = proposed[key]?.text;
    if (text == null) return;
    onApplySynthesis?.({ [key]: text });
    setAccepted((a) => ({ ...a, [key]: true }));
  };
  const acceptAll = () => {
    const updates = {};
    Object.entries(proposed).forEach(([k, v]) => {
      // Only sections that actually changed and aren't applied yet.
      if (v?.text != null && v.text !== (body[k] || "") && !accepted[k]) updates[k] = v.text;
    });
    if (Object.keys(updates).length) {
      onApplySynthesis?.(updates);
      setAccepted((a) => ({ ...a, ...Object.fromEntries(Object.keys(updates).map((k) => [k, true])) }));
    }
  };

  const handleDownload = async () => {
    try {
      await downloadReportPdf(reportId, { variant: "draft", lang });
    } catch (e) {
      setFinalErr({ kind: "pdf", message: (e && e.message) || "pdf_failed" });
    }
  };

  const handleFinalize = async () => {
    if (!onFinalize) return;
    setFinalizing(true); setProblems(null); setFinalErr(null);
    try {
      await onFinalize();
    } catch (e) {
      if (Array.isArray(e?.problems)) {
        setProblems(e.problems);
      } else if (e?.status === 409) {
        setFinalErr({ kind: "conflict", message: T(lang,
          "Звіт змінено в іншому місці — оновіть і повторіть.",
          "This report changed elsewhere — reload and retry.") });
      } else {
        setFinalErr({ kind: "finalize", message: (e && e.message) || "finalize_failed" });
      }
    } finally {
      setFinalizing(false);
    }
  };

  const changedCount = Object.entries(proposed)
    .filter(([k, v]) => v?.text != null && v.text !== (body[k] || "") && !accepted[k]).length;

  return (
    <div className="report-preview-overlay" onClick={onClose}>
      <div className="report-preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="report-preview-head">
          <div className="report-preview-head-l">
            <Icon name="fileText" size={16} />
            <h2>{T(lang, "Готовий звіт", "Written report")}</h2>
            <span className="chip rep-status-draft">{T(lang, "Чернетка", "Draft")}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={T(lang, "Закрити", "Close")}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="report-preview-body">
          <div className="report-preview-doc">
            <div className="rp-draft-ribbon">
              <Icon name="flag" size={13} />
              {T(lang, "Чернетка — документ ще не підписано", "Draft — this document is not signed yet")}
            </div>
            <h1 className="rp-title">{title}</h1>
            <div className="rp-meta">
              {template.code && <span>{template.code}</span>}
              {(patient?.ref || patient?.mrn) && <><span>·</span><span className="mono">{patient.ref || patient.mrn}</span></>}
              <span>·</span><span>{todayLabel(lang)}</span>
              {author && <><span>·</span><span>{author}</span></>}
            </div>

            {/* AI synthesis bar */}
            <div className="rp-synth-bar">
              <div className="rp-synth-l">
                <Icon name="sparkle" size={14} />
                <span>{T(lang, "Синтез AI", "AI synthesis")}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {T(lang, "перетворює диктування на чистий текст",
                          "turns dictation into clean prose")}
                </span>
              </div>
              {synthState === "ready" && changedCount > 0 && (
                <button className="btn ghost sm" onClick={acceptAll}>
                  <Icon name="check" size={12} /> {T(lang, `Прийняти всі (${changedCount})`, `Accept all (${changedCount})`)}
                </button>
              )}
              <button
                className="btn sm"
                onClick={runSynthesis}
                disabled={synthState === "loading" || !reportId}
              >
                <Icon name={synthState === "loading" ? "refresh" : "sparkle"} size={12} />
                {synthState === "loading"
                  ? T(lang, "Опрацювання…", "Synthesizing…")
                  : synthState === "ready"
                    ? T(lang, "Повторити", "Re-run")
                    : T(lang, "Згенерувати", "Generate")}
              </button>
            </div>

            {synthState === "error" && (
              <div className="rp-warn" role="alert">
                <Icon name="flag" size={13} />
                {synthErr === "no_report"
                  ? T(lang, "Спершу збережіть чернетку.", "Save the draft first.")
                  : T(lang, "Не вдалося згенерувати текст.", "Could not synthesize text.")}
              </div>
            )}

            {missingRequired.length > 0 && (
              <div className="rp-warn" role="alert">
                <Icon name="flag" size={13} />
                {T(lang, "Не заповнені обов'язкові розділи:", "Required sections still empty:")}{" "}
                {missingRequired.map((s) => labelFor(s, lang, labelMap)).join(", ")}
              </div>
            )}

            {sections.map((s) => {
              const text = (body[s.id] || "").trim();
              const prop = proposed[s.id];
              const isDiff = synthState === "ready" && prop?.text != null
                && prop.text !== (body[s.id] || "") && !accepted[s.id];
              const secProblems = problemBySection[s.id];
              return (
                <section key={s.id} className={"rp-sec" + (secProblems ? " has-problem" : "")}>
                  <h3>
                    {labelFor(s, lang, labelMap)}{s.required && <span className="rp-req">*</span>}
                    {accepted[s.id] && (
                      <span className="rp-applied"><Icon name="check" size={11} /> {T(lang, "AI", "AI")}</span>
                    )}
                  </h3>

                  {isDiff ? (
                    <div className="rp-diff">
                      <div className="rp-diff-col rp-diff-original">
                        <div className="rp-diff-tag">{T(lang, "Диктування", "Dictation")}</div>
                        <div className="rp-sec-body"><LowConf text={prop.original ?? text} /></div>
                      </div>
                      <div className="rp-diff-col rp-diff-synth">
                        <div className="rp-diff-tag">{T(lang, "Синтез AI", "AI synthesis")}</div>
                        <div className="rp-sec-body"><LowConf text={prop.text} /></div>
                        <div className="rp-diff-actions">
                          <button className="btn primary sm" onClick={() => acceptSection(s.id)}>
                            <Icon name="check" size={12} /> {T(lang, "Прийняти", "Accept")}
                          </button>
                          <button className="btn ghost sm" onClick={() => setAccepted((a) => ({ ...a, [s.id]: "kept" }))}>
                            {T(lang, "Лишити диктування", "Keep dictation")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : text
                    ? <div className="rp-sec-body"><LowConf text={text} /></div>
                    : <div className="rp-sec-empty">{T(lang, "— не заповнено —", "— not filled —")}</div>}

                  {secProblems && (
                    <div className="rp-sec-problem" role="alert">
                      {secProblems.map((p, i) => (
                        <div key={i}><Icon name="flag" size={11} /> {finalizeReason(p.reason, lang)}</div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <div className="rp-disclaimer">
              {T(lang,
                "Це чернетка медичного документа. Вона не має юридичної сили, доки не буде підписана електронним підписом (Дія.Підпис або КЕП).",
                "This is a draft medical document. It carries no legal force until signed electronically (Diia.Signature or a qualified key).")}
            </div>
          </div>
        </div>

        <footer className="report-preview-foot">
          <button className="btn" onClick={onClose}>
            <Icon name="arrowLeft" size={13} /> {T(lang, "Повернутись до редагування", "Back to editing")}
          </button>
          {finalErr && (
            <span className="rp-foot-err" role="alert">
              {finalErr.kind === "conflict" || finalErr.kind === "finalize"
                ? finalErr.message
                : T(lang, "Не вдалося завантажити PDF.", "Could not download the PDF.")}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={handleDownload} disabled={!reportId}>
            <Icon name="download" size={13} /> {T(lang, "Завантажити PDF (чернетка)", "Download PDF (draft)")}
          </button>
          {onFinalize && (
            <button className="btn" onClick={handleFinalize} disabled={finalizing || !reportId}>
              <Icon name={finalizing ? "refresh" : "check"} size={13} />
              {finalizing ? T(lang, "Завершення…", "Finalizing…") : T(lang, "Завершити", "Finalize")}
            </button>
          )}
          <button className="btn primary" onClick={onSign}>
            <Icon name="sign" size={13} /> {T(lang, "Підписати звіт", "Sign report")}
          </button>
        </footer>
      </div>
    </div>
  );
}
