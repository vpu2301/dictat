// sseServer.js — a REAL server-sent-event server for the answer specs (EVA-S04).
//
// WHY NOT `page.route`. Playwright's `route.fulfill` delivers a body
// atomically: the whole response lands in one piece, at one moment. That is
// fine for JSON and useless here, because every property this sprint's answer
// screen is built around is a property of PARTIAL delivery —
//
//   · the summary shimmer, which exists only before the first segment
//   · the ask box disabled while one question is in flight
//   · the "checking current web sources…" chip, which by definition shows
//     while some sources have arrived and others have not
//   · a connection that DROPS mid-answer, which is the whole reason the
//     resume path exists
//
// …and a mock that hands over the finished stream tests none of them while
// passing. So this is an actual HTTP server on the port `services.js` points
// evidence-answer at, writing frames when the test says to.
//
// It is deliberately dumb: no routing framework, no state machine. Each test
// installs a `handler` and the server calls it with a small writer.

import { createServer } from "node:http";

export const ANSWER_PORT = 8013;
const ORIGIN = "http://localhost:5173";

/** CORS for a credentialed cross-origin fetch — which is what client.js sends. */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(null); }
    });
  });

/**
 * Start the server. Returns a control object whose `handler` each test
 * replaces, plus the recorded calls.
 *
 *   const srv = await startAnswerServer();
 *   srv.handler = async (ctx) => { await ctx.send("meta", {…}); ctx.end(); };
 *   …
 *   await srv.close();
 */
export async function startAnswerServer() {
  const calls = { asks: [], gets: [], questions: [], suggestions: [] };
  const control = {
    calls,
    /** POST /answers — set per test. */
    handler: null,
    /** GET /answers/:id — set per test. */
    answer: null,
    /** GET /questions — set per test. */
    questions: null,
    /** GET /suggestions — set per test. */
    suggestions: null,
  };

  const server = createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    const url = new URL(req.url, `http://localhost:${ANSWER_PORT}`);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/answers" && req.method === "POST") {
      const body = await readBody(req);
      calls.asks.push(body);
      // Contract enforcement, mirroring the service. A permissive fake would
      // let a broken request pass here and fail in integration.
      if (!body?.question || typeof body.question !== "string") {
        return json(422, { title: "Unprocessable Content", detail: "question is required" });
      }
      if (body.mode && body.mode !== "quick") {
        return json(422, { title: "Unprocessable Content", detail: `unknown mode ${body.mode}` });
      }

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const ctx = {
        body,
        call: calls.asks.length,
        /** Write one frame and flush it. */
        send: (event, data) =>
          new Promise((resolve) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`, resolve);
          }),
        /** A keepalive comment — proves the parser ignores them. */
        keepalive: () => new Promise((resolve) => res.write(": keepalive\n\n", resolve)),
        /** Close cleanly. */
        end: () => res.end(),
        /** Kill the socket mid-stream: the drop this UI has to survive. */
        drop: () => res.destroy(),
      };
      try {
        await (control.handler ? control.handler(ctx) : ctx.end());
      } catch {
        try { res.destroy(); } catch { /* already gone */ }
      }
      return undefined;
    }

    const answerMatch = /^\/answers\/(.+)$/.exec(url.pathname);
    if (answerMatch && req.method === "GET") {
      const id = decodeURIComponent(answerMatch[1]);
      calls.gets.push(id);
      const out = control.answer ? control.answer(id) : null;
      if (!out) return json(404, { title: "Not Found", detail: id });
      // `httpStatus`, not `status` — an AnswerEnvelope HAS a `status` field
      // and its value is "ok", which is not a number and not an HTTP code.
      return json(out.httpStatus || 200, out.httpStatus ? out.body : out);
    }

    if (url.pathname === "/questions" && req.method === "GET") {
      calls.questions.push(url.searchParams.get("cursor"));
      return json(200, control.questions ? control.questions(url.searchParams.get("cursor")) : { questions: [], next_cursor: null });
    }

    if (url.pathname === "/suggestions" && req.method === "GET") {
      calls.suggestions.push(url.searchParams.get("specialty"));
      if (!control.suggestions) return json(404, { title: "Not Found" });
      return json(200, control.suggestions());
    }

    return json(404, { title: "Not Found", detail: url.pathname });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(ANSWER_PORT, "127.0.0.1", resolve);
  });

  control.reset = () => {
    calls.asks.length = 0;
    calls.gets.length = 0;
    calls.questions.length = 0;
    calls.suggestions.length = 0;
    control.handler = null;
    control.answer = null;
    control.questions = null;
    control.suggestions = null;
  };
  control.close = () =>
    new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    });

  return control;
}
