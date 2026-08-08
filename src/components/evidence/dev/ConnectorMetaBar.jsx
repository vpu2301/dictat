// ConnectorMetaBar.jsx — per-connector status/latency/count chips (EVA-S03).
//
// Rendering only; every decision is in connectorMeta.js (unit-tested).
import React from "react";
import { connectorSummary } from "./connectorMeta.js";

export function ConnectorMetaBar({ response }) {
  const summary = connectorSummary(response);
  if (!summary.total) return null;

  return (
    <div className="evd-connectors" data-testid="connector-meta-bar">
      {summary.warn && (
        <div
          className="evd-banner evd-banner-warn"
          role="status"
          data-testid="degraded-banner"
          data-degraded={String(summary.degraded)}
        >
          {summary.headline}
        </div>
      )}
      <ul className="evd-chips" aria-label="Connector results">
        {summary.chips.map((chip) => (
          <li key={chip.id}>
            <span
              className={`evd-chip evd-tone-${chip.tone}`}
              title={chip.title}
              data-testid={`connector-chip-${chip.id}`}
              data-status={chip.status}
            >
              <span className="evd-chip-name">{chip.id}</span>
              {/* Status in words, not only in colour. */}
              <span className="evd-chip-status">{chip.status}</span>
              <span className="evd-chip-num">{chip.count}</span>
              <span className="evd-chip-ms">{chip.latencyMs} ms</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="evd-connectors-sum">
        {summary.passages} passage{summary.passages === 1 ? "" : "s"} from {summary.total} connector
        {summary.total === 1 ? "" : "s"}, slowest {summary.slowestMs} ms
        {response?.snapshot_id ? ` · snapshot ${response.snapshot_id}` : ""}
        {response?.lexicon_version ? ` · lexicon ${response.lexicon_version}` : ""}
      </p>
    </div>
  );
}
