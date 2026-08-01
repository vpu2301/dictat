// encounters.js — clinical encounters and the day's scheduled visit queue.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// GET /patients/{id}/encounters — chronological encounter history.
export async function listEncounters(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/encounters`, { method: "GET" });
}

export async function getEncounter(id) {
  return a(`/encounters/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /patients/{id}/encounters — body: { kind, datetime?, reason, status? }.
// kind: visit|phone|video|scribe|followup|other; status: scheduled|
// in_progress|paused|completed|cancelled (server default "completed", which
// is the retro-log case and the only one that bumps last_visit at create
// time — an open visit gets its bump when it is completed).
// extra="forbid" — send only what the caller set.
export async function createEncounter(patientId, { kind, datetime, reason, status } = {}) {
  const b = { kind, reason };
  if (datetime !== undefined) b.datetime = datetime;
  if (status !== undefined) b.status = status;
  return a(`/patients/${encodeURIComponent(patientId)}/encounters`, {
    method: "POST",
    body: JSON.stringify(b),
  });
}

// ── Visit lifecycle ──────────────────────────────────────────────────
//
// Until migration 0058 a visit's status was write-once: the SPA opened one
// as "in_progress" and nothing could ever close it, so the pipeline filled
// with visits that were long over. These are the transitions.
//
//   scheduled ──start──▶ in_progress ◀──resume── paused
//                          │  └──pause───────────┘
//                          └──complete──▶ completed   (terminal)
//   any open state ──cancel──▶ cancelled              (terminal)
//
// An illegal transition is a 409 carrying a readable `detail`; so is trying
// to end a visit while a recording on it is still live (retry with
// { force: true } once the clinician has confirmed).

const OPEN_STATUSES = ["in_progress", "paused"];

export const ENCOUNTER_OPEN_STATUSES = OPEN_STATUSES;

export function isEncounterOpen(status) {
  return OPEN_STATUSES.includes(status);
}

export function isEncounterClosed(status) {
  return status === "completed" || status === "cancelled";
}

async function transition(id, action, { reason, force } = {}) {
  const b = {};
  if (reason !== undefined && reason !== null && reason !== "") b.reason = reason;
  if (force) b.force = true;
  return a(`/encounters/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    body: JSON.stringify(b),
  });
}

export const startEncounter    = (id, opts) => transition(id, "start", opts);
export const pauseEncounter    = (id, opts) => transition(id, "pause", opts);
export const resumeEncounter   = (id, opts) => transition(id, "resume", opts);
export const completeEncounter = (id, opts) => transition(id, "complete", opts);
export const cancelEncounter   = (id, opts) => transition(id, "cancel", opts);

// GET /encounters/open — visits still holding a slot in the pipeline.
// mine=false widens to the whole tenant (what an admin needs to find visits
// colleagues left hanging).
export async function listOpenEncounters({ mine = true, limit = 100 } = {}) {
  const qs = new URLSearchParams();
  if (mine === false) qs.set("mine", "false");
  if (limit) qs.set("limit", String(limit));
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/encounters/open${tail}`, { method: "GET" });
}

// GET /schedule?date=YYYY-MM-DD — the clinician's visit queue for a day.
// Omit `date` to let the backend default to today in the tenant's timezone.
export async function listSchedule({ date } = {}) {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/schedule${tail}`, { method: "GET" });
}
