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
import { ViolationNotice } from "../reports/finalizeViolations.js";
import { DiagnosisBody } from "../reports/renderers/DiagnosisBody.js";
import { tr } from "../i18n.js";

const T = (lang, uk, en) => tr(lang, uk, en);

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
    return new Date().toLocaleDateString(tr(lang, "uk-UA", "en-US"), {
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

// Finalize violation copy + rendering + routing moved to
// src/reports/finalizeViolations.js (Sprint 13 step 06): keyed on the
// backend's `code` (choice_not_selected / numeric_not_filled /
// date_not_filled / diagnosis_not_confirmed / missing_icd10) with the
// sprint-08 `reason` values as the unchanged fallback. The backend
// validator stays the ONLY source of block reasons.

// ── On-screen preview modal ───────────────────────────────────────────────────
export function ReportPreview({
  open, lang = "en", template, body = {}, patient, author,
  reportId, sectionLabels, onClose, onSign, onApplySynthesis, onFinalize,
  // Sprint 13 step 06: typed-field state (for the soft hint only — never a
  // gate) + the jump-to-violation router supplied by Studio.
  // 2026-07-24: onSectionMetaChange added — the ICD-10 picker moved OUT of
  // the dictation Studio into THIS review stage (product decision:
  // dictation stays free of coding chrome), so the preview needs the write
  // path for confirmed codes.
  sectionMeta = {}, onJumpToViolation, onSectionMetaChange,
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
  // Violations the backend addressed to no on-screen section (absent or
  // unknown section_key) still render — report-level, above the sections.
  const unmatchedProblems = (problems || []).filter(
    (p) => !sections.some((s) => s.id === p.section_key));
  // Soft pre-check HINT only (§4.2): prose-empty required sections, minus
  // any section that carries typed metadata or confirmed codes (a confirmed
  // choice with no prose is NOT empty — only the server truly knows).
  // Never gates the finalize button; the 422 round-trip is the authority.
  const missingRequired = sections.filter((s) =>
    s.required && !(body[s.id] || "").trim() &&
    !(sectionMeta[s.id] && (sectionMeta[s.id].icd10?.length ||
      Object.keys(sectionMeta[s.id].field_specific_metadata || {}).length)));
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

  // Shared gate for finalize AND sign (2026-07-24): signing finalizes first,
  // so both actions can surface the same 422 violations / 409 conflict here
  // instead of letting a doomed signing modal open.
  const runGated = async (fn) => {
    if (!fn) return;
    setFinalizing(true); setProblems(null); setFinalErr(null);
    try {
      await fn();
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
  const handleFinalize = () => runGated(onFinalize);
  const handleSign = () => runGated(onSign);

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
                {T(lang,
                  "Попередня перевірка — можливо, не заповнені обов'язкові розділи:",
                  "Pre-check hint — required sections that may still be empty:")}{" "}
                {missingRequired.map((s) => labelFor(s, lang, labelMap)).join(", ")}
              </div>
            )}

            <ViolationNotice problems={unmatchedProblems} lang={lang} />

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

                  {/* Sprint 13 (moved here 2026-07-24): diagnosis CODING lives
                      at this review stage, not in the dictation editor — the
                      full picker (confirmed chips, extractor proposals, search)
                      mounts per diagnosis section, exactly where finalize
                      demands the codes. Prose above stays untouched by it. */}
                  {s.field_type === "structured_diagnosis" && onSectionMetaChange && (
                    <div className="rp-icd-picker">
                      {(sectionMeta[s.id]?.icd10?.length || 0) === 0 && s.required && (
                        <div className="rp-icd-hint">
                          <Icon name="flag" size={11} />
                          {T(lang,
                            "Додайте код МКХ-10 перед завершенням:",
                            "Add an ICD-10 code before finalizing:")}
                        </div>
                      )}
                      <DiagnosisBody
                        section={s}
                        fieldMeta={sectionMeta[s.id]?.field_specific_metadata || null}
                        icd10={sectionMeta[s.id]?.icd10 || []}
                        onChange={(patch) => onSectionMetaChange(s.id, patch)}
                        lang={lang}
                      />
                    </div>
                  )}

                  <ViolationNotice
                    problems={secProblems}
                    sectionKey={s.id}
                    lang={lang}
                    onJump={onJumpToViolation}
                    hideJumpCodes={["missing_icd10", "diagnosis_not_confirmed"]}
                  />
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
          <button className="btn primary" onClick={handleSign} disabled={finalizing}>
            <Icon name="sign" size={13} /> {T(lang, "Підписати звіт", "Sign report")}
          </button>
        </footer>
      </div>
    </div>
  );
}
