// AuditVerifyPage.jsx — /audit/verify. Runs the chain walk, renders result.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { verifyAuditChain } from "../api/endpoints.js";
import { tr } from "../i18n.js";

export function AuditVerifyPage({ lang = "en" }) {
  const [form, setForm] = useState({ from_seq: 1, to_seq: "" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await verifyAuditChain({
        from_seq: Number(form.from_seq || 1),
        to_seq: form.to_seq === "" ? undefined : Number(form.to_seq),
      });
      setResult(r);
    } catch (err) { setError(err); }
    finally { setRunning(false); }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-verify-${result.from_seq}-${result.to_seq || "tail"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = (s) => { try { navigator.clipboard.writeText(s); } catch {} };

  return (
    <div className="page audit-verify">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Перевірка ланцюга аудиту", "Verify audit chain")}</h1>
          <p className="muted">{tr(lang, "Запустити прохід по ланцюгу для виявлення розривів.", "Walk the hash chain to detect divergence.")}</p>
        </div>
      </div>

      <form className="card verify-form" onSubmit={run}>
        <label>
          <span>from_seq</span>
          <input type="number" value={form.from_seq} onChange={(e) => setForm({ ...form, from_seq: e.target.value })} />
        </label>
        <label>
          <span>to_seq</span>
          <input type="number" value={form.to_seq} onChange={(e) => setForm({ ...form, to_seq: e.target.value })} placeholder={tr(lang, "до кінця", "to end")} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={running}>
          {running ? "…" : (tr(lang, "Запустити", "Run verification"))}
        </button>
      </form>

      {error && <ApiErrorView error={error} lang={lang} />}

      {result && (
        <section className={"card verify-result " + (result.ok ? "ok" : "fail")}>
          <header>
            {result.ok ? (
              <><Icon name="check" size={28} /><div>
                <strong>{tr(lang, "Підтверджено", "Verified")}</strong>
                <p>{lang === "uk"
                  ? `${result.events_checked} подій перевірено; останній seq ${result.last_seq}.`
                  : `${result.events_checked} events; last seq ${result.last_seq}.`}</p>
              </div></>
            ) : (
              <><Icon name="x" size={28} /><div>
                <strong>{tr(lang, "Виявлено розрив", "Divergence detected")}</strong>
                <p>{lang === "uk"
                  ? `seq ${result.first_divergence_seq} — ${result.divergence_reason}`
                  : `seq ${result.first_divergence_seq} — ${result.divergence_reason}`}</p>
              </div></>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={download}>
              <Icon name="download" size={13} /> JSON
            </button>
          </header>

          <div className="verify-grid">
            <Row label="tenant_id" value={result.tenant_id} mono copy={copy} />
            <Row label="from_seq" value={result.from_seq} />
            <Row label="to_seq" value={result.to_seq} />
            <Row label="events_checked" value={result.events_checked} />
            <Row label="last_seq" value={result.last_seq} />
            <Row label="last_hash" value={result.last_hash} mono copy={copy} />
            {!result.ok && <>
              <Row label="expected_hash" value={result.expected_hash} mono copy={copy} />
              <Row label="actual_hash" value={result.actual_hash} mono copy={copy} />
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

function Row({ label, value, mono, copy }) {
  return (
    <div className="verify-row">
      <div className="verify-row-label">{label}</div>
      <div className="verify-row-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>
        {value == null || value === "" ? <span className="muted">—</span> : String(value)}
        {copy && value && (
          <button className="icon-btn" onClick={() => copy(String(value))} title="Copy" style={{ marginLeft: 6 }}>
            <Icon name="download" size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
