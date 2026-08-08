// filtersModel.js — the retrieval playground's form state, as pure functions.
//
// The editor component draws controls; every state change goes through here.
// That split is what makes "does this filter actually reach the wire?" a unit
// test (filtersModel.test.js) instead of a Playwright run: the model's output
// is fed straight to buildRetrieveRequest, so the assertion covers the whole
// path from a click to the request body.

import { DEFAULT_FORM } from "../../../api/evidenceRetrieval.js";

export const emptyForm = () => ({
  ...DEFAULT_FORM,
  sources: [...DEFAULT_FORM.sources],
  filters: { ...DEFAULT_FORM.filters, authority: [], specialty: [] },
});

/** Set a top-level field (query, k, tenantId, snapshotId, traceId). */
export function setField(form, key, value) {
  return { ...form, [key]: value };
}

/** Set one filter field. */
export function setFilter(form, key, value) {
  return { ...form, filters: { ...form.filters, [key]: value } };
}

/** Add/remove a value in a list-valued field, preserving the offered order. */
export function toggleIn(list, value, order) {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return order ? order.filter((v) => next.includes(v)) : next;
}

export function toggleSource(form, kind, order) {
  return { ...form, sources: toggleIn(form.sources, kind, order) };
}

export function toggleAuthority(form, authority, order) {
  return setFilter(form, "authority", toggleIn(form.filters.authority, authority, order));
}

/**
 * Specialties are typed, not picked: the corpus carries whatever the ingest
 * run set, and an enum here would quietly drop a specialty the backend knows.
 * Comma-separated in, list out; blanks and duplicates dropped.
 */
export function parseSpecialty(text) {
  const seen = new Set();
  for (const part of String(text ?? "").split(",")) {
    const value = part.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

export const specialtyText = (list) => (list || []).join(", ");

/**
 * A date range where `from` is after `to` returns nothing and looks like a
 * retrieval failure. Caught here so the form can say so before the request.
 */
export function formIssues(form) {
  const issues = [];
  if (!String(form.query ?? "").trim()) issues.push("query is required");
  if (String(form.query ?? "").trim().length > 2000) issues.push("query is capped at 2000 characters");
  const k = Number.parseInt(form.k, 10);
  if (!Number.isFinite(k) || k < 1) issues.push("k must be a positive integer");
  const { date_from: from, date_to: to } = form.filters;
  if (from && to && from > to) issues.push("date range ends before it starts");
  if (!form.sources.length) issues.push("pick at least one source");
  return issues;
}

export const canSubmit = (form) => formIssues(form).length === 0;

/**
 * What the empty state echoes back: the filters that were actually applied, in
 * words. "No passages" is a fact about a query — showing the query without its
 * filters is the reason people re-run the same search three times.
 */
export function describeApplied(body) {
  const parts = [`k=${body.k}`, `sources: ${body.sources.join(", ")}`];
  const f = body.filters || {};
  if (f.authority) parts.push(`authority: ${f.authority.join(", ")}`);
  if (f.specialty) parts.push(`specialty: ${f.specialty.join(", ")}`);
  if (f.jurisdiction) parts.push(`jurisdiction: ${f.jurisdiction}`);
  if (f.date_from || f.date_to) parts.push(`published ${f.date_from || "…"} → ${f.date_to || "…"}`);
  if (f.include_superseded) parts.push("including superseded versions");
  if (body.snapshot_id) parts.push(`snapshot ${body.snapshot_id}`);
  if (body.tenant_id) parts.push(`tenant ${body.tenant_id}`);
  return parts;
}
