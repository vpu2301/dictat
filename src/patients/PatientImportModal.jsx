// PatientImportModal.jsx — bulk roster import (CSV / paste).
//
// Three steps, because an import is three decisions: what file, is it right,
// and what actually landed.
//
//   pick    — drop a .csv, choose one, or paste the columns straight in
//   preview — the parsed table with per-row problems, a server dry-run
//             behind it (duplicate detection needs the roster), and the count
//             that will actually be written
//   done    — the per-row result, including which rows were skipped as
//             already-registered and where those records live
//
// The preview's dry-run is not decoration: MRN/ІПН duplicates can only be
// found server-side, and re-uploading last month's file is the single most
// likely thing a clinic does. Local parsing catches shape errors; the server
// catches "you already have this patient".
import React, { useMemo, useRef, useState } from "react";
import { Icon, Modal } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { importPatients } from "../api/patients.js";
import { csvTemplate, parsePatientCsv } from "./importCsv.js";
import { tr } from "../i18n.js";

const MAX_ROWS = 500; // mirrors MDX_PATIENT_IMPORT_MAX_ROWS

// Row-level problem codes → what the clinician should read. Shared by the
// local preview and the server's answer: both speak this vocabulary, so a
// code that only the server can produce (a duplicate) reads the same as one
// the parser found (a malformed phone).
function codeLabel(code, lang) {
  return ({
    name_required: tr(lang, "Немає імені", "Name is missing"),
    dob_invalid: tr(lang, "Незрозуміла дата народження", "Unreadable date of birth"),
    phone_invalid: tr(lang, "Некоректний телефон", "Malformed phone"),
    email_invalid: tr(lang, "Некоректна пошта", "Malformed e-mail"),
    ipn_invalid: tr(lang, "Некоректний ІПН", "Invalid ІПН"),
    mrn_exists: tr(lang, "Такий номер картки вже є", "This MRN is already on the roster"),
    ipn_exists: tr(lang, "Такий ІПН вже є", "This ІПН is already on the roster"),
    duplicate_in_batch: tr(lang, "Дублюється у файлі", "Duplicated inside the file"),
    import_too_large: tr(lang, "Завеликий файл", "File is too large"),
  }[code] || code || tr(lang, "Помилка", "Error"));
}

function StatusChip({ status, lang }) {
  const label = {
    created: tr(lang, "створено", "created"),
    valid: tr(lang, "готово", "ready"),
    skipped: tr(lang, "пропущено", "skipped"),
    failed: tr(lang, "помилка", "failed"),
  }[status] || status;
  const cls = { created: "live", valid: "live", skipped: "draft", failed: "err" }[status] || "";
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function PatientImportModal({ lang, onClose, onImported }) {
  const [step, setStep] = useState("pick"); // pick | preview | done
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [dryRun, setDryRun] = useState(null);   // server verdict per row
  const [result, setResult] = useState(null);   // final import result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const sendable = useMemo(() => (parsed?.rows || []).filter((r) => r.item), [parsed]);
  const localErrors = (parsed?.rows || []).length - sendable.length;

  // Server verdicts are positional against `sendable` — keep the map so the
  // preview table can show a duplicate next to the row it came from.
  const verdictByLine = useMemo(() => {
    const map = new Map();
    (dryRun?.rows || []).forEach((v) => {
      const row = sendable[v.index];
      if (row) map.set(row.line, v);
    });
    return map;
  }, [dryRun, sendable]);

  const readFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result || ""));
    reader.readAsText(file, "utf-8");
  };

  // Parse locally, then ask the server to rehearse the same batch. The
  // dry-run is best-effort: if it fails (offline, 403), the preview still
  // renders and the import button still works — the real call decides.
  const ingest = async (raw) => {
    setError(null);
    setText(raw);
    const p = parsePatientCsv(raw);
    setParsed(p);
    setStep("preview");
    setDryRun(null);
    const items = p.rows.filter((r) => r.item).map((r) => r.item);
    if (!items.length || items.length > MAX_ROWS) return;
    setBusy(true);
    try {
      setDryRun(await importPatients({ items, dryRun: true, onDuplicate: "skip" }));
    } catch {
      setDryRun(null);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await importPatients({
        items: sendable.map((r) => r.item),
        onDuplicate: skipDuplicates ? "skip" : "fail",
      });
      setResult(res);
      setStep("done");
      if (res.created > 0 && onImported) onImported(res);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate(lang)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klarnote-patients-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const willCreate = dryRun
    ? dryRun.rows.filter((r) => r.status === "valid").length
    : sendable.length;
  const willSkip = dryRun ? dryRun.skipped : 0;
  const tooMany = sendable.length > MAX_ROWS;

  return (
    <Modal onClose={busy ? () => {} : onClose} className="pimport-modal">
      <div className="modal-h">
        <div>
          <h2>{tr(lang, "Імпорт пацієнтів", "Import patients")}</h2>
          <p className="sub">
            {step === "pick" && tr(lang, "CSV з іншої системи — до 500 рядків за раз.",
                                         "A CSV from your previous system — up to 500 rows at a time.")}
            {step === "preview" && (fileName || tr(lang, "Вставлені дані", "Pasted data"))}
            {step === "done" && tr(lang, "Готово", "Finished")}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={15} />
        </button>
      </div>

      {/* ── step 1: pick a file ─────────────────────────────── */}
      {step === "pick" && (
        <div className="modal-b pimport-pick">
          <div
            className={"pimport-drop" + (dragging ? " on" : "")}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer?.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Icon name="download" size={22} />
            <div className="pimport-drop-t">
              {tr(lang, "Перетягніть CSV сюди", "Drop a CSV here")}
            </div>
            <div className="pimport-drop-s">
              {tr(lang, "або натисніть, щоб обрати файл", "or click to choose a file")}
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden
                   onChange={(e) => readFile(e.target.files?.[0])} />
          </div>

          <div className="pimport-or">{tr(lang, "або вставте колонки", "or paste the columns")}</div>
          <textarea
            className="pimport-paste"
            rows={5}
            placeholder={"ПІБ,Дата народження,Стать,Телефон\nІван Петренко,15.01.1980,Ч,+380671234567"}
            onChange={(e) => setText(e.target.value)}
            value={text}
          />
        </div>
      )}
      {step === "pick" && (
          <div className="modal-f">
            <button className="btn ghost sm" onClick={downloadTemplate}>
              <Icon name="download" size={13} /> {tr(lang, "Шаблон CSV", "CSV template")}
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
            <button className="btn accent" disabled={!text.trim()} onClick={() => ingest(text)}>
              {tr(lang, "Далі", "Next")}
            </button>
          </div>
      )}

      {/* ── step 2: preview ─────────────────────────────────── */}
      {step === "preview" && parsed && (
        <div className="modal-b">
          <div className="pimport-summary">
            <div className="stat-card sm">
              <div className="stat-v">{willCreate}</div>
              <div className="stat-l">{tr(lang, "буде створено", "will be created")}</div>
            </div>
            <div className="stat-card sm">
              <div className="stat-v">{willSkip}</div>
              <div className="stat-l">{tr(lang, "вже у базі", "already on file")}</div>
            </div>
            <div className="stat-card sm">
              <div className="stat-v">{localErrors}</div>
              <div className="stat-l">{tr(lang, "з помилками", "with problems")}</div>
            </div>
            {busy && <span className="muted">{tr(lang, "Перевірка…", "Checking…")}</span>}
          </div>

          {parsed.unmapped.length > 0 && (
            <p className="muted pimport-note">
              {tr(lang, "Не розпізнано колонки", "Columns not recognised")}: {parsed.unmapped.join(", ")} —{" "}
              {tr(lang, "їх не буде імпортовано.", "they will not be imported.")}
            </p>
          )}
          {tooMany && (
            <p className="pimport-note err">
              {tr(lang, `У файлі ${sendable.length} рядків — імпортуйте не більше ${MAX_ROWS} за раз.`,
                        `The file holds ${sendable.length} rows — import at most ${MAX_ROWS} at a time.`)}
            </p>
          )}
          {error && <ApiErrorView error={error} lang={lang} />}

          <div className="ptable pimport-table pimport-preview">
            <div className="ptable-head">
              <div>{tr(lang, "Рядок", "Line")}</div>
              <div>{tr(lang, "Пацієнт", "Patient")}</div>
              <div>{tr(lang, "Дата нар.", "DOB")}</div>
              <div>{tr(lang, "Картка", "MRN")}</div>
              <div>{tr(lang, "Контакти", "Contact")}</div>
              <div>{tr(lang, "Стан", "State")}</div>
            </div>
            {parsed.rows.map((r) => {
              const verdict = verdictByLine.get(r.line);
              const status = r.errors.length ? "failed" : (verdict?.status || "valid");
              const code = r.errors.length ? r.errors[0].code : verdict?.code;
              return (
                <div key={r.line} className={"ptable-row" + (status === "failed" ? " is-err" : "")}>
                  <div className="muted">{r.line}</div>
                  <div>
                    <strong>{r.display.name || <span className="muted">—</span>}</strong>
                    {r.display.sex !== "U" && <span className="chip">{r.display.sex}</span>}
                  </div>
                  <div className="muted">{r.display.dob || "—"}</div>
                  <div className="muted">{r.display.mrn || "—"}</div>
                  <div className="muted">{[r.display.phone, r.display.email].filter(Boolean).join(" · ") || "—"}</div>
                  <div>
                    <StatusChip status={status} lang={lang} />
                    {code && <span className="pimport-reason">{codeLabel(code, lang)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
      {step === "preview" && parsed && (
          <div className="modal-f">
            <label className="pimport-check">
              <input type="checkbox" checked={skipDuplicates}
                     onChange={(e) => setSkipDuplicates(e.target.checked)} />
              {tr(lang, "Пропускати тих, хто вже є", "Skip patients already on the roster")}
            </label>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={busy} onClick={() => { setStep("pick"); setDryRun(null); }}>
              {tr(lang, "Назад", "Back")}
            </button>
            <button className="btn accent" disabled={busy || tooMany || willCreate === 0} onClick={runImport}>
              <Icon name="check" size={13} />{" "}
              {busy
                ? tr(lang, "Імпорт…", "Importing…")
                : tr(lang, `Імпортувати ${willCreate}`, `Import ${willCreate}`)}
            </button>
          </div>
      )}

      {/* ── step 3: what landed ─────────────────────────────── */}
      {step === "done" && result && (
        <div className="modal-b">
          <div className="pimport-summary">
            <div className="stat-card sm">
              <div className="stat-v">{result.created}</div>
              <div className="stat-l">{tr(lang, "створено", "created")}</div>
            </div>
            <div className="stat-card sm">
              <div className="stat-v">{result.skipped}</div>
              <div className="stat-l">{tr(lang, "пропущено", "skipped")}</div>
            </div>
            <div className="stat-card sm">
              <div className="stat-v">{result.failed}</div>
              <div className="stat-l">{tr(lang, "не вдалося", "failed")}</div>
            </div>
          </div>

          {(result.skipped > 0 || result.failed > 0) && (
            <div className="ptable pimport-table pimport-result">
              <div className="ptable-head">
                <div>{tr(lang, "Рядок", "Line")}</div>
                <div>{tr(lang, "Пацієнт", "Patient")}</div>
                <div>{tr(lang, "Причина", "Reason")}</div>
              </div>
              {result.rows
                .filter((v) => v.status !== "created")
                .map((v) => (
                  <div key={v.index} className="ptable-row">
                    <div className="muted">{sendable[v.index]?.line ?? v.index + 1}</div>
                    <div>{sendable[v.index]?.display.name || "—"}</div>
                    <div>
                      <StatusChip status={v.status} lang={lang} />
                      <span className="pimport-reason">{codeLabel(v.code, lang)}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

        </div>
      )}
      {step === "done" && result && (
          <div className="modal-f">
            <div style={{ flex: 1 }} />
            <button className="btn accent" onClick={onClose}>{tr(lang, "Готово", "Done")}</button>
          </div>
      )}
    </Modal>
  );
}
