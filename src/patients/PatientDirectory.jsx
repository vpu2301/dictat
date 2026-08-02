// PatientDirectory.jsx — sprint 11 step 02: the /patients roster.
// Debounced cancel-safe search, a paged table (numbered pager + per-page
// selector over the server cursor), create/edit/archive, and the separate
// ІПН exact-lookup field.
//
// PII hygiene (deliberate, test-enforced by e2e/patients-directory.spec.js):
// - Search state lives in component memory ONLY — never synced to the URL.
//   A shareable "#/patients?q=Петренко" is exactly the leak the sprint's
//   hygiene rule forbids, so the usual URL-state convenience is an
//   anti-pattern here. Route params stay opaque UUIDs.
// - Rows render displayName + yearOfBirth (src/api/patients.js) — never the
//   full DOB.
// - Nothing patient-derived goes to localStorage/sessionStorage or telemetry.

import React, { useState, useEffect, useRef } from "react";
import { Icon, Empty, Modal } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { Loading } from "../components/DataStates.jsx";
import { useClaims } from "../auth/AuthContext.jsx";
import { isAdminOnly } from "../auth/roles.js";
import {
  listPatients, createPatient, updatePatient, toPage,
  displayName, yearOfBirth,
} from "../api/patients.js";
import { useSearchQuery } from "../api/useSearchQuery.js";
import { checkIpn, stripIpnSeparators } from "./ipn.js";
import { tr } from "../i18n.js";

// ─── Local avatar helpers (same convention as PatientProfile.jsx) ────────
const ACCENT_PALETTE = [
  "#0a8a7a", "#2563eb", "#7c3aed", "#dc2626",
  "#ea580c", "#0891b2", "#059669", "#d97706", "#be185d", "#0369a1",
];
const autoAccent = (name) =>
  ACCENT_PALETTE[((name || "A").toUpperCase().charCodeAt(0) - 65 + ACCENT_PALETTE.length) % ACCENT_PALETTE.length];

function autoInitials(nameStr) {
  const parts = String(nameStr || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function fmtRel(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return tr(lang, "щойно", "just now");
  if (diffMin < 60) return lang === "uk" ? `${diffMin} хв тому` : `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return lang === "uk" ? `${h} год тому` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return lang === "uk" ? `${days} дн. тому` : `${days} d ago`;
  return d.toLocaleDateString(tr(lang, "uk-UA", "en-GB"), { day: "2-digit", month: "short", year: "numeric" });
}

const SEX_LABEL = { M: "M", F: "F", U: "—" };

// Per-page choices; the roster fetch limit must stay ≥ the largest of these.
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function StatusBadge({ status, lang }) {
  if (status === "inactive") {
    return <span className="pdir-badge inactive">{tr(lang, "архів", "archived")}</span>;
  }
  if (status === "deceased") {
    return <span className="pdir-badge deceased">{tr(lang, "помер(ла)", "deceased")}</span>;
  }
  return null;
}

// ─── ІПН input with inline РНОКПП validation ─────────────────────────────
// Shape errors say "10 цифр", checksum errors say "typo" — mirroring the
// backend's InvalidIpnError / IpnChecksumError distinction.
function ipnHint(text, lang) {
  const stripped = stripIpnSeparators(text);
  if (!stripped) return null;
  const c = checkIpn(text);
  if (c.ok) return { kind: "ok", msg: tr(lang, "ІПН коректний", "Valid ІПН") };
  if (c.reason === "checksum") {
    return { kind: "err", msg: tr(lang, "Контрольна цифра не збігається — перевірте ІПН", "Control digit mismatch — check the ІПН") };
  }
  if (stripped.length < 10 && /^\d*$/.test(stripped)) {
    return { kind: "hint", msg: lang === "uk" ? `${stripped.length}/10 цифр` : `${stripped.length}/10 digits` };
  }
  return { kind: "err", msg: tr(lang, "ІПН — рівно 10 цифр", "ІПН is exactly 10 digits") };
}

// ─── Create / edit form ──────────────────────────────────────────────────
// `patient` null → create; set → edit (adds the status field; `erased` is
// engine-only and never offered — the backend 422s it anyway).
export function PatientFormModal({ lang, patient, onClose, onSave, onOpenExisting }) {
  const editing = !!patient;
  const [nameUk, setNameUk] = useState(patient ? patient.name?.uk || "" : "");
  const [nameEn, setNameEn] = useState(patient ? patient.name?.en || "" : "");
  const [dob, setDob] = useState(patient?.dob || "");
  const [sex, setSex] = useState(patient?.sex || "U");
  const [mrn, setMrn] = useState(patient?.mrn || "");
  const [summary, setSummary] = useState(patient ? patient.summary?.uk || "" : "");
  const [tags, setTags] = useState(patient?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [ipn, setIpn] = useState("");          // edit: empty = keep stored value
  const [clearIpn, setClearIpn] = useState(false);
  const [status, setStatus] = useState(patient?.status || "active");
  const [deceasedConfirmed, setDeceasedConfirmed] = useState(patient?.status === "deceased");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const ipnState = ipnHint(ipn, lang);
  const ipnBlocked = !!stripIpnSeparators(ipn) && !checkIpn(ipn).ok;
  const needsDeceasedConfirm = editing && status === "deceased" && patient.status !== "deceased" && !deceasedConfirmed;
  const valid = nameUk.trim() && !ipnBlocked && !needsDeceasedConfirm;

  const title = editing
    ? (tr(lang, "Редагувати пацієнта", "Edit patient"))
    : (tr(lang, "Новий пацієнт", "New patient"));

  const addTag = (val) => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags((t) => [...t, v]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (!valid || saving) return;
    const uk = nameUk.trim();
    const en = nameEn.trim() || uk;
    const body = {
      name: { uk, en },
      sex,
      mrn: mrn.trim(),
      summary: summary ? { uk: summary, en: summary } : (editing ? { uk: "", en: "" } : undefined),
      tags,
    };
    if (dob) body.dob = dob;
    else if (editing) body.dob = null;
    const typedIpn = stripIpnSeparators(ipn);
    if (typedIpn) body.ipn = checkIpn(ipn).ipn;
    else if (editing && clearIpn) body.ipn = "";       // "" clears server-side
    if (editing) body.status = status;                 // never "erased" — not offered
    setSaving(true);
    setError(null);
    try {
      await onSave(body);
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  const ipnConflict = error?.status === 409 && error?.problem?.code === "patient_ipn_exists";
  const existingId = ipnConflict ? error.problem.existing_patient_id : null;

  return (
    <Modal onClose={onClose} className="modal-xl">
      <div className="modal-h">
        <h2>{title}</h2>
        <p>{editing
          ? (tr(lang, "Зміни зберігаються в картці пацієнта", "Changes are saved to the patient record"))
          : (tr(lang, "Додайте пацієнта до вашої картки", "Add a patient to your panel"))}</p>
      </div>

      <div className="modal-body np-form">
        <div className="np-pane np-pane-id">
        <div className="np-row two">
          <label>
            <span>{tr(lang, "ПІБ (УКР) *", "Full name (UK) *")}</span>
            <input className="ti" value={nameUk} autoFocus={!editing}
              onChange={(e) => setNameUk(e.target.value)} />
          </label>
          <label>
            <span>{tr(lang, "ПІБ (EN)", "Full name (EN)")}</span>
            <input className="ti" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </label>
        </div>

        <div className="np-row three">
          <label>
            <span>{tr(lang, "Дата народження", "Date of birth")}</span>
            <input className="ti" type="date" value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)} />
          </label>
          <label>
            <span>{tr(lang, "Стать", "Sex")}</span>
            <div className="np-sex-toggle">
              {["M", "F", "U"].map((s) => (
                <button key={s} type="button" className={sex === s ? "on" : ""} onClick={() => setSex(s)}>
                  {s === "M" ? (tr(lang, "Чол.", "Male"))
                    : s === "F" ? (tr(lang, "Жін.", "Female"))
                    : "—"}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>MRN</span>
            <input className="ti mono" value={mrn} onChange={(e) => setMrn(e.target.value)} />
          </label>
        </div>

        <div className="np-row">
          <label style={{ flex: 1 }}>
            <span>
              {tr(lang, "ІПН (РНОКПП)", "ІПН (tax number)")}
              {editing && patient.has_ipn && !clearIpn && (
                <em className="pdir-ipn-stored">
                  {tr(lang, " · збережено — введіть новий, щоб замінити", " · on file — type a new one to replace")}
                </em>
              )}
            </span>
            <input className="ti mono" inputMode="numeric" value={ipn}
              placeholder={editing && patient.has_ipn ? "••••••••••" : "10 цифр"}
              disabled={clearIpn}
              onChange={(e) => setIpn(e.target.value)} />
            {ipnState && <span className={`pdir-ipn-hint ${ipnState.kind}`}>{ipnState.msg}</span>}
          </label>
          {editing && patient.has_ipn && (
            <label className="pdir-ipn-clear">
              <input type="checkbox" checked={clearIpn}
                onChange={(e) => { setClearIpn(e.target.checked); if (e.target.checked) setIpn(""); }} />
              <span>{tr(lang, "Прибрати ІПН", "Remove ІПН")}</span>
            </label>
          )}
        </div>

        {editing && (
          <div className="np-row">
            <label>
              <span>{tr(lang, "Статус", "Status")}</span>
              <div className="np-sex-toggle pdir-status-toggle">
                {["active", "inactive", "deceased"].map((s) => (
                  <button key={s} type="button" className={status === s ? "on" : ""}
                    onClick={() => { setStatus(s); if (s !== "deceased") setDeceasedConfirmed(false); }}>
                    {s === "active" ? (tr(lang, "Активний", "Active"))
                      : s === "inactive" ? (tr(lang, "Архів", "Archived"))
                      : (tr(lang, "Помер(ла)", "Deceased"))}
                  </button>
                ))}
              </div>
            </label>
          </div>
        )}
        {editing && status === "deceased" && patient.status !== "deceased" && (
          <label className="pdir-deceased-confirm">
            <input type="checkbox" checked={deceasedConfirmed}
              onChange={(e) => setDeceasedConfirmed(e.target.checked)} />
            <span>{tr(lang, "Підтверджую: пацієнт помер. Картка буде позначена відповідно.", "I confirm the patient is deceased. The record will be marked accordingly.")}</span>
          </label>
        )}
        </div>

        <div className="np-pane">
        <label className="np-row">
          <span>{tr(lang, "Основний діагноз / причина звернення", "Chief complaint / summary")}</span>
          <textarea className="ti np-summary" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>

        <div className="np-row">
          <span className="np-label">{tr(lang, "Теги / стани", "Tags / conditions")}</span>
          <div className="np-tags-field">
            {tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
                <button type="button" style={{ marginLeft: 4, color: "var(--muted)" }}
                  onClick={() => setTags((t) => t.filter((x) => x !== tag))}>×</button>
              </span>
            ))}
            <input
              className="np-tag-input"
              value={tagInput}
              placeholder={tr(lang, "+ додати тег", "+ add tag")}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                if (e.key === "Backspace" && !tagInput && tags.length) setTags((t) => t.slice(0, -1));
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
            />
          </div>
        </div>

        {error && ipnConflict && (
          <div className="pdir-conflict" role="alert">
            <div>{tr(lang, "Пацієнт із цим ІПН уже існує у вашій клініці.", "A patient with this ІПН already exists in your clinic.")}</div>
            {existingId && (
              <button type="button" className="btn small" onClick={() => onOpenExisting?.(existingId)}>
                <Icon name="user" size={13} /> {tr(lang, "Відкрити наявну картку", "Open the existing record")}
              </button>
            )}
          </div>
        )}
        {error && !ipnConflict && (
          <div style={{ color: "var(--rec, #dc2626)", fontSize: 13 }}>
            {error.message || (tr(lang, "Не вдалося зберегти", "Could not save"))}
          </div>
        )}
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={!valid || saving} onClick={handleSave}>
          {!editing && <Icon name="plus" size={13} />}
          {saving ? (tr(lang, "Збереження…", "Saving…"))
            : editing ? (tr(lang, "Зберегти", "Save"))
            : (tr(lang, "Додати пацієнта", "Add patient"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── Roster ──────────────────────────────────────────────────────────────
export function PatientDirectory({ navigate, lang }) {
  // Patients are tenant-scoped server-side (RLS on the active tenant); re-key
  // on claims.tid so the roster refetches after a clinic switch.
  const claims = useClaims();
  const activeTid = claims?.tid;
  // S15 — an admin-only account receives a REDACTED roster (name + id);
  // opening a record goes through per-patient break-glass. Say so, or
  // the blank MRN/DOB columns read as a data bug.
  const redactedRoster = isAdminOnly(claims);

  // Fetch limit ≥ the largest page size (PAGE_SIZE_OPTIONS) so the biggest
  // per-page setting still fills from a single request; the server caps at 200.
  const sq = useSearchQuery(
    (query, cursor, { signal } = {}) =>
      listPatients({ query: query || undefined, cursor, limit: 100 }, signal ? { signal } : {}).then(toPage),
    [activeTid],
    { debounceMs: 250, minLength: 2 },
  );

  // Two SEPARATE inputs, one server param: names/MRN free-text vs exact ІПН.
  // The ІПН field fires only at exactly 10 checksum-valid digits (the backend
  // dispatches a valid-ІПН `query=` to the HMAC lookup). Neither is ever
  // reflected into the URL — see the header comment.
  const [nameText, setNameText] = useState("");
  const [ipnText, setIpnText] = useState("");
  const ipnState = ipnHint(ipnText, lang);

  const onNameChange = (text) => {
    setNameText(text);
    if (ipnText) setIpnText("");        // the two searches never mix
    sq.setQuery(text);
  };
  const onIpnChange = (text) => {
    setIpnText(text);
    const stripped = stripIpnSeparators(text);
    if (!stripped) { sq.setQuery(nameText); return; }   // cleared → back to name search
    const c = checkIpn(text);
    if (c.ok) sq.setQuery(c.ipn);       // fires ONLY on 10 valid digits
  };

  const [showInactive, setShowInactive] = useState(true); // clinics look up returning patients
  const [addOpen, setAddOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);

  const rows = showInactive ? sq.items : sq.items.filter((p) => p.status === "active");

  // ── Paging ──────────────────────────────────────────────────────────────
  // The roster is a forward-only server cursor, so pages are cut client-side
  // out of everything fetched so far and Next past the last loaded page pulls
  // the following cursor page first. `pageCount` therefore GROWS as you page
  // forward — that is the honest picture: the total is unknown until the
  // cursor runs out, which is also why the range hint only appears then.
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Anything that redefines the result set sends you back to page 1.
  useEffect(() => { setPage(1); }, [sq.query, showInactive, pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamp when the set shrinks under the current page (archived filter, a
  // narrower search, a page fetch that returned nothing).
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  // Top up a short page: the server may hand back fewer rows than the page
  // size (small cursor page, or the "show archived" filter eating rows), and a
  // half-empty page above a live Next button reads as data loss. Bounded by
  // MAX_FILL_FETCHES per page so a filter that hides nearly everything can't
  // walk the whole roster in one go — Next still pulls the rest by hand.
  const MAX_FILL_FETCHES = 3;
  const fillsRef = useRef(0);
  useEffect(() => { fillsRef.current = 0; }, [page, pageSize, sq.query, showInactive]);
  useEffect(() => {
    if (sq.loading || sq.loadingMore || !sq.hasMore) return;
    if (rows.length >= page * pageSize) return;
    if (fillsRef.current >= MAX_FILL_FETCHES) return;
    fillsRef.current += 1;
    sq.loadMore();
  }, [rows.length, page, pageSize, sq.hasMore, sq.loading, sq.loadingMore, sq.loadMore]);

  const goNext = async () => {
    if (page < pageCount) { setPage((p) => p + 1); return; }
    if (!sq.hasMore || sq.loadingMore) return;
    await sq.loadMore();
    setPage((p) => p + 1);   // clamped above if the fetch added nothing
  };

  // Keyboard: "/" focuses search (unless already typing), ↑/↓ move, Enter opens.
  const searchRef = useRef(null);
  const [kbIdx, setKbIdx] = useState(-1);
  useEffect(() => { setKbIdx(-1); }, [pageRows.length, sq.query, page]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/") return;
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Arrow keys move within the CURRENT page; Enter opens the highlighted row.
  const onListKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setKbIdx((i) => Math.min(pageRows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setKbIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && kbIdx >= 0 && pageRows[kbIdx]) navigate(`/scribe/patients/${pageRows[kbIdx].id}`);
  };

  const handleAdd = async (payload) => {
    await createPatient(payload);
    setAddOpen(false);
    sq.reload();
  };
  const handleEdit = async (payload) => {
    await updatePatient(editPatient.id, payload);
    setEditPatient(null);
    sq.reload();
  };
  const openExisting = (id) => {
    setAddOpen(false);
    setEditPatient(null);
    navigate(`/scribe/patients/${id}`);
  };

  const initialLoading = sq.loading && sq.items.length === 0 && !sq.error;

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{tr(lang, "Пацієнти", "Patients")}</h1>
          <p className="sub">
            {rows.length}{sq.hasMore ? "+" : ""} {tr(lang, "у вашій карті", "in your panel")}
          </p>
        </div>
        <button className="btn accent" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={13} /> {tr(lang, "Новий пацієнт", "Add patient")}
        </button>
      </div>

      <div className="ptable-toolbar pdir-toolbar">
        <div className="search-input">
          <Icon name="search" size={14} />
          <input ref={searchRef}
            placeholder={tr(lang, "Пошук: ім'я або MRN…", "Search: name or MRN…")}
            value={nameText} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <div className={"search-input pdir-ipn-search" + (ipnState?.kind === "err" ? " has-err" : "")}>
          <Icon name="shield" size={14} />
          <input inputMode="numeric" aria-label={tr(lang, "Пошук за ІПН", "Search by ІПН")}
            placeholder={tr(lang, "Пошук за ІПН (10 цифр)", "Search by ІПН (10 digits)")}
            value={ipnText} onChange={(e) => onIpnChange(e.target.value)} />
          {ipnState && <span className={`pdir-ipn-hint ${ipnState.kind}`}>{ipnState.msg}</span>}
        </div>
        <label className="pdir-inactive-toggle">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          <span>{tr(lang, "Показувати архівних", "Show archived")}</span>
        </label>
        {sq.loading && sq.items.length > 0 && (
          <span className="pdir-searching">{tr(lang, "Пошук…", "Searching…")}</span>
        )}
      </div>

      {redactedRoster && (
        <div className="pdir-redacted-note" style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 10, borderRadius: 8,
          background: "var(--soft,#f4f4f5)", fontSize: 12.5, color: "var(--muted)",
        }}>
          <Icon name="shield" size={13} />
          {tr(lang,
            "Реєстр показує лише ім'я та статус. Щоб відкрити картку пацієнта, потрібен тимчасовий доступ із зазначенням причини.",
            "The roster shows only name and status. Opening a patient record requires temporary access with a stated reason.")}
        </div>
      )}

      <div className="ptable" role="listbox" tabIndex={0} onKeyDown={onListKeyDown}
        aria-label={tr(lang, "Список пацієнтів", "Patient list")}>
        <div className="ptable-head">
          <div>{tr(lang, "Пацієнт", "Patient")}</div>
          <div>MRN</div>
          <div>{tr(lang, "Стан / теги", "Conditions")}</div>
          <div>{tr(lang, "Останній візит", "Last visit")}</div>
          <div></div>
        </div>

        {initialLoading && <Loading lang={lang} />}
        {sq.error && <ApiErrorView error={sq.error} lang={lang} />}
        {!initialLoading && !sq.error && rows.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Empty icon="users" title={
              sq.query
                ? (tr(lang, "Нічого не знайдено", "No results"))
                : (tr(lang, "Пацієнтів ще немає", "No patients yet"))
            } />
          </div>
        )}

        {!initialLoading && !sq.error && pageRows.map((p, i) => {
          const dimmed = p.status !== "active";
          const yob = yearOfBirth(p);
          return (
            <div key={p.id}
              className={"ptable-row" + (dimmed ? " pdir-dimmed" : "") + (i === kbIdx ? " pdir-kb" : "")}
              role="option" aria-selected={i === kbIdx}
              onClick={() => navigate(`/scribe/patients/${p.id}`)}>
              <div className="pcell-name">
                <div className="pavatar" style={{
                  width: 34, height: 34, fontSize: 12,
                  background: autoAccent(displayName(p, lang)),
                }}>{autoInitials(displayName(p, lang))}</div>
                <div>
                  <div className="pname">
                    {displayName(p, lang)}
                    <StatusBadge status={p.status} lang={lang} />
                  </div>
                  <div className="psub">
                    {yob != null ? (lang === "uk" ? `нар. ${yob}` : `b. ${yob}`) : (tr(lang, "рік нар. невідомий", "YOB unknown"))}
                    {` · ${SEX_LABEL[p.sex] || p.sex}`}
                  </div>
                </div>
              </div>
              <div className="pmono">
                {p.mrn}
                {p.has_ipn && (
                  <span className="pdir-ipn-chip" title={tr(lang, "ІПН збережено", "ІПН on file")}>
                    <Icon name="shield" size={11} /> ІПН
                  </span>
                )}
              </div>
              <div className="ptags">
                {(p.tags || []).slice(0, 2).map((t, j) => <span key={j} className="chip">{t}</span>)}
                {(p.tags || []).length > 2 && <span className="chip">+{p.tags.length - 2}</span>}
              </div>
              <div className="psub">{fmtRel(p.last_visit, lang)}</div>
              <div className="pdir-row-actions">
                <button type="button" className="icon-btn" title={tr(lang, "Редагувати", "Edit")}
                  aria-label={lang === "uk" ? `Редагувати ${displayName(p, lang)}` : `Edit ${displayName(p, lang)}`}
                  onClick={(e) => { e.stopPropagation(); setEditPatient(p); }}>
                  <Icon name="edit" size={14} />
                </button>
                <Icon name="chevRight" size={14} />
              </div>
            </div>
          );
        })}

      </div>

      {!initialLoading && !sq.error && rows.length > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          hasNext={page < pageCount || sq.hasMore}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={goNext}
          onPage={setPage}
          loading={sq.loadingMore || sq.loading}
          lang={lang}
          /* Only once the cursor is exhausted is `rows.length` the real total —
             until then "1–25 of 50" would understate the roster. */
          total={sq.hasMore ? null : rows.length}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
        />
      )}

      {addOpen && (
        <PatientFormModal lang={lang} patient={null}
          onClose={() => setAddOpen(false)} onSave={handleAdd} onOpenExisting={openExisting} />
      )}
      {editPatient && (
        <PatientFormModal lang={lang} patient={editPatient}
          onClose={() => setEditPatient(null)} onSave={handleEdit} onOpenExisting={openExisting} />
      )}
    </div>
  );
}
