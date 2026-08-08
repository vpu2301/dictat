// RetrievalPlayground.jsx — #/evidence/dev/retrieval (EVA-S03).
//
// The module's first data-driven screen, and the pattern every later evidence
// screen copies: an api module + `useAsync` + the shared DataStates, with all
// derivation in pure siblings.
//
// THE SUBMITTED-PARAMS PATTERN. Editing the form does not refetch — typing a
// query character by character would fire a request per keystroke at a service
// that runs an embedding model. `submitted` holds the body that was actually
// sent; `useAsync` keys on it, so a resubmit is a new object and the hook's own
// stale-response guard drops an in-flight answer to a superseded question.
//
// Results stay on screen while the next request runs (dictat convention): the
// point of comparison is what the last query returned.
//
// en-only by declared exception — see src/components/evidence/README.md.
import React, { useMemo, useState } from "react";
import { Loading } from "../../DataStates.jsx";
import { ApiErrorView } from "../../ApiErrorView.jsx";
import { Empty } from "../../UI.jsx";
import { useAsync } from "../../../api/useAsync.js";
import {
  SOURCE_KINDS, buildRetrieveRequest, isRetrievalUnavailable, retrieve,
} from "../../../api/evidenceRetrieval.js";
import { canSubmit, describeApplied, emptyForm, formIssues, setField, toggleSource } from "./filtersModel.js";
import { ConnectorMetaBar } from "./ConnectorMetaBar.jsx";
import { FiltersEditor } from "./FiltersEditor.jsx";
import { JsonViewer } from "./JsonViewer.jsx";
import { PassageResultRow } from "./PassageResultRow.jsx";
import "../evidence.css";

export function RetrievalPlayground() {
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(null);

  const req = useAsync(() => retrieve(submitted), [submitted], { enabled: !!submitted });
  // `useAsync` holds the last successful `data` through the next request and
  // through a failure, which is dictat's convention and exactly right here:
  // the previous result is what you are comparing against. So there is no
  // second copy of it in this component — `req.data` IS the last good answer,
  // and `req.loading` says whether a newer one is on its way.
  const response = req.data;
  const stale = req.loading || !!req.error;

  const issues = formIssues(form);
  const passages = response?.passages || [];
  const applied = useMemo(() => (submitted ? describeApplied(submitted) : []), [submitted]);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit(form)) return;
    setSubmitted(buildRetrieveRequest(form));
  };

  return (
    <div className="page evd-page" data-testid="retrieval-playground">
      <header className="evd-head">
        <h1>Retrieval playground</h1>
        <p className="evd-sub">
          POST /retrieve against evidence-retrieval. Developer tool: it speaks the pipeline's
          vocabulary — connectors, fusion scores, snapshots — and is never shown to a clinician.
        </p>
      </header>

      <div className="evd-split">
        <form className="evd-form" onSubmit={submit} data-testid="retrieval-form">
          <div className="evd-field">
            <label className="label" htmlFor="evd-query">query</label>
            <textarea
              id="evd-query"
              className="input evd-query"
              rows={3}
              value={form.query}
              onChange={(e) => setForm(setField(form, "query", e.target.value))}
              placeholder="Яка перша лінія терапії артеріальної гіпертензії?"
              data-testid="query-input"
            />
          </div>

          <div className="evd-field evd-field-row">
            <span className="evd-subfield evd-subfield-k">
              <label className="label" htmlFor="evd-k">k</label>
              <input
                id="evd-k" className="input" type="number" min="1"
                value={form.k}
                onChange={(e) => setForm(setField(form, "k", e.target.value))}
                data-testid="k-input"
              />
            </span>
            <span className="evd-subfield">
              <label className="label" htmlFor="evd-trace">trace id</label>
              <input
                id="evd-trace" className="input"
                value={form.traceId}
                placeholder="optional — correlates with the service log"
                onChange={(e) => setForm(setField(form, "traceId", e.target.value))}
                data-testid="trace-input"
              />
            </span>
          </div>

          <div className="evd-field">
            <span className="label" id="evd-sources-label">sources</span>
            <ul className="evd-checks" aria-labelledby="evd-sources-label">
              {SOURCE_KINDS.map((kind) => (
                <li key={kind}>
                  <label className="evd-check">
                    <input
                      type="checkbox"
                      checked={form.sources.includes(kind)}
                      onChange={() => setForm(toggleSource(form, kind, SOURCE_KINDS))}
                      data-testid={`source-${kind}`}
                    />
                    <span>{kind.replace(/_/g, " ")}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <FiltersEditor form={form} onChange={setForm} />

          {issues.length > 0 && (
            <ul className="evd-issues" data-testid="form-issues">
              {issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}

          <div className="evd-actions">
            <button className="btn accent" type="submit" disabled={issues.length > 0} data-testid="submit">
              Retrieve
            </button>
            <button className="btn" type="button" onClick={() => setForm(emptyForm())} data-testid="reset">
              Reset
            </button>
          </div>

          <JsonViewer label="request body" value={submitted} testId="request-json" />
        </form>

        <section className="evd-results" aria-label="Results" data-testid="results">
          {!submitted && (
            <Empty
              icon="search"
              title="Nothing retrieved yet"
              body="Enter a query and press Retrieve. The request body is shown under the form."
            />
          )}

          {/* Loading covers the results area only — the form stays interactive.
              The full spinner is for the first request; a reload keeps the
              previous result on screen under an "updating" line, because on a
              debugging screen the previous result is the thing you are
              comparing against. */}
          {submitted && req.loading && !response && <Loading lang="en" />}
          {submitted && req.loading && response && (
            <p className="evd-updating" role="status" data-testid="updating">updating…</p>
          )}

          {submitted && req.error && (
            <div className="evd-error" data-testid="retrieval-error">
              <ApiErrorView error={req.error} lang="en" />
              {isRetrievalUnavailable(req.error) && (
                <p className="evd-error-note" data-testid="unavailable-note">
                  evidence-retrieval is unavailable or its mandatory dense engine is down. The service
                  fails closed rather than answering on lexical alone — nothing is wrong with the query.
                </p>
              )}
              <button className="btn" type="button" onClick={req.reload} data-testid="retry">
                Retry
              </button>
            </div>
          )}

          {submitted && response && (
            <div className={stale ? "evd-stale" : ""} data-stale={String(stale)}>
              {stale && (
                <p className="evd-stale-note" data-testid="stale-note">
                  showing the previous result
                </p>
              )}
              <ConnectorMetaBar response={response} />
              {passages.length === 0 ? (
                <div data-testid="no-passages">
                  <Empty
                    icon="search"
                    title="No passages for this query"
                    body="The service answered; nothing matched. What was asked:"
                  />
                  <ul className="evd-applied" data-testid="applied-filters">
                    {applied.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              ) : (
                <ol className="evd-rows" data-testid="passage-list">
                  {passages.map((p, i) => (
                    <PassageResultRow key={p.id || i} passage={p} rank={i + 1} />
                  ))}
                </ol>
              )}
              <JsonViewer label="raw response" value={response} testId="response-json" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
