// chat/data/platformApi.js — the answer backend this platform actually owns.
//
// `POST {baseUrl}/answers` streams Server-Sent Events from `evidence-answer`
// (:8013). This file turns that stream into the four-part shape the module's
// screens already consume — `{stage}`, `{entities}`, `{chunk}`, `{done, answer}`
// — so nothing above `hooks.js` learns that a network exists, and so the mock
// and the live service stay indistinguishable to `useChat`.
//
// ── Why this exists next to evidenceApi.js ────────────────────────────────
// `evidenceApi.js` speaks a DIFFERENT product's API (EvidenzAI, `POST /query`),
// which the chat borrowed while this platform had no answer service of its own.
// It has one now, and it is the one under the same Keycloak the rest of the app
// uses: no second account, no shared dev credential compiled into the bundle,
// no trust relationship to invent. The other client stays reachable by config
// (see backend.js `dialect`) because the code is sound and someone may still
// have that backend running; it is no longer the default.
//
// ── The wire contract (libs/evidence_models/stream.py, v1) ────────────────
//
//   header → summary_segment* → detail_segment* → source* → late_source* → done
//
// `error` may replace the tail at any point. Deflection is NOT an error: it
// arrives as `done` with `status=deflected` and a `triage` payload.
//
// Two properties worth stating because they shape the code below:
//
//  - The stream carries NO progress events. Stages are derived from the
//    milestones that are observable (see STAGE below) rather than reported.
//  - An `error` can arrive AFTER `done`: `answer_not_persisted` means the
//    answer streamed fine and only its storage failed. Raising that would take
//    a finished answer off the screen, so a post-`done` error is dropped.
//
// ── No custom request headers ─────────────────────────────────────────────
// The service's CORS allow-list is exactly Accept, Accept-Language,
// Authorization, Content-Language, Content-Type. Any header added here that is
// not on that list fails the browser PREFLIGHT, and the POST then never leaves
// the tab — which looks like the backend was never called at all. curl does not
// preflight, so a manual check will not catch it. Add the header there first.

import { readSSE } from "./sse.js";
import { EvidenceApiError } from "./evidenceApi.js";
import { buildAskBody, mapAnswer, segmentText } from "./platformMapping.js";

// The module's five-step progress list against a stream that reports no
// progress. Only the transitions the events genuinely witness are claimed:
// triage runs before the header, retrieval between the header and the first
// segment, and text exists once a segment lands. The two steps in between stay
// pending rather than being ticked off on a guess.
const STAGE = {
  sent: "classifying",
  header: "searching",
  firstSegment: "synthesizing",
};

// Errors the service raises for a transient upstream; re-asking may work.
const RETRYABLE = new Set(["pipeline_failed", "answer_not_persisted", "upstream_unavailable"]);

const NETWORK_COPY = {
  uk: "Не вдалося з’єднатися з доказовим сервісом.",
  en: "Could not reach the evidence service.",
  de: "Der Evidenzdienst ist nicht erreichbar.",
};

const NO_TOKEN_COPY = {
  uk: "Сесія завершилася. Увійдіть знову.",
  en: "The session has expired. Sign in again.",
  de: "Die Sitzung ist abgelaufen. Bitte erneut anmelden.",
};

// The service answers RFC 7807 (`application/problem+json`) on an HTTP-level
// failure, and its stream errors carry `{code, detail}`. Both are read the same
// way: the specific sentence if there is one, the title if there is not.
const messageFor = (body, locale) =>
  body?.detail || body?.message || body?.title || body?.code
  || (locale === "uk" ? "Помилка сервісу." : "Service error.");

const copy = (record, locale) => record[locale] || record.en;

/**
 * Build the answer client.
 *
 * @param {object}   config
 * @param {string}   config.baseUrl   e.g. "http://localhost:8013"
 * @param {Function} config.getToken  `({refresh}) => Promise<string|null>`
 * @param {object}   config.fallback  the client serving everything not wired yet
 * @param {string}   config.locale    UI language, for error and note copy
 * @param {Function} config.fetchImpl injectable for tests
 */
export function createPlatformApi({ baseUrl, getToken, fallback, locale = "en", fetchImpl } = {}) {
  const root = String(baseUrl || "").replace(/\/+$/, "");
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  const bearer = async (refresh = false) => {
    const token = await getToken?.({ refresh });
    if (!token) {
      throw new EvidenceApiError(copy(NO_TOKEN_COPY, locale), { status: 401, code: "missing_token" });
    }
    return token;
  };

  const httpError = async (response) => {
    let body = null;
    try { body = await response.json(); } catch { /* not every failure is JSON */ }
    return new EvidenceApiError(messageFor(body, locale), {
      status: response.status,
      code: body?.code || `http_${response.status}`,
      requestId: body?.instance || null,
      retryable: response.status >= 500 || response.status === 429,
    });
  };

  /**
   * The streaming seam. Yields exactly what the mock yields, in the same order,
   * so `useChat` cannot tell the two apart.
   */
  async function* streamAnswer(question, { patient = null, language = "en", signal } = {}) {
    const startedAt = Date.now();
    const body = JSON.stringify(buildAskBody(question, { language, locale }));

    // A token that expired while the tab sat idle is the ordinary case, not an
    // outage: the first 401 buys one refresh and one retry, exactly like the
    // host's own client does. A second 401 is a real session end.
    const send = async (refresh) => {
      const token = await bearer(refresh);
      try {
        return await doFetch(`${root}/answers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          body,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) return null;
        throw new EvidenceApiError(copy(NETWORK_COPY, locale), {
          status: 0, code: "network", retryable: true,
        });
      }
    };

    yield { stage: STAGE.sent };

    let response = await send(false);
    if (!response) return;                       // aborted mid-flight
    if (response.status === 401) {
      response = await send(true);
      if (!response) return;
    }
    if (!response.ok) throw await httpError(response);

    const state = { header: null, summary: [], detail: [], sources: [], done: null };
    const indexOf = new Map();
    let sawSegment = false;
    let delivered = false;

    const deliver = () => {
      delivered = true;
      return {
        done: true,
        answer: mapAnswer(state, {
          locale,
          latencyMs: Date.now() - startedAt,
          patientAttached: !!patient,
        }),
      };
    };

    for await (const { event, data } of readSSE(response)) {
      if (signal?.aborted) return;

      switch (event) {
        case "header":
          state.header = data?.header || null;
          yield { stage: STAGE.header };
          break;

        case "summary_segment":
        case "detail_segment": {
          const segment = data?.segment;
          if (!segment) break;
          state[event === "summary_segment" ? "summary" : "detail"].push(segment);
          if (!sawSegment) {
            sawSegment = true;
            yield { stage: STAGE.firstSegment };
          }
          // Text as it arrives, so the thread fills in rather than sitting on a
          // spinner until `done`. Markers are resolved against the sources seen
          // SO FAR — sources trail the segments in this contract, so an early
          // chunk may carry fewer chips than the final answer. `done` replaces
          // this text wholesale with the mapped answer, so nothing stays wrong.
          yield { chunk: `${segmentText(segment, indexOf)}\n\n` };
          break;
        }

        case "source":
        case "late_source": {
          const source = data?.source;
          if (!source?.id || indexOf.has(source.id)) break;
          state.sources.push(source);
          indexOf.set(source.id, state.sources.length);
          // A late source landing after `done` still belongs in the answer.
          if (delivered) yield deliver();
          break;
        }

        case "done":
          state.done = data?.done || {};
          yield deliver();
          break;

        case "error": {
          // The answer already streamed; what failed was durability
          // (`answer_not_persisted`). Taking a finished answer off the screen
          // to report that would trade something the clinician can read for
          // something only the service can act on.
          if (delivered) return;
          const payload = data?.error || data || {};
          throw new EvidenceApiError(messageFor(payload, locale), {
            status: 502,
            code: payload.code || "stream_error",
            retryable: payload.retryable === true || RETRYABLE.has(payload.code),
          });
        }

        default:
          break;
      }
    }
  }

  // Closing the connection stops the work; this service has no cancel endpoint
  // and needs none — there is no second device watching the same stream.
  async function cancelStream() { /* the abort already did it */ }

  // Sessions live in this tab, as they do in the mock — but they start EMPTY.
  // `GET /answers/{id}` can reopen one answer; there is no conversation list
  // yet, and seeding History with scripted threads next to real ones would put
  // fiction and fact in the same list with nothing to tell them apart.
  let sessions = [];

  return {
    live: true,
    streamAnswer,
    cancelStream,

    getSessions: async () => sessions
      .slice()
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(({ messages, ...row }) => ({ ...row, messageCount: (messages || []).length })),

    getSession: async (id) => sessions.find((s) => s.id === id) || null,

    saveSession(session) {
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) sessions[idx] = session; else sessions.unshift(session);
      return session;
    },

    // Not served by this API — delegated, so the screens keep working and the
    // gap is visible in one place instead of being scattered through them.
    getPatients: (...a) => fallback.getPatients(...a),
    getPatient: (...a) => fallback.getPatient(...a),
    getAgents: (...a) => fallback.getAgents(...a),
    createAgent: (...a) => fallback.createAgent(...a),
    deleteAgent: (...a) => fallback.deleteAgent(...a),
    getConnectors: (...a) => fallback.getConnectors(...a),
    setConnectorState: (...a) => fallback.setConnectorState(...a),
  };
}
