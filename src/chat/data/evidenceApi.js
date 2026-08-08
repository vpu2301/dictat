// chat/data/evidenceApi.js — the real answer backend.
//
// One endpoint does the work: `POST {baseUrl}/api/v1/query` streams
// Server-Sent Events (contract: the backend's docs/sse-contract.md, locked as
// of its Sprint 10). This file turns that stream into the four-part shape the
// module's screens already consume — `{stage}`, `{entities}`, `{chunk}`,
// `{done, answer}` — so nothing above `hooks.js` learns that a network exists.
//
// Configuration arrives from the host adapter, never from `import.meta.env`
// here: the embed contract says this module reads no host globals, and a base
// URL is host knowledge. `getToken()` is the whole auth story from the module's
// side — how the host obtains that token (a service login, a token exchange, a
// per-clinician sign-in) is its business and can change without touching this.
//
// What is NOT wired here, and is left on the fallback client on purpose:
// patients (the host's roster reaches the module through `onSearchPatients`),
// agents, connectors and saved history. Each is a separate endpoint family;
// this pass is the answer path.

import { readSSE } from "./sse.js";
import { mapQueryResponse, toPatientContext } from "./answerMapping.js";

export class EvidenceApiError extends Error {
  constructor(message, { status = 0, code = "error", requestId = null, retryable = false } = {}) {
    super(message);
    this.name = "EvidenceApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

// The module's stage list is five steps (see StageProgress); the API emits
// seven. The two extra ones are folded into the step a reader would recognise
// them as, rather than being dropped — a progress list that stops moving while
// the pipeline is busy reads as a hang.
const STAGE_MAP = {
  classifying: "classifying",
  searching: "searching",
  drugs: "searching",
  guidelines: "guidelines",
  synthesizing: "synthesizing",
  verifying: "verifying",
  formatting: "verifying",
};

// Ukrainian copy for the typed error codes. The API ships DE and EN; this
// module is used in Ukrainian, and a German sentence in a Ukrainian UI is not
// an error message, it is a second problem.
const ERROR_UK = {
  hf_timeout: "Модель не відповіла вчасно. Спробуйте ще раз.",
  hf_rate_limited: "Забагато запитів до моделі. Спробуйте за мить.",
  hf_permanent: "Модель наразі недоступна.",
  retrieval_timeout: "Пошук доказів тривав задовго. Спробуйте ще раз.",
  internal: "Внутрішня помилка сервера. Спробуйте ще раз.",
  cancelled: "Запит скасовано.",
  upstream_unavailable: "Суміжний сервіс недоступний. Спробуйте пізніше.",
  stream_limit_exceeded: "Забагато одночасних запитів. Дочекайтеся завершення попереднього.",
  missing_token: "Немає доступу до сервісу доказів.",
  token_expired: "Сесія доказового сервісу завершилася.",
};

// Retry is offered for the failures a retry can actually fix. Offering it for
// an auth or validation error trains the reader to click a button that will
// never work.
const RETRYABLE = new Set([
  "hf_timeout", "hf_rate_limited", "retrieval_timeout", "internal", "upstream_unavailable",
]);

const messageFor = (data, locale) => {
  const code = data?.code || "internal";
  if (locale === "uk" && ERROR_UK[code]) return ERROR_UK[code];
  if (locale === "de" && data?.message_de) return data.message_de;
  return data?.message_en || data?.message_de || data?.message || code;
};

const uuid = () => (
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    // A fallback only for environments without WebCrypto. The value is an
    // idempotency key, not a secret — it must be unique, not unguessable.
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
);

/**
 * Build the answer client.
 *
 * @param {object}   config
 * @param {string}   config.baseUrl   e.g. "http://localhost:8000" (no trailing /api/v1)
 * @param {Function} config.getToken  `() => Promise<string>` — a bearer token
 * @param {object}   config.fallback  the client serving everything not wired yet
 * @param {string}   config.locale    UI language, for error copy
 * @param {Function} config.fetchImpl injectable for tests
 */
export function createEvidenceApi({ baseUrl, getToken, fallback, locale = "en", fetchImpl } = {}) {
  const root = String(baseUrl || "").replace(/\/+$/, "");
  const api = (path) => `${root}/api/v1${path}`;
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  const authHeaders = async () => {
    const token = await getToken();
    if (!token) {
      throw new EvidenceApiError(
        locale === "uk"
          ? "Доказовий сервіс не під’єднано."
          : "The evidence service is not connected.",
        { status: 401, code: "missing_token" },
      );
    }
    return { Authorization: `Bearer ${token}` };
  };

  // An HTTP-level failure (before any frame arrives) uses the uniform ApiError
  // envelope. Reading it is worth the try/catch: the difference between "you
  // are over the concurrency cap" and "the service is down" is the difference
  // between waiting five seconds and calling someone.
  const httpError = async (response) => {
    let body = null;
    try { body = await response.json(); } catch { /* not every failure is JSON */ }
    return new EvidenceApiError(messageFor(body, locale), {
      status: response.status,
      code: body?.code || `http_${response.status}`,
      requestId: body?.request_id || null,
      retryable: response.status >= 500 || response.status === 429,
    });
  };

  /**
   * The streaming seam. Yields exactly what the mock yields, in the same
   * order, so `useChat` cannot tell the two apart.
   */
  async function* streamAnswer(question, { patient = null, language = "en", signal } = {}) {
    const startedAt = Date.now();
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": uuid(),
      ...(await authHeaders()),
    };

    // The answer language is a module setting and the API takes de|en only.
    // A Ukrainian UI reading an English answer is the honest state; claiming a
    // language the pipeline cannot write in would not be.
    const body = {
      query: String(question || "").trim(),
      mode: "quick_answer",
      language: language === "de" ? "de" : "en",
    };
    // Everything the patient contributes goes through one whitelist — see
    // toPatientContext(). No name, no MRN, no date of birth leaves the browser.
    const context = toPatientContext(patient, { language });
    if (context) body.patient_context = context;

    let response;
    try {
      response = await doFetch(api("/query"), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) return;
      throw new EvidenceApiError(
        locale === "uk" ? "Не вдалося з’єднатися з доказовим сервісом." : "Could not reach the evidence service.",
        { status: 0, code: "network", retryable: true },
      );
    }

    if (!response.ok) throw await httpError(response);

    let entities = [];
    let streamId = null;
    let delivered = false;

    for await (const { event, data } of readSSE(response)) {
      if (signal?.aborted) return;

      switch (event) {
        case "stream_started":
          streamId = data.stream_id || null;
          break;

        case "status": {
          const stage = STAGE_MAP[data.stage];
          if (stage) yield { stage };
          break;
        }

        case "metadata":
          entities = Array.isArray(data.entities) ? data.entities.filter(Boolean) : [];
          if (entities.length) yield { entities };
          break;

        case "partial":
          // Deltas are concatenated by the reducer exactly as they arrive; the
          // contract guarantees the concatenation equals `final.answer_md`.
          if (data.delta) yield { chunk: data.delta };
          break;

        case "final": {
          const answer = mapQueryResponse(data.response, {
            entities,
            locale,
            latencyMs: Date.now() - startedAt,
          });
          delivered = true;
          yield { done: true, answer, streamId };
          break;
        }

        case "error": {
          // `cancelled` is the user's own stop reaching us the long way round
          // (another device, or our own /cancel). It is not a failure to
          // report — the thread already shows the stopped state.
          if (data.code === "cancelled") return;
          // An `abstained` code always rides alongside a `final` that carried
          // the abstention; if the final already landed there is nothing to
          // raise.
          if (data.code === "abstained" && delivered) return;
          throw new EvidenceApiError(messageFor(data, locale), {
            status: 502,
            code: data.code || "internal",
            requestId: data.request_id || null,
            retryable: RETRYABLE.has(data.code),
          });
        }

        case "done":
          return;

        default:
          break;
      }
    }
  }

  /**
   * Cross-device cancel. Closing the connection already stops the work; this
   * is for the case where the stream is being watched somewhere else. Failure
   * is deliberately silent — the local abort has already happened and the user
   * has moved on.
   */
  async function cancelStream(streamId) {
    if (!streamId) return;
    try {
      await doFetch(api(`/query/${streamId}/cancel`), { method: "POST", headers: await authHeaders() });
    } catch { /* best effort */ }
  }

  // Sessions live in this tab, as they do in the mock — but they start EMPTY.
  // The backend has a conversations API this pass does not wire, and seeding
  // History with scripted threads next to real answers would put fiction and
  // fact in the same list with nothing to tell them apart.
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

    // Not wired in this pass — delegated, so the screens keep working and the
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
