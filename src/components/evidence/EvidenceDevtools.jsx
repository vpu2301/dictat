// EvidenceDevtools.jsx — #/evidence/dev, the index of the developer screens.
//
// The devtools' only entry point: there is no sidebar link and there will not
// be one. You reach these by typing the path or following a link from here,
// which is the right amount of friction for a screen that is not part of the
// product.
import React from "react";
import { SERVICES } from "../../api/services.js";
import "./evidence.css";

const TOOLS = [
  {
    path: "/evidence/dev/retrieval",
    title: "Retrieval playground",
    body: "POST /retrieve with the full RR2 filter set. Shows per-connector status, " +
      "per-stage fusion scores, and the raw request and response.",
    service: "evidenceRetrieval",
    sprint: "EVA-S03",
  },
];

export function EvidenceDevtools({ navigate }) {
  return (
    <div className="page evd-page" data-testid="evidence-devtools">
      <header className="evd-head">
        <h1>Evidence devtools</h1>
        <p className="evd-sub">
          Developer screens for the evidence pipeline. Not a product surface: en-only, no
          translations, no analytics, and gated behind <code>VITE_FEAT_EVIDENCE_DEVTOOLS</code>.
        </p>
      </header>

      <ul className="evd-tools">
        {TOOLS.map((tool) => (
          <li key={tool.path}>
            <button
              type="button"
              className="evd-tool"
              onClick={() => navigate(tool.path)}
              data-testid={`tool-${tool.path}`}
            >
              <span className="evd-tool-title">{tool.title}</span>
              <span className="evd-tool-body">{tool.body}</span>
              <span className="evd-tool-meta">
                <code>{SERVICES[tool.service]}</code> · {tool.sprint}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="evd-note">
        Corpus administration — ingest, snapshots, retractions, quarantine — is not here and is
        not coming here. It is operator work behind the ingest CLI until the knowledge-admin
        portal in S12; see <code>evidence-backend/docs/runbooks/evidence-ingest.md</code>.
      </p>
    </div>
  );
}
