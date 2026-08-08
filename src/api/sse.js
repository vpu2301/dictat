// sse.js — a Server-Sent Events frame parser (EVA-S04).
//
// WHY THIS EXISTS AND `EventSource` DOES NOT. `EventSource` cannot carry a
// header, and this platform's auth is a bearer token in memory (client.js) —
// never a cookie a browser would attach on its own, never a token in a query
// string a proxy would log. So the answer stream is an ordinary `fetch` whose
// body is read as it arrives, and the wire format is still SSE because that is
// what the backend speaks and what survives a reverse proxy unbuffered.
//
// The parser is a PURE state machine over strings: no fetch, no DOM, no timers.
// That is deliberate — every awkward property of a byte stream (a frame split
// across two chunks, CRLF line endings, multi-line `data:`, comment keepalives)
// is asserted in `node --test` rather than discovered in a clinic.
//
// Frame grammar (RFC-ish subset, which is all any server here emits):
//
//     event: segment
//     data: {"kind":"evidence", …}
//     id: 17
//     <blank line dispatches>
//
// A line starting `:` is a comment — servers send those as keepalives through
// idle proxies, and they must not dispatch an event.

/** What one dispatched frame looks like. `data` is the raw text, unparsed. */
const emptyFrame = () => ({ event: "", data: [], id: null, retry: null });

/**
 * Incremental parser. Feed it decoded text; it returns the frames that
 * completed inside that chunk.
 *
 *   const p = createSseParser();
 *   p.push("event: seg\nda");   // → []       (frame incomplete)
 *   p.push("ta: {}\n\n");       // → [{event:"seg", data:"{}"}]
 *   p.flush();                  // → any frame left un-terminated at EOF
 */
export function createSseParser() {
  let buffer = "";
  let frame = emptyFrame();

  const dispatch = (out) => {
    // A frame that carried no `data:` line is a bare comment or a lone `id:`
    // — real SSE traffic, but nothing an application should see.
    if (frame.data.length === 0 && !frame.event) {
      frame = emptyFrame();
      return;
    }
    out.push({
      event: frame.event || "message",
      // Multi-line data joins on "\n" per spec: a JSON payload pretty-printed
      // by a debugging proxy still parses.
      data: frame.data.join("\n"),
      id: frame.id,
      retry: frame.retry,
    });
    frame = emptyFrame();
  };

  const consumeLine = (line, out) => {
    if (line === "") return dispatch(out);
    if (line.startsWith(":")) return;             // comment / keepalive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // Exactly one leading space after the colon is part of the framing, not
    // the value. Two spaces means the second one is data.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") frame.event = value;
    else if (field === "data") frame.data.push(value);
    else if (field === "id") frame.id = value;
    else if (field === "retry") {
      const ms = Number.parseInt(value, 10);
      if (Number.isFinite(ms)) frame.retry = ms;
    }
    // Unknown fields are ignored, which is what lets the backend add one.
  };

  return {
    push(chunk) {
      const out = [];
      // Normalise line endings first: a proxy that rewrites LF to CRLF must
      // not turn every frame into one with a trailing "\r" on its value.
      buffer += String(chunk).replace(/\r\n?/g, "\n");
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        consumeLine(line, out);
      }
      return out;
    },
    /** End of stream: a final frame with no terminating blank line still counts. */
    flush() {
      const out = [];
      if (buffer) {
        consumeLine(buffer, out);
        buffer = "";
      }
      dispatch(out);
      return out;
    },
  };
}

/**
 * Read a `fetch` Response body as SSE, calling `onFrame` per frame.
 *
 * Resolves when the server closes the stream. An aborted stream resolves too
 * rather than throwing: "the user navigated away" and "the connection dropped"
 * are the caller's states to tell apart, and it already knows which one it
 * caused. A genuine mid-stream network failure rejects.
 */
export async function readSseStream(response, onFrame, { signal } = {}) {
  const body = response && response.body;
  if (!body || typeof body.getReader !== "function") {
    // No streaming body (a mock, a proxy that buffered, an ancient browser):
    // fall back to the whole text at once. Same frames, no progressive paint.
    const parser = createSseParser();
    const text = await response.text();
    for (const f of parser.push(text)) onFrame(f);
    for (const f of parser.flush()) onFrame(f);
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const onAbort = () => { try { reader.cancel(); } catch { /* already closed */ } };
  if (signal) {
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // `stream: true` keeps a multi-byte character split across two chunks
      // intact — Cyrillic answer text makes that a certainty, not an edge case.
      for (const f of parser.push(decoder.decode(value, { stream: true }))) onFrame(f);
    }
    for (const f of parser.flush()) onFrame(f);
  } catch (e) {
    if (signal?.aborted) return;
    throw e;
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
