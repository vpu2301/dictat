// AssignTranscriptModal.jsx — assign a COMPLETE batch transcription job to a
// patient by creating a draft report from its transcript (sprint:
// dictation-assign). POSTs /v1/reports/from-transcript; the backend fetches
// the transcript itself and auto-matches a template when none is chosen.
//
// Reused by AsrJobDetailPage (primary button) and AsrJobsListPage
// (quick-assign). On success shows a result card (template + selection mode,
// warn styling for "fallback") with links to the report and the patient.
import React, { useEffect, useRef, useState } from "react";
import { Icon, Modal } from "./UI.jsx";
import { MenuSelect } from "./MenuSelect.jsx";
import { tr } from "../i18n.js";
import { listPatients } from "../api/patients.js";
import { listTemplates } from "../api/templates.js";
import { assignTranscript, classifyAssignError } from "../api/reports.js";

const today = () => new Date().toISOString().slice(0, 10);

// Map the pure classifier's descriptor to localized UI state.
function errorView(err, lang) {
  const c = classifyAssignError(err);
  if (c.kind === "already_assigned") {
    return { kind: "already_assigned", report_id: c.report_id, report_code: c.report_code };
  }
  if (c.kind === "not_complete") {
    return { kind: "msg", msg: tr(lang, "Завдання ще не завершене — дочекайтеся статусу «Готово».", "The job isn't complete yet — wait for it to finish.") };
  }
  if (c.kind === "field") {
    const msgs = {
      patient_not_found: tr(lang, "Пацієнта не знайдено — оберіть іншого.", "Patient not found — pick another."),
      template_not_found: tr(lang, "Шаблон не знайдено — оберіть інший.", "Template not found — pick another."),
      empty_transcript: tr(lang, "Транскрипція порожня — немає що призначати.", "The transcript is empty — nothing to assign."),
      no_templates: tr(lang, "У клініці немає жодного шаблону звіту.", "Your clinic has no report templates."),
    };
    return { kind: "msg", msg: msgs[c.code] || err.message };
  }
  if (c.kind === "erased") {
    return { kind: "msg", msg: tr(lang, "Транскрипцію вже видалено політикою зберігання.", "The transcript has been erased by the retention policy.") };
  }
  if (c.kind === "unavailable") {
    return { kind: "msg", msg: tr(lang, "Сервіс транскрипції недоступний — спробуйте ще раз.", "Transcription service unavailable — try again.") };
  }
  return { kind: "msg", msg: c.message || tr(lang, "Не вдалося призначити", "Could not assign") };
}

export function AssignTranscriptModal({ jobId, jobLanguage, lang, navigate, onClose, onAssigned }) {
  // ── patient picker ──
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState(null);
  const debounceRef = useRef(null);

  // ── template + meta ──
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");   // "" = auto-match
  const [title, setTitle] = useState("");
  const [encounterDate, setEncounterDate] = useState(today());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Patient search — debounced against core-service.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await listPatients({ query: query.trim() || undefined, limit: 20 });
        setPatients(r?.items || []);
      } catch {
        setPatients([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Templates — dev DB duplicates system templates on every seed run
  // (tenant_id IS NULL escapes the unique constraint), so dedupe by code.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await listTemplates({ limit: 200 });
        if (cancelled) return;
        const list = Array.isArray(r) ? r : (r?.items || []);
        const byCode = new Map();
        for (const t of list) {
          if (t.status === "deprecated") continue;
          if (jobLanguage && t.language && t.language !== jobLanguage) continue;
          if (!byCode.has(t.code)) byCode.set(t.code, t);
        }
        setTemplates([...byCode.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [jobLanguage]);

  const submit = async () => {
    if (!patient || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await assignTranscript({
        asr_job_id: jobId,
        patient_id: patient.id,
        template_id: templateId || undefined,
        title,
        encounter_date: encounterDate || undefined,
      });
      setResult(res);
      onAssigned?.(res);
    } catch (e) {
      const v = errorView(e, lang);
      setError(v);
      if (v.kind === "already_assigned") {
        onAssigned?.({ id: v.report_id, code: v.report_code, patient_id: null });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const go = (path) => { onClose(); navigate(path); };
  const patientName = (p) => p?.name?.uk || p?.name?.en || p?.name || "—";

  // ── success card ──
  if (result) {
    const fallback = result.template_selection === "fallback";
    return (
      <Modal onClose={onClose}>
        <div className="modal-h">
          <h2>{tr(lang, "Збережено як диктування", "Saved as a dictation")}</h2>
          <p>{result.code} · {tr(lang, "чернетка", "draft")}</p>
        </div>
        <div className="modal-body assign-done">
          <div className="assign-done-row">
            <span className="assign-done-k">{tr(lang, "Шаблон", "Template")}</span>
            <span>{result.template_name}</span>
          </div>
          {fallback && (
            <div className="asr-banner asr-banner-warn" role="status">
              <Icon name="help" size={13} />
              <span>{tr(lang, "Шаблон підібрано за замовчуванням — перевірте, чи він підходить.", "The default template was used — please check it fits.")}</span>
            </div>
          )}
          {result.template_selection === "auto" && (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {tr(lang, "Шаблон підібрано автоматично за змістом транскрипції.", "Template auto-matched from the transcript content.")}
            </p>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {tr(lang,
              "Текст транскрипції додано в перший вільний розділ — розподіліть його по розділах у редакторі.",
              "The transcript landed in the first free-text section — redistribute it across sections in the editor.")}
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>{tr(lang, "Закрити", "Close")}</button>
          {result.patient_id && (
            <button className="btn" onClick={() => go(`/patients/${result.patient_id}`)}>
              <Icon name="user" size={13} /> {tr(lang, "До пацієнта", "Patient page")}
            </button>
          )}
          <button className="btn accent" onClick={() => go(`/studio?mode=dictate&report=${result.id}`)}>
            <Icon name="fileText" size={13} /> {tr(lang, "Відкрити звіт", "Open report")}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} className="modal-xl">
      <div className="modal-h">
        <h2>{tr(lang, "Призначити пацієнту", "Assign to patient")}</h2>
        <p>{tr(lang, "Транскрипцію буде збережено як чернетку звіту в картці пацієнта.", "The transcript will be saved as a draft report on the patient's record.")}</p>
      </div>

      <div className="modal-body assign-form">
        {/* ── left: patient picker ── */}
        <div className="assign-pane assign-pane-patient">
          <label className="np-row">
            <span>{tr(lang, "Пацієнт *", "Patient *")}</span>
            <input className="ti" value={query} autoFocus
              placeholder={tr(lang, "Пошук: ім'я або MRN…", "Search name or MRN…")}
              onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="assign-patients" role="listbox" aria-label={tr(lang, "Пацієнти", "Patients")}>
            {patients.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={patient?.id === p.id}
                className={"assign-patient" + (patient?.id === p.id ? " on" : "")}
                onClick={() => setPatient(p)}>
                <span className="assign-patient-name">{patientName(p)}</span>
                <span className="assign-patient-meta">
                  {p.dob || "—"}{p.mrn ? ` · ${p.mrn}` : ""}
                </span>
              </button>
            ))}
            {!patients.length && (
              <div className="muted" style={{ padding: 12, fontSize: 13 }}>
                {searching ? tr(lang, "Пошук…", "Searching…") : tr(lang, "Нікого не знайдено", "No patients found")}
              </div>
            )}
          </div>
        </div>

        {/* ── right: template + meta ── */}
        <div className="assign-pane">
          {/* Platform dropdown: a native <select> draws its own unstyled list,
              and this one can be 20 templates long. */}
          <div className="np-row">
            <span>{tr(lang, "Шаблон", "Template")}</span>
            <MenuSelect
              block
              icon="fileText"
              value={templateId}
              onChange={setTemplateId}
              ariaLabel={tr(lang, "Шаблон", "Template")}
              options={[
                { value: "", label: tr(lang, "Автоматично (за змістом)", "Automatic (by content)") },
                ...templates.map((t) => ({ value: t.id, label: t.name, sub: t.code || undefined })),
              ]}
            />
          </div>
          <label className="np-row">
            <span>{tr(lang, "Назва звіту (необов'язково)", "Report title (optional)")}</span>
            <input className="ti" value={title}
              placeholder={tr(lang, "Типово: «Шаблон — дата»", "Default: “Template — date”")}
              onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="np-row">
            <span>{tr(lang, "Дата прийому", "Encounter date")}</span>
            <input className="ti" type="date" value={encounterDate}
              max={today()}
              onChange={(e) => setEncounterDate(e.target.value)} />
          </label>

          {error && error.kind === "already_assigned" && (
            <div className="asr-banner asr-banner-warn" role="alert">
              <Icon name="help" size={13} />
              <span>
                {tr(lang, "Це завдання вже призначено: ", "This job is already assigned: ")}
                <a href={`#/dictate/reports/${error.report_id}`}
                  onClick={(e) => { e.preventDefault(); go(`/dictate/reports/${error.report_id}`); }}>
                  {error.report_code || tr(lang, "відкрити звіт", "open the report")}
                </a>
              </span>
            </div>
          )}
          {error && error.kind === "msg" && (
            <div className="asr-banner asr-banner-err" role="alert">
              <Icon name="x" size={13} />
              <span>{error.msg}</span>
            </div>
          )}
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose} disabled={submitting}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={!patient || submitting} onClick={submit}>
          {submitting
            ? tr(lang, "Призначення…", "Assigning…")
            : tr(lang, "Призначити пацієнту", "Assign to patient")}
        </button>
      </div>
    </Modal>
  );
}
