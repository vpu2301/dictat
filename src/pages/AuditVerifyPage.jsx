// AuditVerifyPage.jsx — /audit/verify. Runs the chain walk, renders result.
//
// GET /audit/verify?from_seq=&to_seq= (auth-service, roles auditor|tenant_admin,
// no MFA). The tenant comes from claims.tid — never sent by the client. The
// response is an untyped dict:
//   { ok, tenant_id, from_seq, to_seq, events_checked, last_seq, last_hash,
//     first_divergence_seq, divergence_reason, expected_hash, actual_hash }
//
// Three sharp edges in that contract shape this page:
//   1. `to_seq < from_seq` is NOT validated server-side — the library raises a
//      bare ValueError, so the API answers 500. We block it client-side.
//   2. An empty range is "vacuously ok": ok=true with events_checked=0 and
//      last_seq=null. Rendering that as a green "Verified" would be a lie, so
//      it gets its own neutral state.
//   3. On divergence_reason="gap" both expected_hash and actual_hash are null —
//      the hash rows are only meaningful for the two mismatch reasons.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { verifyAuditChain } from "../api/endpoints.js";
import { tr } from "../i18n.js";

// The three values the backend can report (audit.verifier.DivergenceReason).
const REASON = {
  gap: {
    uk: "Пропуск у послідовності — подію(ї) видалено або вони не дійшли до журналу.",
    en: "Gap in the sequence — one or more events were deleted or never reached the log.",
  },
  prev_hash_mismatch: {
    uk: "Посилання на попередній хеш не збігається — ланцюг було переписано.",
    en: "The link to the previous hash does not match — the chain was rewritten.",
  },
  payload_hash_mismatch: {
    uk: "Хеш вмісту не збігається — тіло події змінено після запису.",
    en: "The payload hash does not match — the event body was altered after it was written.",
  },
};
const reasonText = (reason, lang) =>
  (REASON[reason] ? tr(lang, REASON[reason].uk, REASON[reason].en) : reason || "—");

export function AuditVerifyPage({ lang = "en", navigate }) {
  const [form, setForm] = useState({ from_seq: 1, to_seq: "" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    const from = Number(form.from_seq || 1);
    const to = form.to_seq === "" ? undefined : Number(form.to_seq);
    // Guard the two inputs the API mishandles: <1 is a 422, to<from is a 500.
    if (!Number.isInteger(from) || from < 1) {
      setFormError(tr(lang, "from_seq має бути цілим числом ≥ 1.", "from_seq must be a whole number ≥ 1."));
      return;
    }
    if (to !== undefined && (!Number.isInteger(to) || to < from)) {
      setFormError(tr(lang, "to_seq має бути ≥ from_seq.", "to_seq must be ≥ from_seq."));
      return;
    }
    setFormError(null);
    setRunning(true); setError(null); setResult(null);
    try {
      setResult(await verifyAuditChain({ from_seq: from, to_seq: to }));
    } catch (err) { setError(err); }
    finally { setRunning(false); }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-verify-${result.from_seq}-${result.to_seq ?? result.last_seq ?? "tail"}.json`;
    // Anchor must be in the document, and the URL must outlive the click —
    // revoking synchronously cancels the download in some browsers.
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const copy = (s) => { try { navigator.clipboard.writeText(s); } catch {} };

  // ok + zero events is an empty range, not a verified chain.
  const empty = result && result.ok && !result.events_checked;
  const tone = !result ? null : !result.ok ? "fail" : empty ? "warn" : "ok";

  return (
    <div className="page audit-verify">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Перевірка ланцюга аудиту", "Verify audit chain")}</h1>
          <p className="sub">{tr(lang, "Прохід по хеш-ланцюгу журналу цієї клініки для виявлення розривів.", "Walk this clinic's audit hash chain to detect divergence.")}</p>
        </div>
      </div>

      <section className="card admin-card">
        <header className="admin-card-h">
          <Icon name="shield" size={14} />
          <h2>{tr(lang, "Діапазон", "Range")}</h2>
          <small className="muted">
            {tr(lang, "Порожній to_seq — до кінця журналу.", "Leave to_seq empty to walk to the end of the log.")}
          </small>
        </header>
        <form className="admin-form" onSubmit={run}>
          <label className="admin-field">
            <span>from_seq</span>
            <input type="number" min="1" value={form.from_seq}
                   onChange={(e) => setForm({ ...form, from_seq: e.target.value })} disabled={running} />
          </label>
          <label className="admin-field">
            <span>to_seq</span>
            <input type="number" min="1" value={form.to_seq}
                   onChange={(e) => setForm({ ...form, to_seq: e.target.value })}
                   placeholder={tr(lang, "до кінця", "to end")} disabled={running} />
          </label>
          <div className="admin-form-actions" style={{ alignItems: "center", gap: 12 }}>
            {formError && <span className="field-error" style={{ marginRight: "auto" }}>{formError}</span>}
            {running && (
              <span className="muted" style={{ fontSize: 12 }}>
                {tr(lang, "Довгі діапазони можуть тривати кілька хвилин…", "A long range can take a few minutes…")}
              </span>
            )}
            <button className="btn accent" type="submit" disabled={running}>
              {running ? (tr(lang, "Перевірка…", "Verifying…")) : (tr(lang, "Запустити", "Run verification"))}
            </button>
          </div>
        </form>
      </section>

      {error && <ApiErrorView error={error} lang={lang} />}

      {result && (
        <section className={"card verify-result " + tone}>
          <header>
            {tone === "ok" && <Icon name="check" size={28} />}
            {tone === "warn" && <Icon name="help" size={28} />}
            {tone === "fail" && <Icon name="x" size={28} />}
            <div>
              {tone === "ok" && <>
                <strong>{tr(lang, "Підтверджено", "Verified")}</strong>
                <p>{lang === "uk"
                  ? `${result.events_checked} подій перевірено; останній seq ${result.last_seq}.`
                  : `${result.events_checked} events checked; last seq ${result.last_seq}.`}</p>
              </>}
              {tone === "warn" && <>
                <strong>{tr(lang, "У діапазоні немає подій", "No events in this range")}</strong>
                <p>{tr(lang,
                  "Порожній діапазон сервер вважає коректним — це не підтвердження ланцюга. Розширте діапазон.",
                  "The server treats an empty range as valid — that is not a verified chain. Widen the range.")}</p>
              </>}
              {tone === "fail" && <>
                <strong>{tr(lang, "Виявлено розрив", "Divergence detected")}</strong>
                <p>seq {result.first_divergence_seq} — {reasonText(result.divergence_reason, lang)}</p>
              </>}
            </div>
            <div style={{ flex: 1 }} />
            {!result.ok && result.first_divergence_seq && navigate && (
              <button
                className="btn"
                onClick={() => navigate(`/audit/events?from_seq=${result.first_divergence_seq}`)}
              >
                <Icon name="list" size={13} /> {tr(lang, "Показати подію", "Show the event")}
              </button>
            )}
            <button className="btn" onClick={download}>
              <Icon name="download" size={13} /> JSON
            </button>
          </header>

          <div className="verify-grid">
            <Row label="tenant_id" value={result.tenant_id} mono copy={copy} />
            <Row label="from_seq" value={result.from_seq} />
            <Row
              label="to_seq"
              value={result.to_seq}
              hint={result.to_seq == null ? tr(lang, "до кінця журналу", "to the end of the log") : null}
            />
            <Row label="events_checked" value={result.events_checked} />
            <Row label="last_seq" value={result.last_seq} />
            <Row label="last_hash" value={result.last_hash} mono copy={copy} />
            {!result.ok && <>
              <Row label="first_divergence_seq" value={result.first_divergence_seq} />
              <Row label="divergence_reason" value={result.divergence_reason} />
              {/* A gap reports no hashes at all — showing two empty rows would
                  read as missing data rather than "not applicable". */}
              {result.divergence_reason !== "gap" && <>
                <Row label="expected_hash" value={result.expected_hash} mono copy={copy} />
                <Row label="actual_hash" value={result.actual_hash} mono copy={copy} />
              </>}
            </>}
          </div>

          <details>
            <summary>{tr(lang, "Сирий результат", "Raw response")}</summary>
            <JsonViewer value={result} />
          </details>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, mono, copy, hint }) {
  const emptyValue = value == null || value === "";
  return (
    <div className="verify-row">
      <div className="verify-row-label">{label}</div>
      <div className="verify-row-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>
        {emptyValue
          ? <span className="muted">{hint || "—"}</span>
          : String(value)}
        {copy && !emptyValue && (
          <button className="icon-btn" onClick={() => copy(String(value))} title="Copy" style={{ marginLeft: 6 }}>
            <Icon name="copy" size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
