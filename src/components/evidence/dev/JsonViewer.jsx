// JsonViewer.jsx — collapsed <pre> of a request or response (EVA-S03).
//
// dictat has no shared JSON viewer (nothing before this sprint needed one) and
// this is not the place to introduce a general-purpose component: it is
// dev-only, en-only, and a scrollable <pre> with a copy button is the whole
// requirement. If a clinician-facing screen ever needs JSON — it should not —
// that is when a shared component earns its keep.
import React, { useState } from "react";

export function JsonViewer({ label, value, testId, open = false }) {
  const [expanded, setExpanded] = useState(open);
  const [copied, setCopied] = useState(false);
  if (value === undefined || value === null) return null;
  const text = JSON.stringify(value, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the text is on screen anyway */ }
  };

  return (
    <div className="evd-json" data-testid={testId}>
      <div className="evd-json-head">
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "▾" : "▸"} {label}
        </button>
        {expanded && (
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      {expanded && <pre className="evd-pre">{text}</pre>}
    </div>
  );
}
