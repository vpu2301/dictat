// notifications.js — notification-service REST client (sprint 12).
//
// Its own service (:8004). Contract:
//   docs/api/notification-service-openapi.json
//   docs/api/notifications-ws-v1.md   (the socket half)
//
//   GET  /v1/notifications                    cursor feed (unread-first)
//   GET  /v1/notifications/unread-count       cheap badge count
//   POST /v1/notifications/{id}/read          idempotent mark-read
//   POST /v1/notifications/read-all           mark everything read
//   GET  /v1/notifications/preferences        per-category matrix + quiet hours
//   PUT  /v1/notifications/preferences        full replace
//
// REST is the LEDGER. The WebSocket only nudges; on every (re)connect the
// store resyncs from here and REST wins any disagreement. See
// src/notifications/store.js.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const n = (p, init) => apiAt(SERVICES.notification, p, init);

// Server caps `limit` at 100 (Query(le=100)); asking for more is a 422.
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

// GET /v1/notifications →
//   { items: [{ id, category, title, body_text, deep_link, resource_type,
//               resource_id, severity, read_at, created_at }],
//     next_cursor, unread_count }
//
// `cursor` is OPAQUE — base64 of (created_at, id) today, but the backend is
// explicitly free to change the encoding. Never construct or parse one; a
// malformed cursor is a 400 `bad_cursor`, not a silent reset to page 1.
export async function listNotifications({ cursor, limit = DEFAULT_PAGE_SIZE, unreadOnly = false } = {}) {
  const q = new URLSearchParams();
  if (cursor) q.set("cursor", cursor);
  q.set("limit", String(Math.min(limit, MAX_PAGE_SIZE)));
  if (unreadOnly) q.set("unread_only", "true");
  return n(`/v1/notifications?${q}`);
}

// GET /v1/notifications/unread-count → { unread_count }
export async function getUnreadCount() {
  return n("/v1/notifications/unread-count");
}

// POST /v1/notifications/{id}/read → { updated, unread_count }
// Idempotent: marking an already-read row succeeds and does NOT move
// read_at, so a double-click is not an error. 404 if the id is not yours.
export async function markRead(notificationId) {
  return n(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" });
}

// POST /v1/notifications/read-all → { updated, unread_count }
export async function markAllRead() {
  return n("/v1/notifications/read-all", { method: "POST" });
}

// GET /v1/notifications/preferences →
//   { categories: [{ category, in_app_enabled, email_mode, is_default,
//                    digest_eligible }],
//     timezone, quiet_hours: { start, end }, digest_hour }
//
// NOTE the shape: `categories` is a LIST, not a map keyed by category, and
// `timezone`/`digest_hour` sit at the TOP level rather than inside
// quiet_hours. The FE spec's state model sketches it the other way round;
// the wire is authoritative, so src/notifications/prefs.js does the
// conversion in one place instead of every component guessing.
export async function getPreferences() {
  return n("/v1/notifications/preferences");
}

// PUT /v1/notifications/preferences → the same view, re-read after write.
//
// FULL REPLACE, and the model is extra="forbid": send exactly
// { categories, timezone, quiet_hours: {start,end}, digest_hour } and
// nothing else. Omitted categories fall back to the catalog default rather
// than keeping a previous override, so always send the complete matrix.
export async function putPreferences(body) {
  return n("/v1/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
