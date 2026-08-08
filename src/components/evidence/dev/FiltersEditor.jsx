// FiltersEditor.jsx — the RR2 filter set (EVA-S03).
//
// Draws controls; every state transition goes through filtersModel.js, which
// is where the round-trip to the request body is unit-proven.
//
// `snapshot id` sits in this panel although the contract puts it at the top
// level of the request, not inside `filters` — it belongs here for the person
// using the screen (it narrows what you are searching) and is mapped correctly
// by buildRetrieveRequest. The label says so.
import React from "react";
import { AUTHORITIES } from "../../../api/evidenceRetrieval.js";
import { parseSpecialty, setFilter, setField, specialtyText, toggleAuthority } from "./filtersModel.js";

export function FiltersEditor({ form, onChange }) {
  const f = form.filters;
  const filter = (key, value) => onChange(setFilter(form, key, value));
  const field = (key, value) => onChange(setField(form, key, value));

  return (
    <fieldset className="evd-fieldset" data-testid="filters-editor">
      <legend>Filters</legend>

      <div className="evd-field">
        <span className="label" id="evd-authority-label">authority</span>
        <ul className="evd-checks" aria-labelledby="evd-authority-label">
          {AUTHORITIES.map((a) => (
            <li key={a}>
              <label className="evd-check">
                <input
                  type="checkbox"
                  checked={f.authority.includes(a)}
                  onChange={() => onChange(toggleAuthority(form, a, AUTHORITIES))}
                  data-testid={`filter-authority-${a}`}
                />
                <span>{a.replace(/_/g, " ")}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="evd-field">
        <label className="label" htmlFor="evd-jurisdiction">jurisdiction</label>
        <input
          id="evd-jurisdiction"
          className="input"
          value={f.jurisdiction}
          placeholder="UA"
          onChange={(e) => filter("jurisdiction", e.target.value)}
          data-testid="filter-jurisdiction"
        />
      </div>

      <div className="evd-field">
        <label className="label" htmlFor="evd-specialty">specialty</label>
        <input
          id="evd-specialty"
          className="input"
          value={specialtyText(f.specialty)}
          placeholder="cardiology, endocrinology"
          onChange={(e) => filter("specialty", parseSpecialty(e.target.value))}
          data-testid="filter-specialty"
        />
        <span className="evd-hint">comma separated — free text, not an enum: the corpus carries whatever ingest set</span>
      </div>

      <div className="evd-field evd-field-row">
        <span className="evd-subfield">
          <label className="label" htmlFor="evd-date-from">published from</label>
          <input
            id="evd-date-from" type="date" className="input"
            value={f.date_from}
            onChange={(e) => filter("date_from", e.target.value)}
            data-testid="filter-date-from"
          />
        </span>
        <span className="evd-subfield">
          <label className="label" htmlFor="evd-date-to">published to</label>
          <input
            id="evd-date-to" type="date" className="input"
            value={f.date_to}
            onChange={(e) => filter("date_to", e.target.value)}
            data-testid="filter-date-to"
          />
        </span>
      </div>

      <div className="evd-field">
        <label className="evd-check">
          <input
            type="checkbox"
            checked={f.include_superseded}
            onChange={(e) => filter("include_superseded", e.target.checked)}
            data-testid="filter-include-superseded"
          />
          <span>include superseded versions</span>
        </label>
        <span className="evd-hint">off by default: only the latest version of each document is searched</span>
      </div>

      <div className="evd-field">
        <label className="label" htmlFor="evd-snapshot">snapshot id</label>
        <input
          id="evd-snapshot"
          className="input"
          value={form.snapshotId}
          placeholder="uuid — pin the corpus to a frozen snapshot"
          onChange={(e) => field("snapshotId", e.target.value)}
          data-testid="filter-snapshot-id"
        />
        <span className="evd-hint">
          sent top-level, not inside <code>filters</code> — it selects which corpus is searched
        </span>
      </div>

      <div className="evd-field">
        <label className="label" htmlFor="evd-tenant">tenant id</label>
        <input
          id="evd-tenant"
          className="input"
          value={form.tenantId}
          placeholder="blank = the global corpus (nil uuid)"
          onChange={(e) => field("tenantId", e.target.value)}
          data-testid="filter-tenant-id"
        />
        <span className="evd-hint">required by the service when <code>tenant_corpus</code> is among the sources</span>
      </div>
    </fieldset>
  );
}
