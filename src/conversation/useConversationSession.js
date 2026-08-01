// useConversationSession.js — the live half of conversation mode (sprint 14).
//
// Wires the sprint-04 transport (DictationWsClient + audioPipeline +
// FrameQueue) to the sprint-14 models (turns.js + mapping.js). It EXTENDS that
// client rather than forking it: conversation differs only by the offered
// subprotocol, `mode` on start_session, two speaker-aware handlers, and the
// asynchronous encoder — everything else (seq numbering, the retransmit ring,
// token refresh, tab coordination, close-code mapping) is shared with v1.
//
// Recording is REAL: capture → 16 kHz mono → 20 ms frames → WebCodecs Opus →
// [4-byte BE seq][opus] on the wire. There is no PCM fallback; a browser that
// cannot encode Opus cannot record a conversation, and says so.

import { useCallback, useEffect, useRef, useState } from "react";

import { DictationWsClient, explainErrorCode, explainCloseCode } from "../dictation/wsClient.js";
import { encodeFrame } from "../dictation/wireFrame.js";
import { WebCodecsOpusEncoder, isOpusEncodingSupported } from "../dictation/opusEncoder.js";
import { startCapture } from "../dictation/audioPipeline.js";
import { openMicStream } from "../dictation/micDevices.js";
import { FrameQueue } from "../dictation/frameQueue.js";
import {
  emptyTurns, applyFinal, applyPartial, clearPartial, setTurnSpeaker as setTurnSpeakerIn,
} from "./turns.js";
import {
  emptyMapping, applyHint, applyUpdate, swap as swapMappingIn, assignRole as assignRoleIn,
} from "./mapping.js";

// One reconnect ladder for the whole session. The backend keeps a session
// resumable for its own grace window; we stop trying well before that so a
// dead network shows an error instead of an infinite spinner over a live
// consultation.
const MAX_RESUMES = 3;
const RESUME_BACKOFF_MS = [400, 1200, 3000];

export function useConversationSession({ language = "uk", promptId, encounterId, deviceId } = {}) {
  const [status, setStatus] = useState("idle"); // idle|starting|live|resuming|stopping|ended|error
  const [turns, setTurns] = useState(emptyTurns);
  const [mapping, setMapping] = useState(emptyMapping);
  const [error, setError] = useState(null);     // { code, message, recoverable }
  const [level, setLevel] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [paused, setPaused] = useState(false);

  const clientRef = useRef(null);
  const encoderRef = useRef(null);
  const captureRef = useRef(null);
  const streamRef = useRef(null);
  const ringRef = useRef(null);
  const sessionIdRef = useRef(null);
  const resumesRef = useRef(0);
  const wantLiveRef = useRef(false);   // the clinician's intent, not the socket's state
  const pausedRef = useRef(false);
  const optsRef = useRef({ language, promptId, encounterId, deviceId });
  optsRef.current = { language, promptId, encounterId, deviceId };

  const fail = useCallback((code, message, recoverable = false) => {
    wantLiveRef.current = false;
    setError({ code, message, recoverable });
    setStatus("error");
  }, []);

  // ── teardown ────────────────────────────────────────────────────────
  const teardownAudio = useCallback(async () => {
    if (captureRef.current) { try { await captureRef.current.stop(); } catch {} }
    captureRef.current = null;
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    }
    streamRef.current = null;
    if (encoderRef.current) {
      try { await encoderRef.current.flush(); } catch {}
      encoderRef.current.destroy();
    }
    encoderRef.current = null;
    setLevel(0);
  }, []);

  // ── message handlers ────────────────────────────────────────────────
  // Speaker fields ride on partial/final; the hint only ever fills a gap
  // (speaker_mapping_updated is the authoritative channel — mapping.js).
  const onPartial = useCallback((m) => {
    setTurns((s) => applyPartial(s, m));
    if (m.speaker_mapping_hint) setMapping((s) => applyHint(s, m.speaker_mapping_hint));
  }, []);

  const onFinal = useCallback((m) => {
    setTurns((s) => applyFinal(s, m));
    if (m.speaker_mapping_hint) setMapping((s) => applyHint(s, m.speaker_mapping_hint));
    // Backend acks are implicit: a final's seq is the highest committed audio,
    // so the ring can drop everything through it (sprint-03 §B).
    if (typeof m.seq === "number" && ringRef.current) {
      ringRef.current.evictThrough(m.seq).catch(() => {});
    }
  }, []);

  const onSpeakerMappingUpdated = useCallback((m) => {
    setMapping((s) => applyUpdate(s, m));
  }, []);

  // ── connect (fresh or resumed) ──────────────────────────────────────
  const connect = useCallback(async ({ resume = false } = {}) => {
    const { language: lng, promptId: pid, encounterId: enc } = optsRef.current;

    const client = new DictationWsClient({
      callbacks: {
        onPartial,
        onFinal,
        onSpeakerMappingUpdated,
        onError: (m) => {
          // consent_required / conversation_unsupported / worker_failed are
          // terminal for this attempt; recoverable ones keep the socket.
          if (m && m.recoverable === false) {
            fail(m.code, explainErrorCode(m.code, optsRef.current.language), false);
          }
        },
        onClose: ({ code }) => {
          if (!wantLiveRef.current) return;              // we asked for this
          if (resumesRef.current >= MAX_RESUMES) {
            fail("connection_lost", explainCloseCode(code, optsRef.current.language), false);
            return;
          }
          // The rendered turns stay on screen across the gap — they are
          // committed, and the backend preserves speakers to the same HWM.
          setStatus("resuming");
          const attempt = resumesRef.current++;
          setTimeout(() => {
            if (!wantLiveRef.current) return;
            connect({ resume: true }).catch(() => {});
          }, RESUME_BACKOFF_MS[Math.min(attempt, RESUME_BACKOFF_MS.length - 1)]);
        },
      },
    });

    const started = await client.connect({
      promptId: pid,
      language: lng,
      targetKind: "generic",
      encounterId: enc,
      mode: "conversation",
      // No template_id ON PURPOSE: with one, dictation-service writes the draft
      // itself from its own labels at finalize, and the clinician's review is
      // lost (dialogue.js header). The frontend owns the draft instead.
      resumeSessionId: resume ? sessionIdRef.current : undefined,
    });

    clientRef.current = client;
    sessionIdRef.current = started.session_id;
    setSessionId(started.session_id);

    // Continue the wire sequence where the backend says it committed, and
    // replay everything after that from the ring (sprint-04 gap recovery).
    if (resume && ringRef.current) {
      const from = (started.last_committed_seq ?? -1) + 1;
      const { highest } = ringRef.current.bounds();
      if (highest != null && highest >= from) {
        const pending = await ringRef.current.range(from, highest);
        for (const rec of pending) {
          try { client.ws.send(rec.frame); } catch {}
        }
      }
    }
    return started;
  }, [onPartial, onFinal, onSpeakerMappingUpdated, fail]);

  // ── start ───────────────────────────────────────────────────────────
  // Resolves TRUE only when audio is actually flowing. A start that never got
  // a socket must not leave the caller showing a recording surface — the room
  // uses the answer to go back to the intro, where the error and the retry
  // live together (`error` is set in every false path).
  const start = useCallback(async () => {
    if (wantLiveRef.current) return true;
    setError(null);
    setStatus("starting");
    wantLiveRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    resumesRef.current = 0;

    // Capability first: without a real Opus encoder every frame we ship would
    // be undecodable on the server. Refuse loudly instead of recording silence.
    if (!isOpusEncodingSupported()) {
      fail("no_opus_encoder", null, false);
      return false;
    }

    try {
      const ring = new FrameQueue({});
      await ring.init();
      ringRef.current = ring;

      const encoder = new WebCodecsOpusEncoder({
        onPacket: (packet) => {
          const client = clientRef.current;
          if (!client) return;
          const seq = client.sendEncoded(packet);
          if (seq != null) ring.push(seq, encodeFrame(seq, packet)).catch(() => {});
        },
        onError: () => fail("encoder_failed", null, false),
      });
      if (!(await encoder.ready())) { fail("no_opus_encoder", null, false); return false; }
      encoderRef.current = encoder;

      const stream = await openMicStream(optsRef.current.deviceId);
      streamRef.current = stream;

      await connect({ resume: false });
      if (!wantLiveRef.current) return false;   // stopped while connecting

      ring.sessionId = sessionIdRef.current;
      captureRef.current = startCapture({
        stream,
        onFrame: (int16) => { encoderRef.current?.push(int16); },
        onLevel: setLevel,
      });
      setStartedAt(Date.now());
      setStatus("live");
      return true;
    } catch (e) {
      await teardownAudio();
      wantLiveRef.current = false;
      if (String(e?.message || "").startsWith("closed_before_start")) {
        // The refusal already arrived as an `error` frame (consent_required is
        // the common one) and set the message; don't overwrite it.
        setStatus((s) => (s === "error" ? s : "error"));
        // Recoverable: a socket that closed before start_session recorded
        // nothing, so trying again costs the clinician nothing and is very
        // often the right move (the service was restarting, the network
        // blinked). Terminal refusals set their own error above and keep it.
        setError((prev) => prev || { code: "connect_failed", message: null, recoverable: true });
        return false;
      }
      if (e?.name === "NotAllowedError" || e?.name === "NotFoundError") {
        fail("mic_denied", null, false);
        return false;
      }
      fail("connect_failed", null, true);
      return false;
    }
  }, [connect, fail, teardownAudio]);

  // ── pause / resume ──────────────────────────────────────────────────
  // The protocol has always carried these frames; nothing in the UI ever
  // sent them, so a clinician stepping out mid-consultation had only one
  // option — end the whole thing.
  //
  // Order matters in both directions. The server rejects audio that arrives
  // while the session is paused (`pause_state_mismatch`), so capture stops
  // BEFORE the pause frame and restarts AFTER the resume frame. The mic
  // stream itself stays open: re-acquiring it would re-prompt for
  // permission in the middle of a consultation.
  const pause = useCallback(async () => {
    if (!wantLiveRef.current || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    if (captureRef.current) { try { await captureRef.current.stop(); } catch {} }
    captureRef.current = null;
    if (encoderRef.current) { try { await encoderRef.current.flush(); } catch {} }
    clientRef.current?.pause();
    setLevel(0);
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    clientRef.current?.resume();
    const stream = streamRef.current;
    if (stream) {
      captureRef.current = startCapture({
        stream,
        onFrame: (int16) => { encoderRef.current?.push(int16); },
        onLevel: setLevel,
      });
    }
    pausedRef.current = false;
    setPaused(false);
  }, []);

  // ── stop → the session is finalized server-side ─────────────────────
  // end_session persists the transcript (with segment UUIDs and speakers); the
  // review pass and draft creation then read it back over HTTP.
  const stop = useCallback(async () => {
    if (!wantLiveRef.current && status !== "live") {
      setStatus((s) => (s === "error" ? s : "ended"));
      return sessionIdRef.current;
    }
    wantLiveRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setStatus("stopping");
    // Stop capture before flushing so no frame arrives after end_session.
    if (captureRef.current) { try { await captureRef.current.stop(); } catch {} }
    captureRef.current = null;
    if (encoderRef.current) { try { await encoderRef.current.flush(); } catch {} }
    clientRef.current?.endSession();
    setTurns((s) => clearPartial(s));
    await teardownAudio();
    // Give the server a beat to write the transcript before we read it back.
    setTimeout(() => { try { clientRef.current?.close(); } catch {} }, 250);
    setStatus("ended");
    return sessionIdRef.current;
  }, [status, teardownAudio]);

  // ── clinician actions ───────────────────────────────────────────────
  const setSpeaker = useCallback((turnId, speaker) => {
    setTurns((s) => setTurnSpeakerIn(s, turnId, speaker));
  }, []);

  // Swapping (or assigning) freezes the mapping: authoritative from this
  // moment, server-side re-inference stops. We freeze locally on the click too
  // — an update already in flight must not repaint over the answer.
  const swapMapping = useCallback(() => {
    setMapping((s) => {
      const [next, wire] = swapMappingIn(s);
      clientRef.current?.setSpeakerMapping(wire);
      return next;
    });
  }, []);

  const assignRole = useCallback((label, role) => {
    setMapping((s) => {
      const [next, wire] = assignRoleIn(s, label, role);
      if (wire) clientRef.current?.setSpeakerMapping(wire);
      return next;
    });
  }, []);

  // Navigating away mid-consultation must not leave the microphone hot or the
  // session holding two capacity slots.
  //
  // It used to close the socket WITHOUT sending end_session, which is the
  // difference between a finalized consultation and a lost one: the server
  // saw a dropped client, moved the session to `reconnecting`, and abandoned
  // it half an hour later — no persisted transcript, no draft, and a row
  // sitting in the tenant's active-session budget the whole time. Send the
  // frame first; the close is deferred a beat so it actually goes out.
  useEffect(() => () => {
    const wasLive = wantLiveRef.current;
    wantLiveRef.current = false;
    pausedRef.current = false;
    if (captureRef.current) { captureRef.current.stop(); }
    captureRef.current = null;
    if (streamRef.current) { try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {} }
    if (encoderRef.current) encoderRef.current.destroy();
    const client = clientRef.current;
    if (wasLive && client) {
      try { client.endSession(); } catch {}
      setTimeout(() => { try { client.close(); } catch {} }, 250);
      return;
    }
    try { client?.close(); } catch {}
  }, []);

  return {
    status, turns, mapping, error, level, sessionId, startedAt, paused,
    start, stop, pause, resume, setSpeaker, swapMapping, assignRole,
    recording: status === "live" || status === "resuming",
  };
}
