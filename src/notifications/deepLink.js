// deepLink.js — (resource_type, resource_id) → an in-app hash route.
//
// The backend also sends an absolute `deep_link` built from
// MDX_APP_BASE_URL. We do NOT navigate to that directly: it is an
// absolute URL from a server-side config that may point at a different
// origin (staging base URL baked into a prod row, say), and following it
// would take the user out of the running SPA. We resolve locally and
// keep `deep_link` as the fallback for a resource type we do not know.
//
// Unknown types degrade to null and the caller no-ops with a visible
// notice — the `unknown_intent` discipline from the editor. A
// notification for a resource a future backend adds must never crash the
// panel of an older client.

import { CATEGORY } from "./constants.js";

export const UNKNOWN_ROUTE = null;

/**
 * @returns {string|null} a hash-router path, or null when unresolvable.
 *
 * Every path returned here MUST have a branch in App.jsx's router. A route
 * the router does not know falls through to the 404 page, which is worse
 * than the visible "cannot open this" notice we give for UNKNOWN_ROUTE —
 * the user is told the click worked and then shown Page not found.
 */
export function resolveRoute(notification) {
  if (!notification) return UNKNOWN_ROUTE;
  const { resource_type: type, resource_id: id, category } = notification;

  // The digest addresses the feed itself, not a resource.
  if (category === CATEGORY.SYSTEM_DIGEST) return "/notifications";

  if (!id) return UNKNOWN_ROUTE;

  switch (type) {
    case "report":
      // Reports live under the dictate product, not at a bare /reports.
      // There is no separate signing view in this SPA — signing happens in
      // a modal on the report itself — so signing outcomes land there too.
      return `/dictate/reports/${encodeURIComponent(id)}`;
    case "patient":
      return `/patients/${encodeURIComponent(id)}`;
    // A finished session has no page of its own — the id addresses a
    // dictation_sessions row, not a view. /dictate is the closest real
    // destination (today's dictations); inventing /dictations/:id to
    // mirror the backend's deep_link would 404 per the rule above.
    case "dictation_session":
      return "/dictate";
    // Same story: the jobs list is a real route, /asr/jobs/:id is not.
    case "transcription_job":
      return "/asr/jobs";
    // No `encounter` case: an encounter is only viewable inside its
    // patient's record, and the notification carries no patient id. Better
    // to degrade visibly than to route to a 404.
    default:
      return UNKNOWN_ROUTE;
  }
}

export function isResolvable(notification) {
  return resolveRoute(notification) !== UNKNOWN_ROUTE;
}
