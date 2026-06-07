// JsonViewer.jsx — Pretty-printed JSON in a monospace block.
import React from "react";

export function JsonViewer({ value, maxHeight = 320 }) {
  let pretty = "";
  try { pretty = JSON.stringify(value, null, 2); }
  catch { pretty = String(value); }
  return (
    <pre style={{
      margin: 0, padding: 10, borderRadius: 8,
      background: "var(--surface-2)", color: "var(--text-2)",
      fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.5,
      maxHeight, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {pretty}
    </pre>
  );
}
