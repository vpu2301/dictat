// chat/data/hooks.js — the seam.
//
// Screens call these. Screens never call a client directly and never see a
// fetch or a stream. Which client answers is decided once at mount, in
// `backend.js`: the mock when the module is embedded without a backend, the
// real evidence API when the host configured one. That swap happened here and
// nowhere above — the streaming interface was built to match, and it did.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getClient } from "./backend.js";
import { demoPrompts } from "./fixtures.js";
import { useQuery } from "./useQuery.js";

// Openers for an empty thread. They live behind the data layer with everything
// else the demo script owns, so a screen never has to know the fixtures exist.
export function suggestedPrompts(language = "en") {
  return demoPrompts.map((p) => (language === "de" ? p.de : p.en));
}

// The patient roster. `source` is the host's own search when it gave us one
// (`onSearchPatients`) — that is how REAL patients reach the import dialog.
// Without it the module falls back to its fixtures, which is what the harness
// and any host without a roster get.
export function usePatients(search = "", source = null) {
  return useQuery(
    `patients:${source ? "host" : "mock"}:${search}`,
    () => (source ? source(search) : getClient().getPatients(search)),
  );
}

export function useAgents() {
  return useQuery("agents", () => getClient().getAgents());
}

export function useConnectors() {
  return useQuery("connectors", () => getClient().getConnectors());
}

// Writes go straight to the client and the caller refetches: with four rows on
// screen, optimistic updates would be more machinery than the flow deserves.
export function createAgent(draft) { return getClient().createAgent(draft); }
export function deleteAgent(id) { return getClient().deleteAgent(id); }
export function setConnectorState(id, connected) { return getClient().setConnectorState(id, connected); }

export function useSessions() {
  return useQuery("sessions", () => getClient().getSessions());
}

export function useSessionDetail(id, language = "en") {
  return useQuery(
    `session:${id}:${language}`,
    () => getClient().getSession(id, { language }),
    { enabled: !!id },
  );
}

// Not a hook: resuming a session needs one patient by id at a moment that isn't
// a render. Kept here so the embed never has to reach for the client itself.
export function fetchPatient(id) {
  return getClient().getPatient(id);
}

// ── the chat thread ───────────────────────────────────────────────────────
//
// Thread state is a reducer rather than a state library: a chat is a sequence
// of well-named transitions (user asked, the pipeline reached a stage, tokens
// arrived, an answer landed, the user pressed stop), and that is exactly what a
// reducer is for. Adding Zustand here would add a dependency without adding a
// concept.

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const initialState = { sessionId: null, title: null, messages: [], streaming: false, error: null };

const patch = (messages, id, fields) => messages.map((m) => (m.id === id ? { ...m, ...fields } : m));

function reducer(state, action) {
  switch (action.type) {
    case "reset":
      return { ...initialState, sessionId: uid("ses") };

    case "load":
      return {
        sessionId: action.session.id,
        title: action.session.title,
        messages: action.session.messages || [],
        streaming: false,
        error: null,
      };

    case "ask":
      return {
        ...state,
        sessionId: state.sessionId || uid("ses"),
        title: state.title || action.title,
        error: null,
        streaming: true,
        messages: [
          ...state.messages,
          { id: action.userId, role: "user", text: action.text },
          {
            id: action.answerId, role: "assistant", text: "", answer: null,
            status: "streaming", stage: null, entities: [], question: action.text,
          },
        ],
      };

    // Regenerate re-asks the last question: the old answer is dropped rather
    // than kept alongside, so the thread never shows two answers to one
    // question and leaves the reader to guess which one counts.
    case "retry":
      return {
        ...state,
        error: null,
        streaming: true,
        messages: [
          ...state.messages.slice(0, action.index),
          {
            id: action.answerId, role: "assistant", text: "", answer: null,
            status: "streaming", stage: null, entities: [], question: action.question,
          },
        ],
      };

    case "stage":
      return { ...state, messages: patch(state.messages, action.id, { stage: action.stage }) };

    case "entities":
      return { ...state, messages: patch(state.messages, action.id, { entities: action.entities }) };

    case "chunk":
      return {
        ...state,
        messages: state.messages.map((m) => (
          m.id === action.id ? { ...m, text: m.text + action.chunk } : m
        )),
      };

    case "done":
      return {
        ...state,
        streaming: false,
        messages: patch(state.messages, action.id, { answer: action.answer, status: "done", stage: null }),
      };

    case "stopped":
      return { ...state, streaming: false, messages: patch(state.messages, action.id, { status: "stopped" }) };

    case "failed":
      return {
        ...state,
        streaming: false,
        error: action.error,
        messages: patch(state.messages, action.id, { status: "error" }),
      };

    default:
      return state;
  }
}

const titleFrom = (text) => {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
};

// `patient` is the whole record and `patientId` the key the thread is saved
// under. Both, because the mock selects its scripted variant by id while the
// real API takes a de-identified context built from the record — and the
// record must never be reconstructed from an id inside the data layer.
export function useChat({ patientId = null, patient = null, language = "en", onEvent } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef(null);
  const emitRef = useRef(onEvent);
  emitRef.current = onEvent;

  // Latest thread, for the save-on-completion path — reading it out of the
  // closure would persist the state as it was when the send started.
  const stateRef = useRef(state);
  stateRef.current = state;

  const emit = (evt) => { if (emitRef.current) emitRef.current(evt); };

  // Abort any in-flight generation when the component goes away, or the stream
  // keeps writing into a thread nobody is looking at.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const persist = useCallback((patientForSession) => {
    const s = stateRef.current;
    if (!s.sessionId || !s.messages.length) return;
    getClient().saveSession({
      id: s.sessionId,
      title: s.title || titleFrom(s.messages[0]?.text || "Chat"),
      patientId: patientForSession,
      updatedAt: new Date().toISOString(),
      messages: s.messages,
    });
  }, []);

  const run = useCallback(async (question, answerId) => {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const stream = getClient().streamAnswer(question, {
        patientId, patient, language, signal: controller.signal,
      });
      let finished = false;
      for await (const part of stream) {
        if (controller.signal.aborted) break;
        if (part.stage) dispatch({ type: "stage", id: answerId, stage: part.stage });
        if (part.entities) dispatch({ type: "entities", id: answerId, entities: part.entities });
        if (part.chunk) dispatch({ type: "chunk", id: answerId, chunk: part.chunk });
        if (part.done) {
          finished = true;
          dispatch({ type: "done", id: answerId, answer: part.answer });
          emit({
            name: "answer_completed",
            patientAttached: !!patientId,
            citations: part.answer?.citations?.length || 0,
            abstained: !!part.answer?.abstained,
          });
        }
      }
      if (!finished) {
        dispatch({ type: "stopped", id: answerId });
        emit({ name: "answer_stopped" });
      }
      persist(patientId);
    } catch (error) {
      dispatch({ type: "failed", id: answerId, error });
      emit({ name: "answer_failed", status: error?.status });
    } finally {
      abortRef.current = null;
    }
  }, [patientId, patient, language, persist]);

  const send = useCallback((text) => {
    const question = String(text || "").trim();
    if (!question || stateRef.current.streaming) return;
    const answerId = uid("msg");
    dispatch({ type: "ask", text: question, userId: uid("msg"), answerId, title: titleFrom(question) });
    emit({ name: "message_sent", patientAttached: !!patientId, length: question.length });
    run(question, answerId);
  }, [run, patientId]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  const regenerate = useCallback(() => {
    const s = stateRef.current;
    if (s.streaming) return;
    const lastAssistant = [...s.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const index = s.messages.findIndex((m) => m.id === lastAssistant.id);
    const question = lastAssistant.question
      || [...s.messages.slice(0, index)].reverse().find((m) => m.role === "user")?.text;
    if (!question) return;
    const answerId = uid("msg");
    dispatch({ type: "retry", index, answerId, question });
    emit({ name: "answer_regenerated" });
    run(question, answerId);
  }, [run]);

  const loadSession = useCallback((session) => {
    abortRef.current?.abort();
    dispatch({ type: "load", session });
    emit({ name: "session_resumed", sessionId: session.id, patientAttached: !!session.patientId });
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
    emit({ name: "chat_started" });
  }, []);

  return { ...state, send, stop, regenerate, loadSession, newChat };
}
