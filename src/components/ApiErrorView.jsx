// ApiErrorView.jsx — Renders an RFC 9457 Problem Details object as a card.
import React from "react";
import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";

export function ApiErrorView({ error, lang = "en" }) {
  if (!error) return null;
  const status = error.status ?? 0;
  const p = error.problem || {};
  const title = p.title || error.message || (tr(lang, "Помилка", "Error"));
  const detail = p.detail || "";
  const instance = p.instance || "";
  const showRef = status >= 500 && instance;

  // A 422 body carries `errors: [{ loc, msg, ... }]`. Without these the card
  // reads "Unprocessable Content — Request validation failed." and the user
  // has no way to know WHICH field the server rejected.
  const fieldErrors = Array.isArray(p.errors) ? p.errors : [];
  const fieldName = (loc) =>
    Array.isArray(loc) ? loc.filter((s) => s !== "body" && s !== "query").join(".") : "";

  const copy = () => {
    if (!instance) return;
    try { navigator.clipboard.writeText(instance); } catch {}
  };

  return (
    <div
      role="alert"
      style={{
        background: "var(--rec-soft, #fee2e2)",
        border: "1px solid var(--rec, #dc2626)",
        color: "var(--text-1)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <Icon name="x" size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {title} {status ? <span style={{ color: "var(--muted)", fontWeight: 400 }}>({status})</span> : null}
        </div>
        {detail && <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-2)" }}>{detail}</div>}
        {fieldErrors.length > 0 && (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--text-2)" }}>
            {fieldErrors.map((fe, i) => (
              <li key={i}>
                {fieldName(fe.loc) && <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fieldName(fe.loc)}</code>}
                {fieldName(fe.loc) ? " — " : ""}
                {fe.msg}
              </li>
            ))}
          </ul>
        )}
        {showRef && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
            <span>{tr(lang, "Код підтримки:", "Support reference:")}</span>
            <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{instance}</code>
            <button className="btn btn-ghost" onClick={copy} title="Copy" style={{ padding: "2px 6px" }}>
              <Icon name="download" size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
