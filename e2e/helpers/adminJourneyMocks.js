// adminJourneyMocks.js — glue for the sprint-17 full-journey spec.
//
// The journey's audit screen must show the trail of what the admin ACTUALLY
// did in the test — not a canned fixture. The base helpers already record
// every action (ctl.calls, tctl.calls, ctl.enrolled), so this installer
// overrides ONLY /audit/events + /audit/verify (registered last ⇒ matched
// first) and derives the event log from those recorders on every request.
// Everything else falls through to installAdminMocks / installTemplateMocks.
import { ADMIN_SUB } from "./adminMocks.js";

const DEV_SERVER_PORT = "5173";

/** The audit log as implied by the actions taken so far. */
export function deriveJourneyAudit(ctl, tctl) {
  const events = [];
  const t0 = Date.UTC(2026, 7, 8, 6, 0, 0);
  const push = (kind, target_kind, target_id, payload = {}, severity = "info") =>
    events.push({
      seq: events.length + 1,
      created_at: new Date(t0 + events.length * 60_000).toISOString(),
      actor_sub: ADMIN_SUB, actor_role: "tenant_admin",
      kind, target_kind, target_id, payload, severity,
    });

  push("auth.login", "user", ADMIN_SUB, { ok: true });
  if (ctl.enrolled) push("auth.mfa.enrolled", "user", ADMIN_SUB, {});
  for (const inv of ctl.calls.invites.filter((i) => i && i.email))
    push("user.invited", "user", null, { email: inv.email });
  for (const c of tctl.calls.clones)
    push("template.cloned", "template", c.system_template_id, { new_code: c.new_code || null });
  for (const p of tctl.calls.puts)
    push("template.updated", "template", p.id, { schema_version_bumped: true });
  return events;
}

export async function installJourneyAudit(page, ctl, tctl) {
  const jctl = { auditQueries: [], verifyQueries: [] };

  const isApi = (url) =>
    url.hostname === "localhost" && !!url.port && url.port !== DEV_SERVER_PORT;

  await page.route(isApi, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path !== "/audit/events" && path !== "/audit/verify") return route.fallback();

    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const q = url.searchParams;
    const all = deriveJourneyAudit(ctl, tctl);

    if (path === "/audit/events") {
      jctl.auditQueries.push(url.search);
      let events = all;
      if (q.get("kind")) events = events.filter((e) => e.kind === q.get("kind"));
      if (q.get("severity")) events = events.filter((e) => e.severity === q.get("severity"));
      if (q.get("actor_sub")) events = events.filter((e) => e.actor_sub === q.get("actor_sub"));
      if (q.get("from_seq")) events = events.filter((e) => e.seq >= Number(q.get("from_seq")));
      if (q.get("cursor")) events = events.filter((e) => e.seq > Number(q.get("cursor")));
      const limit = Number(q.get("limit") || 100);
      const rows = events.slice(0, limit);
      return json(200, {
        events: rows,
        next_cursor: rows.length === limit ? rows[rows.length - 1].seq : null,
        count: rows.length,
      });
    }

    jctl.verifyQueries.push(url.search);
    return json(200, {
      ok: true, tenant_id: "00000000-0000-0000-0000-00000000000a",
      from_seq: Number(q.get("from_seq") || 1), to_seq: null,
      events_checked: all.length, last_seq: all.length ? all[all.length - 1].seq : null,
      last_hash: "cafe0042", first_divergence_seq: null, divergence_reason: null,
      expected_hash: null, actual_hash: null,
    });
  });

  return jctl;
}
