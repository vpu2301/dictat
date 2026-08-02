// chat/data/mockClient.js — the fake API this sprint runs on.
//
// There is no backend and no model behind this module. What there is:
//  · ~300–600ms latency, so skeletons are real states and not one-frame flashes;
//  · an async generator that walks the retrieval stages (classify → search →
//    guidelines → synthesise → verify), emits extracted entities, streams the
//    prose, then yields a STRUCTURED answer — the same shape a real
//    evidence pipeline returns, so next sprint swaps the body, not the
//    interface;
//  · failure and emptiness as runtime switches rather than a `const FAIL` you
//    have to edit and rebuild, so every error and empty state is demoable.

import {
  demoPatients, demoSessions, demoAnswers, demoEvidence, fallbackAnswer,
  demoAgents, demoConnectors,
} from "./fixtures.js";

export class MockApiError extends Error {
  constructor(message, { status = 503, code = "mock_failure" } = {}) {
    super(message);
    this.name = "MockApiError";
    this.status = status;
    this.code = code;
  }
}

// The pipeline the UI draws a progress list from. Order matters: the screen
// marks everything before the current stage as done.
export const STAGES = ["classifying", "searching", "guidelines", "synthesizing", "verifying"];

const config = {
  latencyMs: 420,   // jittered ±150ms per call
  chunkMs: 40,      // delay between streamed chunks
  stageMs: 320,     // dwell time per retrieval stage
  fail: false,      // every call rejects → ErrorState
  empty: false,     // every collection comes back empty → EmptyState
};

const listeners = new Set();

export function getMockConfig() { return { ...config }; }

export function setMockConfig(patch) {
  Object.assign(config, patch);
  listeners.forEach((fn) => { try { fn(getMockConfig()); } catch { /* a bad listener must not break the client */ } });
}

export function onMockConfigChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(Math.max(0, config.latencyMs + (Math.random() - 0.5) * 300));
const clone = (v) => JSON.parse(JSON.stringify(v));

async function call(fn, { collection = false } = {}) {
  await latency();
  if (config.fail) throw new MockApiError("Mock backend is unavailable", { status: 503 });
  if (config.empty && collection) return [];
  return fn();
}

// Sessions live in memory for the lifetime of the tab: new threads join the
// history list, and a reload puts the fixtures back. Persisting a chat that
// mentions patients — even fictional ones — is a decision for the sprint that
// has a data-protection review, not this one.
let sessions = clone(demoSessions);

const evidenceById = (id) => demoEvidence.find((e) => e.id === id) || null;

// ── answer selection ──────────────────────────────────────────────────────
// Exported for the tests: this is the demo's core claim (same question, patient
// context changes the answer) and it deserves to be assertable without a UI.
export function pickAnswer(question, patientId) {
  const hit = demoAnswers.find((a) => a.match.test(question || ""));
  const contextual = hit && patientId ? hit.withPatient?.[patientId] : null;
  return contextual || hit?.generic || fallbackAnswer;
}

// Did the script actually have a variant for THIS patient? Since real roster
// patients can now be attached, most of them have none — and an answer that
// keeps saying "no patient context is attached" while a real person's name sits
// in the header is the module lying about what it used.
export function isContextual(question, patientId) {
  if (!patientId) return false;
  const hit = demoAnswers.find((a) => a.match.test(question || ""));
  return !!hit?.withPatient?.[patientId];
}

const UNSCRIPTED_NOTE = {
  en: "A patient is attached, but this demo build has no scripted variant for them — the answer above is the generic one and used none of their data.",
  de: "Ein Patient ist angehängt, für den dieser Demo-Build keine hinterlegte Variante hat — die Antwort oben ist die allgemeine und hat keine Patientendaten verwendet.",
};

export function answerById(id, patientId) {
  const script = demoAnswers.find((a) => a.id === id);
  if (!script) return fallbackAnswer;
  return (patientId && script.withPatient?.[patientId]) || script.generic;
}

const pickLang = (record, field, language) => (
  (language === "de" && record[`${field}De`]) || record[field] || ""
);

// One rule, applied once: the data layer resolves the answer language — for the
// prose AND for the evidence records it cites. The UI then renders whatever it
// is handed, instead of every component re-deciding which language a field is
// in (which is how a German answer ends up citing English source titles).
const shapeCitation = (evidence, language) => {
  if (!evidence) return null;
  const { titleDe, summaryDe, ...rest } = evidence;
  return {
    ...rest,
    title: pickLang(evidence, "title", language),
    summary: pickLang(evidence, "summary", language),
  };
};

// The record the UI renders: language already applied, citations already
// resolved to full evidence records.
export function shapeAnswer(raw, { language = "en", latencyMs = 0, unscripted = false } = {}) {
  const limitations = pickLang(raw, "limitations", language);
  return {
    abstained: !!raw.abstained,
    recommendation: pickLang(raw, "recommendation", language),
    summary: pickLang(raw, "summary", language),
    // Replaces rather than prepends: the generic limitation says "no patient
    // context is attached", which is exactly what stops being true the moment
    // one is. Two sentences contradicting each other is worse than either.
    limitations: unscripted && !raw.abstained
      ? UNSCRIPTED_NOTE[language === "de" ? "de" : "en"]
      : limitations,
    grade: raw.grade ?? null,
    confidence: raw.confidence ?? 0,
    entities: (language === "de" && raw.entitiesDe?.length ? raw.entitiesDe : raw.entities) || [],
    followUps: (language === "de" && raw.followUpsDe?.length ? raw.followUpsDe : raw.followUps) || [],
    citations: (raw.citations || [])
      .map((id) => shapeCitation(clone(evidenceById(id)), language))
      .filter(Boolean),
    latencyMs,
  };
}

// Seeded threads store an answer id; live threads already hold a shaped answer.
const hydrateMessage = (message, session, language) => {
  if (message.role !== "assistant" || !message.answerId) return message;
  const raw = answerById(message.answerId, message.answerFor ?? session.patientId ?? null);
  return { ...message, answer: shapeAnswer(raw, { language, latencyMs: 2400 }) };
};

export const mockClient = {
  getPatients(q = "") {
    return call(() => {
      const needle = String(q).trim().toLowerCase();
      const rows = needle
        ? demoPatients.filter((p) =>
          p.name.toLowerCase().includes(needle)
          || p.diagnoses.some((d) => d.label.toLowerCase().includes(needle) || d.code.toLowerCase().includes(needle)))
        : demoPatients;
      return clone(rows);
    }, { collection: true });
  },

  // Not a collection: `empty` must not turn a real patient into "not found",
  // or the empty switch would be indistinguishable from a bad id.
  getPatient(id) {
    return call(() => clone(demoPatients.find((p) => p.id === id) ?? null));
  },

  getSessions() {
    return call(
      () => clone(sessions)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        // The list carries the patient's NAME, not just the id: a history row
        // whose badge says "pat_01" tells the reader nothing, and making the
        // screen look it up would put fixture knowledge in the UI.
        .map(({ messages, ...row }) => ({
          ...row,
          messageCount: (messages || []).length,
          patientName: row.patientId
            ? (demoPatients.find((p) => p.id === row.patientId)?.name || null)
            : null,
        })),
      { collection: true },
    );
  },

  getSession(id, { language = "en" } = {}) {
    return call(() => {
      const found = sessions.find((s) => s.id === id);
      if (!found) return null;
      const session = clone(found);
      return { ...session, messages: (session.messages || []).map((m) => hydrateMessage(m, session, language)) };
    });
  },

  // Called after each exchange so history reflects what actually happened.
  saveSession(session) {
    const idx = sessions.findIndex((s) => s.id === session.id);
    const row = clone(session);
    if (idx >= 0) sessions[idx] = row; else sessions.unshift(row);
    return row;
  },

  // ── the streaming seam ──────────────────────────────────────────────────
  // Yields, in order:
  //   { stage }                 — retrieval pipeline progress
  //   { entities }              — what the classifier pulled out of the question
  //   { chunk }                 — prose, repeatedly
  //   { done: true, answer }    — the structured, citation-resolved answer
  async *streamAnswer(question, { patientId, language = "en", signal } = {}) {
    const startedAt = Date.now();
    await wait(Math.min(300, config.latencyMs));
    if (config.fail) throw new MockApiError("Mock backend is unavailable", { status: 503 });

    const raw = pickAnswer(question, patientId);
    const shaped = shapeAnswer(raw, {
      language,
      unscripted: !!patientId && !isContextual(question, patientId),
    });

    for (const stage of STAGES) {
      if (signal?.aborted) return;
      yield { stage };
      // Entities are what the classifier extracted; they appear as soon as it
      // has run, not at the end, because they are how the reader sees whether
      // the question was understood at all.
      if (stage === "classifying" && shaped.entities.length) {
        await wait(config.stageMs);
        if (signal?.aborted) return;
        yield { entities: shaped.entities };
      }
      if (stage === "synthesizing") {
        // Chunk on word boundaries: splitting mid-word makes the "typing" read
        // as a corrupted stream rather than an answer being written.
        const prose = [shaped.recommendation, shaped.summary].filter(Boolean).join("\n\n");
        const pieces = prose.match(/\S+\s*/g) || [prose];
        let buffer = "";
        for (const piece of pieces) {
          if (signal?.aborted) return;
          buffer += piece;
          if (buffer.length >= 18) {
            await wait(config.chunkMs);
            if (signal?.aborted) return;
            yield { chunk: buffer };
            buffer = "";
          }
        }
        if (buffer) yield { chunk: buffer };
        continue;
      }
      await wait(config.stageMs);
    }

    if (signal?.aborted) return;
    yield { done: true, answer: { ...shaped, latencyMs: Date.now() - startedAt } };
  },
};

// ── agents & connectors ───────────────────────────────────────────────────
// Both live in memory for the tab: a custom agent survives navigation inside
// the module and is gone on reload, which is exactly what "mock persistence"
// should mean — enough to demo the flow, not enough to pretend it shipped.
let agents = clone(demoAgents);
let connectors = clone(demoConnectors);

Object.assign(mockClient, {
  getAgents() {
    return call(() => clone(agents), { collection: true });
  },

  createAgent(draft) {
    return call(() => {
      const row = {
        id: `agt_${Date.now().toString(36)}`,
        name: String(draft.name || "").trim() || "Untitled agent",
        builtin: false,
        custom: true,
        status: "idle",
        runs: 0,
        scope: draft.scope || "evidence",
        description: String(draft.description || "").trim(),
        sources: draft.sources || [],
        createdAt: new Date().toISOString(),
      };
      agents = [row, ...agents];
      return clone(row);
    });
  },

  deleteAgent(id) {
    return call(() => {
      // Built-ins ship with the product; only what a user made is theirs to remove.
      agents = agents.filter((a) => a.id !== id || a.builtin);
      return { id };
    });
  },

  getConnectors() {
    return call(() => clone(connectors), { collection: true });
  },

  // Connect / disconnect is the only write: "coming soon" rows are not
  // togglable, and saying so beats a switch that silently does nothing.
  setConnectorState(id, connected) {
    return call(() => {
      connectors = connectors.map((c) => (
        c.id === id && c.status !== "coming_soon"
          ? { ...c, status: connected ? "connected" : "available" }
          : c
      ));
      return clone(connectors.find((c) => c.id === id));
    });
  },
});

// Test seam: reset the in-memory stores between runs.
export function __resetSessions() { sessions = clone(demoSessions); }
export function __resetCatalog() { agents = clone(demoAgents); connectors = clone(demoConnectors); }
