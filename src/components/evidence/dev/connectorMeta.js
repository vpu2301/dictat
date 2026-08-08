// connectorMeta.js — `connector_meta[]` → the chips ConnectorMetaBar renders.
//
// Per-connector status is the first thing to read when a retrieval result looks
// wrong: three passages instead of ten usually means a connector was
// unavailable, not that the corpus is thin. So each connector gets a chip
// carrying status, count and latency — and the bar never hides a connector
// that returned nothing, which is exactly the one you need to see.

/** Mirrors the ConnectorStatus union in src/types/evidence.d.ts (asserted in the test). */
export const CONNECTOR_STATUSES = ["ok", "degraded", "unavailable"];

const TONE = { ok: "ok", degraded: "warn", unavailable: "bad" };

const STATUS_NOTE = {
  ok: "answered",
  degraded: "answered partially — some engine or page failed",
  unavailable: "did not answer",
};

/** One chip per connector, in the order the service reported them. */
export function connectorChips(connectorMeta) {
  return (connectorMeta || []).map((c) => {
    const status = CONNECTOR_STATUSES.includes(c.status) ? c.status : "unavailable";
    return {
      id: c.connector_id,
      kind: c.kind,
      status,
      tone: TONE[status],
      count: c.count ?? 0,
      latencyMs: c.latency_ms ?? 0,
      // Text, not colour: the chip has to be readable in a screenshot pasted
      // into an issue, and by a screen reader.
      label: `${c.connector_id} · ${c.count ?? 0}`,
      title: `${c.connector_id} (${c.kind}) — ${STATUS_NOTE[status]}; ` +
        `${c.count ?? 0} passage${c.count === 1 ? "" : "s"} in ${c.latency_ms ?? 0} ms`,
    };
  });
}

/**
 * The one-line verdict above the bar.
 *
 * `degraded` on the response is authoritative — the service sets it — but a
 * response can also carry a non-ok connector without the flag (a connector
 * that returned nothing while others succeeded is not necessarily a degraded
 * answer). Both are reported, and they are reported separately, because
 * "the service says this answer is incomplete" and "one source was quiet" are
 * different things to act on.
 */
export function connectorSummary(response) {
  const chips = connectorChips(response?.connector_meta);
  const failing = chips.filter((c) => c.status !== "ok");
  return {
    chips,
    total: chips.length,
    passages: chips.reduce((n, c) => n + c.count, 0),
    slowestMs: chips.reduce((ms, c) => Math.max(ms, c.latencyMs), 0),
    failing,
    degraded: !!response?.degraded,
    // A banner is warranted by either signal.
    warn: !!response?.degraded || failing.length > 0,
    headline: bannerText(!!response?.degraded, failing),
  };
}

function bannerText(degraded, failing) {
  if (!degraded && failing.length === 0) return "";
  const names = failing.map((c) => `${c.id} (${c.status})`).join(", ");
  if (degraded && failing.length) {
    return `Degraded result — these passages are what came back without ${names}.`;
  }
  if (degraded) return "Degraded result — the service answered on a reduced set of engines.";
  return `Complete result, but ${names} contributed nothing.`;
}
