// Sprint 10 step 04 — client telemetry sink: batched, joinable, privacy-bounded.
//
// The learning loop's FE half: report faithfully (every show/accept/dismiss),
// cheaply (client-side coalescing + queued sequential flushes — the wire is
// ONE event per POST, there is no batch payload), and narrowly (the outbound
// serializer WHITELISTS fields; nothing beyond what the suggest call already
// sent ever leaves the editor).
//
// Event ↔ id mapping (matches the as-built backend roll-up, which counts
// impressions by phrase_id across shown_only/accepted/rejected rows):
//   shown_only  → id of the TOP suggestion (the impression being recorded)
//   accepted    → id of the accepted suggestion (phrase_id XOR snippet_id)
//   rejected    → no ids (its impression was already logged by shown_only —
//                 an id here would double-count)
//
// Telemetry loss is acceptable; typing impact is not. Failures are silent:
// one retry per item, then a 30 s circuit pause while the queue keeps
// bounded-dropping.

import { sendTelemetry } from "../api/autocomplete.js";

export const FLUSH_INTERVAL_MS = 2_000;
export const FLUSH_TRIGGER = 10;
export const MAX_QUEUE = 200;
export const CIRCUIT_PAUSE_MS = 30_000;
const MAX_SEEN = 500; // shown_only dedup memory cap

export function createTelemetrySink({
  send = (event, init) => sendTelemetry(event, init),
  setTimeoutFn = (...a) => setTimeout(...a),
  clearTimeoutFn = (t) => clearTimeout(t),
  now = () => Date.now(),
} = {}) {
  const queue = [];
  const shownSeen = new Set();
  let timer = null;
  let flushing = false;
  let circuitUntil = 0;

  // Outbound WHITELIST — the privacy budget. context is at most
  // { field, index }: never preceding_text, never document text, never
  // patient identifiers, never suggestion text (the backend has it by id).
  function sanitize(raw) {
    // Sprint 15: `source` splits corpus autocomplete from Layer C generated
    // ghost text. The backend defaults it to 'autocomplete', so the key only
    // goes on the wire for layer_c — pre-S15 events stay byte-identical.
    const isLayerC = raw.source === "layer_c";
    const out = {
      request_id: raw.request_id,
      event: raw.event,
      // byte-identical to what suggest sent (≤ 80 there; 200 wire cap is
      // headroom, not an invitation)
      prefix: String(raw.prefix ?? "").slice(0, 80),
    };
    if (isLayerC) out.source = "layer_c";
    // A completion is NOT a corpus row. The backend 422s a layer_c event
    // carrying either id (it would corrupt the phrase counters the roll-up
    // maintains) — so the whitelist drops them here, at the source.
    if (!isLayerC && (raw.event === "accepted" || raw.event === "shown_only")) {
      if (raw.phrase_id) out.phrase_id = raw.phrase_id;
      else if (raw.snippet_id) out.snippet_id = raw.snippet_id;
    }
    const ctx = {};
    if (raw.context && raw.context.field != null) ctx.field = String(raw.context.field);
    if (raw.event === "accepted" && Number.isInteger(raw.context?.index)) {
      ctx.index = raw.context.index;
    }
    // Layer C dismissal reason — a closed enum of non-PHI words ('input',
    // 'key', 'blur', 'expired'). It is the only way to tell "the clinician
    // typed through it" from "it timed out on screen", which is the whole
    // tuning signal for the settle/staleness budgets.
    if (isLayerC && typeof raw.context?.reason === "string") {
      ctx.reason = raw.context.reason.slice(0, 16);
    }
    if (Object.keys(ctx).length) out.context = ctx;
    return out;
  }

  function schedule(delayMs) {
    if (timer !== null) {
      if (delayMs > 0) return; // an earlier-or-equal timer is already armed
      clearTimeoutFn(timer); // upgrade the pending interval timer to NOW
      timer = null;
    }
    timer = setTimeoutFn(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  function track(raw) {
    if (!raw || !raw.request_id || !raw.event) return;
    if (raw.event === "shown_only") {
      // At most ONE shown_only per request_id (arrow-cycling is not a new
      // show; joinability survives memo-served responses because the hook
      // reports the response's ORIGINAL request_id).
      if (shownSeen.has(raw.request_id)) return;
      shownSeen.add(raw.request_id);
      if (shownSeen.size > MAX_SEEN) {
        shownSeen.delete(shownSeen.values().next().value);
      }
    }
    if (raw.event === "accepted") {
      // An accept supersedes the pending rejected for the same request.
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].event === "rejected" && queue[i].request_id === raw.request_id) {
          queue.splice(i, 1);
        }
      }
    }
    queue.push(sanitize(raw));
    while (queue.length > MAX_QUEUE) queue.shift(); // bounded, drop-oldest
    schedule(queue.length >= FLUSH_TRIGGER ? 0 : FLUSH_INTERVAL_MS);
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (queue.length) {
        if (now() < circuitUntil) break; // circuit open — try again later
        const item = queue[0];
        try {
          await send(item);
        } catch {
          try {
            await send(item); // one retry of the current item
          } catch {
            circuitUntil = now() + CIRCUIT_PAUSE_MS;
            break;
          }
        }
        queue.shift();
      }
    } finally {
      flushing = false;
      if (queue.length) {
        schedule(Math.max(FLUSH_INTERVAL_MS, circuitUntil - now()));
      }
    }
  }

  // Page hidden / unloading: flush the remainder with fetch keepalive.
  // Deliberately NOT navigator.sendBeacon — a beacon cannot carry the
  // Authorization header, so the backend would 401 every event. keepalive
  // fetch survives the page teardown AND keeps the bearer.
  function flushRemainderKeepalive() {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
    while (queue.length) {
      const item = queue.shift();
      try {
        void send(item, { keepalive: true }).catch?.(() => {});
      } catch {
        /* ignore — telemetry loss is acceptable */
      }
    }
  }

  function dispose() {
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
    queue.length = 0;
  }

  return { track, flush, flushRemainderKeepalive, dispose, queue };
}

// App singleton, wired to the page lifecycle (browser only).
export const telemetry = createTelemetrySink();

if (typeof document !== "undefined" && typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") telemetry.flushRemainderKeepalive();
  });
  window.addEventListener("pagehide", () => telemetry.flushRemainderKeepalive());
}
