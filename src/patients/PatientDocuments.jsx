// PatientDocuments.jsx — the "Завантажені / Uploaded" tab of a patient record.
//
// The list of files attached to this patient plus the modal that adds one.
// Deliberately plain: a drop zone, a category, an optional note. What is NOT
// plain is what happens to the bytes — they are envelope-encrypted server-side
// and can only be read back through an authenticated proxy, so a row's
// "download" is a fetch-with-token, not an <a href>. See api/patientDocuments.js.
import React, { useRef, useState } from "react";
import { Icon, Empty, Modal } from "../components/UI.jsx";
import { LoadGate, asList } from "../components/DataStates.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import {
  ACCEPT_ATTR,
  ACCEPTED_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  deletePatientDocument,
  documentIcon,
  downloadPatientDocument,
  formatBytes,
  listPatientDocuments,
  uploadPatientDocument,
} from "../api/patientDocuments.js";
import { tr } from "../i18n.js";

export function categoryLabel(key, lang) {
  return ({
    referral: tr(lang, "Скерування", "Referral"),
    lab: tr(lang, "Аналізи", "Lab result"),
    imaging: tr(lang, "Візуалізація", "Imaging"),
    discharge: tr(lang, "Виписка", "Discharge"),
    consent: tr(lang, "Згода", "Consent"),
    other: tr(lang, "Інше", "Other"),
  })[key] || key;
}

function fmtWhen(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(tr(lang, "uk-UA", "en-GB"), {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Upload modal ─────────────────────────────────────────────────────────

function UploadModal({ patientId, lang, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState("referral");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // Both checks the server also runs. Doing them here saves the clinician a
  // round trip on a 60 MB scan; the server stays the authority.
  const tooBig = file && file.size > MAX_DOCUMENT_BYTES;
  const wrongType = file && file.type && !ACCEPTED_TYPES.includes(file.type);

  const submit = async () => {
    if (!file || tooBig || wrongType) return;
    setBusy(true);
    setError(null);
    try {
      await uploadPatientDocument(patientId, { file, category, note: note.trim() });
      onUploaded();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} className="pdoc-modal">
      <div className="modal-h">
        <div style={{ flex: 1 }}>
          <h2>{tr(lang, "Завантажити документ", "Upload a document")}</h2>
          <p>{tr(lang, "Скерування, аналізи, виписка — файл додається до картки пацієнта.",
                       "A referral, a lab result, a discharge summary — attached to the patient's record.")}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="modal-b">
        <div
          className={"pdoc-drop" + (dragging ? " on" : "") + (file ? " has-file" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer?.files?.[0] || null); }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Icon name={file ? documentIcon(file.type) : "download"} size={22} />
          <div className="pdoc-drop-t">
            {file ? file.name : tr(lang, "Перетягніть файл сюди", "Drop a file here")}
          </div>
          <div className="pdoc-drop-s">
            {file
              ? `${formatBytes(file.size)}${file.type ? ` · ${file.type}` : ""}`
              : tr(lang, "PDF, JPG, PNG, DOCX, DICOM — до 25 МБ", "PDF, JPG, PNG, DOCX, DICOM — up to 25 MB")}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT_ATTR} hidden
                 onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        {tooBig && (
          <p className="pdoc-err">
            {tr(lang, `Файл завеликий (${formatBytes(file.size)}). Максимум — 25 МБ.`,
                      `That file is too large (${formatBytes(file.size)}). The limit is 25 MB.`)}
          </p>
        )}
        {wrongType && (
          <p className="pdoc-err">
            {tr(lang, `Тип «${file.type}» не приймається.`, `The type “${file.type}” is not accepted.`)}
          </p>
        )}

        <div className="pdoc-form">
          <label>
            <span>{tr(lang, "Категорія", "Category")}</span>
            <select className="ti" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c, lang)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{tr(lang, "Примітка", "Note")}</span>
            <input className="ti" maxLength={500} value={note}
                   placeholder={tr(lang, "напр. від сімейного лікаря", "e.g. from the family doctor")}
                   onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        {error && <ApiErrorView error={error} lang={lang} />}
      </div>

      <div className="modal-f">
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onClose} disabled={busy}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" onClick={submit} disabled={busy || !file || tooBig || wrongType}>
          {busy ? tr(lang, "Завантаження…", "Uploading…") : tr(lang, "Завантажити", "Upload")}
        </button>
      </div>
    </Modal>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────

export function PatientDocuments({ patientId, lang, canWrite = true, onCountChange }) {
  const req = useAsync(() => listPatientDocuments(patientId), [patientId]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [error, setError] = useState(null);

  const items = asList(req.data);
  React.useEffect(() => {
    if (onCountChange && req.data) onCountChange(req.data.total ?? items.length);
  }, [req.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (doc) => {
    setBusyId(doc.id);
    setError(null);
    try {
      await downloadPatientDocument(patientId, doc);
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (doc) => {
    setBusyId(doc.id);
    setError(null);
    try {
      await deletePatientDocument(patientId, doc.id);
      setConfirmDoc(null);
      req.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div className="ptable-toolbar" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1 }} />
        {canWrite && (
          <button className="btn accent" onClick={() => setUploadOpen(true)}>
            <Icon name="plus" size={13} /> {tr(lang, "Завантажити документ", "Upload document")}
          </button>
        )}
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <LoadGate req={req} lang={lang}
        empty={() => (
          <Empty icon="fileText" title={tr(lang, "Документів ще немає", "No documents yet")}
                 body={tr(lang, "Скерування, аналізи чи виписку можна прикріпити до картки.",
                               "Referrals, lab results or a discharge summary can be attached to the record.")}
                 action={canWrite ? (
                   <button className="btn accent" onClick={() => setUploadOpen(true)}>
                     <Icon name="plus" size={13} /> {tr(lang, "Завантажити", "Upload")}
                   </button>
                 ) : undefined} />
        )}>
        {() => (
          <div className="pdoc-list">
            {items.map((d) => (
              <div key={d.id} className="pdoc-row">
                <div className="pdoc-icon"><Icon name={documentIcon(d.content_type)} size={16} /></div>
                <div className="pdoc-main">
                  <div className="pdoc-name">
                    {d.filename}
                    <span className="chip">{categoryLabel(d.category, lang)}</span>
                  </div>
                  <div className="pdoc-meta">
                    {formatBytes(d.byte_size)} · {fmtWhen(d.created_at, lang)}
                    {d.note ? ` · ${d.note}` : ""}
                  </div>
                </div>
                <button className="btn sm" disabled={busyId === d.id} onClick={() => download(d)}>
                  <Icon name="download" size={13} /> {tr(lang, "Завантажити", "Download")}
                </button>
                {canWrite && (
                  <button className="icon-btn" disabled={busyId === d.id}
                          title={tr(lang, "Видалити", "Delete")}
                          onClick={() => setConfirmDoc(d)}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </LoadGate>

      {uploadOpen && (
        <UploadModal patientId={patientId} lang={lang}
                     onClose={() => setUploadOpen(false)}
                     onUploaded={() => req.reload()} />
      )}

      {/* Deleting an attachment destroys the encrypted object, not just the
          row — there is no undo, and the confirm says so. */}
      {confirmDoc && (
        <Modal onClose={() => setConfirmDoc(null)}>
          <div className="modal-h"><h2>{tr(lang, "Видалити документ?", "Delete this document?")}</h2></div>
          <div className="modal-b">
            <p style={{ margin: 0 }}>
              <strong>{confirmDoc.filename}</strong>
              <br />
              {tr(lang, "Файл буде знищено остаточно — відновити його неможливо.",
                        "The file is destroyed permanently — it cannot be recovered.")}
            </p>
          </div>
          <div className="modal-f">
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setConfirmDoc(null)}>{tr(lang, "Скасувати", "Cancel")}</button>
            <button className="btn btn-danger" disabled={busyId === confirmDoc.id}
                    onClick={() => remove(confirmDoc)}>
              {tr(lang, "Видалити", "Delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
