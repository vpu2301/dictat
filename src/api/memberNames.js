// memberNames.js — turn a user `sub` (the UUID in report/version audit fields
// like `created_by` and `signed_by`) into a display name.
//
// The report service only ever returns subs, and /admin/users is 403 for a
// clinician ("cannot 'user.read' on 'user'"). The one roster an ordinary member
// CAN read is GET /tenants/{id}/members, which carries { user_sub, display_name,
// role } for everyone in the clinic — so that is the lookup table.
//
// The roster is small and changes rarely, so it is fetched once per tenant and
// shared: several version rows, the diff header and the history timeline all
// resolve names off one request.

import { useEffect, useState } from "react";
import { listMembers } from "./tenants.js";
import { useClaims } from "../auth/AuthContext.jsx";

const cache = new Map(); // tenantId → Promise<Map<sub, member>>

export function loadMemberDirectory(tenantId) {
  if (!tenantId) return Promise.resolve(new Map());
  if (!cache.has(tenantId)) {
    cache.set(
      tenantId,
      listMembers(tenantId)
        .then((r) => {
          const items = Array.isArray(r) ? r : (r && r.items) || [];
          return new Map(items.filter((m) => m && m.user_sub).map((m) => [m.user_sub, m]));
        })
        // A failed roster read must not break the screen that needed a name —
        // callers fall back to a short sub. Drop the rejected entry so a later
        // mount can retry.
        .catch(() => { cache.delete(tenantId); return new Map(); }),
    );
  }
  return cache.get(tenantId);
}

// Exported for tests / logout.
export function clearMemberDirectory() { cache.clear(); }

// Short, recognisable stand-in when the roster has no entry for a sub (a user
// removed from the clinic, or a roster read that failed).
export function shortSub(sub) {
  return sub ? `#${String(sub).slice(0, 8)}` : "";
}

/**
 * → { nameFor(sub), memberFor(sub), ready }
 * `nameFor` is safe to call before the roster lands; it just returns the short
 * sub until then, so nothing has to gate rendering on it.
 */
export function useMemberNames() {
  const claims = useClaims();
  const tenantId = claims && claims.tid;
  const [dir, setDir] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    loadMemberDirectory(tenantId).then((m) => { if (active) setDir(m); });
    return () => { active = false; };
  }, [tenantId]);

  const memberFor = (sub) => (dir && sub ? dir.get(sub) || null : null);
  const nameFor = (sub) => {
    const m = memberFor(sub);
    return (m && (m.display_name || m.email)) || shortSub(sub);
  };
  return { nameFor, memberFor, ready: !!dir };
}
