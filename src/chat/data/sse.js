// chat/data/sse.js — reading a `text/event-stream` off a POST response.
//
// The native `EventSource` is GET-only and cannot set an Authorization header,
// so the answer stream is a `fetch` whose body we read as it arrives. That
// makes the frame parsing ours, which is fine: the format is small, and having
// it as a pure function means the whole taxonomy — comments, multi-line data,
// CRLF, a frame split across two network chunks — is testable without a socket.
//
// Two pieces, deliberately separate:
//   `feedSSE`  — pure: (buffer + new text) → [frames, remainder]
//   `readSSE`  — the async generator over a Response body that uses it

const FRAME_SEPARATOR = /\r?\n\r?\n/;

/**
 * Split whatever has arrived into complete frames plus the incomplete tail.
 * The tail is carried into the next call — a frame boundary lands mid-chunk
 * far more often than not, and a parser that assumes otherwise drops tokens
 * at random under load.
 */
export function feedSSE(buffer, text = "") {
  const combined = buffer + text;
  const parts = combined.split(FRAME_SEPARATOR);
  // The last part is either an incomplete frame or "" when the chunk ended on
  // a boundary. Either way it is not ready to emit.
  const rest = parts.pop() ?? "";
  const events = [];
  for (const raw of parts) {
    const frame = parseFrame(raw);
    if (frame) events.push(frame);
  }
  return { events, rest };
}

/**
 * One raw frame → `{ event, data }`, or null for a heartbeat comment.
 *
 * Per the spec a line starting with ":" is a comment; the backend sends
 * `: heartbeat <iso>` every 15s to keep proxies from idling the connection,
 * and app logic must not see those as events.
 */
export function parseFrame(raw) {
  const lines = String(raw).split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) return null;
  let event = "message";
  const data = [];
  let sawField = false;
  for (const line of lines) {
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // "data: x" and "data:x" are both legal — one leading space is stripped.
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") { event = value.trim(); sawField = true; }
    else if (field === "data") { data.push(value); sawField = true; }
    else if (field === "id" || field === "retry") sawField = true;
  }
  if (!sawField) return null;
  const payload = data.join("\n");
  let parsed = {};
  if (payload) {
    try {
      parsed = JSON.parse(payload);
    } catch {
      // A frame whose data is not JSON is not something this client can act
      // on. Surfacing it as `{}` would be a silent lie about an empty event,
      // so it carries the raw text and the consumer decides.
      parsed = { raw: payload };
    }
  }
  return { event, data: parsed };
}

/**
 * Yield `{ event, data }` for each frame of a streaming Response until the
 * body ends. Cancellation is the caller's `AbortSignal` on the original fetch:
 * aborting rejects the read, which ends the generator.
 */
export async function* readSSE(response) {
  const body = response?.body;
  if (!body || typeof body.getReader !== "function") {
    // No streaming body (a mocked fetch, an old browser). Reading it whole
    // still produces every frame — just not progressively.
    const text = await response.text();
    const { events } = feedSSE("", `${text}\n\n`);
    for (const evt of events) yield evt;
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const { events, rest } = feedSSE(buffer, decoder.decode(value, { stream: true }));
      buffer = rest;
      for (const evt of events) yield evt;
    }
    // A server that closed without a trailing blank line still owes us its
    // last frame.
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    // Releasing matters on the abort path: the fetch is already cancelled and
    // the reader must not stay attached to a dead body.
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
