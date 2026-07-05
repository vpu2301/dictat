// wsClient.js — dictation-service WebSocket client.
//
// Conforms to the v1 protocol pinned in the backend-aligned FE spec:
//   - URL: {DICTATION_WS_BASE}/ws/dictate
//   - Subprotocol header: 'medical-dictation.v1' (mandatory; backend rejects HTTP 400 otherwise)
//   - Auth: ?token=<accessToken> query param (browsers can't set Authorization on WS upgrades)
//   - Binary frames: [4-byte BE seq][Opus bytes], 5..=8192 bytes
//   - Text frames: 9 server message types, 6 client message types — see types below
//
// Close-code mapping (backend → user-facing reason):
//   4400  bad subprotocol / bad message
//   4401  auth_invalid                  (token expired or bad audience)
//   4403  origin_forbidden
//   4429  rate_limited
//   1000  normal close (session_terminated already received)
//   1013  gpu_full / try again
//
// Token-expiry handling: backend emits a `token_expiring` text message at
// T-60s before access-token expiry. The FE refreshes via POST /auth/refresh
// (HTTP path, not WS) then ships `{type:"refresh_token", token: <new>}` on
// the live WS. The refresh must complete BEFORE the WS dies.

import { encodeFrame, MAX_PAYLOAD_BYTES } from "./wireFrame.js";
import { dictationWsBase } from "../api/services.js";
import { getAccessToken, tryRefresh } from "../api/client.js";

export const SUBPROTOCOL = "medical-dictation.v1";

// ── close-code mapping ────────────────────────────────────────────────
export const CLOSE_CODE = {
  NORMAL:        1000,
  GOING_AWAY:    1001,
  GPU_FULL:      1013,
  BAD_PROTOCOL:  4400,
  AUTH_INVALID:  4401,
  ORIGIN_BAD:    4403,
  RATE_LIMITED:  4429,
};

export function explainCloseCode(code, lang = "en") {
  const map = {
    [CLOSE_CODE.NORMAL]:       { uk: "Сесію завершено", en: "Session ended" },
    [CLOSE_CODE.GOING_AWAY]:   { uk: "З'єднання припинено", en: "Connection going away" },
    [CLOSE_CODE.GPU_FULL]:     { uk: "Сервер зайнятий — спробуйте за хвилину", en: "Server busy — retry shortly" },
    [CLOSE_CODE.BAD_PROTOCOL]: { uk: "Несумісний протокол", en: "Incompatible protocol" },
    [CLOSE_CODE.AUTH_INVALID]: { uk: "Сесія прострочена — увійдіть знову", en: "Session expired — sign in again" },
    [CLOSE_CODE.ORIGIN_BAD]:   { uk: "Заблокований origin", en: "Origin not allowed" },
    [CLOSE_CODE.RATE_LIMITED]: { uk: "Забагато спроб — почекайте хвилину", en: "Rate limited — wait a minute" },
  };
  const row = map[code];
  if (!row) return lang === "uk" ? `З'єднання закрито (код ${code})` : `Connection closed (${code})`;
  return lang === "uk" ? row.uk : row.en;
}

// ── client → server messages ──────────────────────────────────────────
//   start_session, refresh_token, end_session, pause, resume, retransmit_range
function msgStartSession({ promptId, language, targetKind, encounterId, templateId, resumeSessionId }) {
  const m = {
    type: "start_session",
    protocol_version: 1,
    prompt_id: promptId,
    language,
  };
  if (targetKind)      m.target_kind = targetKind;
  if (encounterId)     m.encounter_id = encounterId;
  if (templateId)      m.template_id = templateId;
  if (resumeSessionId) m.resume_session_id = resumeSessionId;
  return m;
}

// ── tab coordination (spec §C sprint 04) ──────────────────────────────
// BroadcastChannel-based "I have this session_id live" announcement. A
// second tab can show "Already running in another tab" before attempting
// the upgrade — backend uniformly rejects with session_not_found.
const TAB_CHANNEL_NAME = "mdx-dictation-tabs";
const tabId = (() => Math.random().toString(36).slice(2, 10))();

export function announceSessionTab(sessionId) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(TAB_CHANNEL_NAME);
  const announce = () => ch.postMessage({ type: "hold", tabId, sessionId, ts: Date.now() });
  const interval = setInterval(announce, 2000);
  announce();
  return () => { clearInterval(interval); try { ch.close(); } catch {} };
}

export async function isSessionHeldElsewhere(sessionId, timeoutMs = 200) {
  if (typeof BroadcastChannel === "undefined") return false;
  const ch = new BroadcastChannel(TAB_CHANNEL_NAME);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { ch.close(); } catch {}; resolve(v); };
    ch.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "hold" && d.sessionId === sessionId && d.tabId !== tabId) finish(true);
    };
    ch.postMessage({ type: "probe", tabId, sessionId });
    setTimeout(() => finish(false), timeoutMs);
  });
}

// ── DictationWsClient ──────────────────────────────────────────────────
//
// Events emitted via the callbacks the caller passes to connect():
//   onSessionStarted(payload)      — server `session_started`
//   onPartial(payload)             — server `partial`
//   onFinal(payload)               — server `final`
//   onVoiceCommand(payload)        — standalone `voice_command` (sprint-05 backend may emit)
//   onWarning(payload)             — `warning`
//   onHeartbeat(payload)           — `heartbeat`
//   onTokenExpiring(payload)       — `token_expiring` (we handle refresh internally; callback for telemetry)
//   onSessionTerminated(payload)   — `session_terminated`
//   onError(payload)               — `error`
//   onClose({code, reason, explain}) — socket closed
//   onState(state)                 — "connecting" | "open" | "closed"
//
// Caller drives the audio side via pushAudio(int16 → opus → wire). We compute
// seq + encode the binary frame internally so the seq numbering matches the
// backend's gap-detection policy.
export class DictationWsClient {
  constructor({ encoder, callbacks = {} } = {}) {
    this.encoder = encoder;          // OpusEncoder instance
    this.cb = callbacks;
    this.ws = null;
    this.state = "closed";
    this.seq = 0;
    this.sessionId = null;
    this.lastCommittedSeq = -1;
    this._heartbeatTimer = null;
    this._tabReleaser = null;
  }

  // Connect + send `start_session`. Returns a promise that resolves on
  // session_started or rejects on close-before-start.
  async connect(opts) {
    const {
      promptId, language, targetKind = "generic",
      encounterId, templateId, resumeSessionId,
    } = opts;
    const token = getAccessToken();
    if (!token) throw new Error("no_access_token");

    const base = dictationWsBase();
    const url = `${base}/ws/dictate?token=${encodeURIComponent(token)}`;
    this._setState("connecting");
    const ws = new WebSocket(url, [SUBPROTOCOL]);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      };

      ws.onopen = () => {
        this._send(msgStartSession({
          promptId, language, targetKind, encounterId, templateId, resumeSessionId,
        }));
        // Wire up steady-state handler.
        ws.onmessage = (ev) => this._onMessage(ev);
      };

      // Initial handler waits for session_started.
      ws.onmessage = (ev) => {
        try {
          const m = typeof ev.data === "string" ? JSON.parse(ev.data) : null;
          if (m && m.type === "session_started") {
            this.sessionId = m.session_id;
            this.lastCommittedSeq = m.last_committed_seq || -1;
            this.seq = (m.last_committed_seq || 0) + 1;
            this._tabReleaser = announceSessionTab(this.sessionId);
            this._setState("open");
            if (this.cb.onSessionStarted) this.cb.onSessionStarted(m);
            ws.onmessage = (ev2) => this._onMessage(ev2);
            resolved = true;
            resolve(m);
          } else if (m && m.type === "error") {
            this._emitError(m);
            ws.close();
          }
        } catch (e) {
          if (this.cb.onError) this.cb.onError({ code: "parse_error", detail: String(e), recoverable: false });
        }
      };

      ws.onerror = (ev) => {
        if (this.cb.onError) this.cb.onError({ code: "transport_error", detail: "WebSocket error", recoverable: true });
      };

      ws.onclose = (ev) => {
        cleanup();
        this._teardown(ev);
        if (!resolved) reject(new Error(`closed_before_start:${ev.code}`));
      };
    });
  }

  // Steady-state text-frame router.
  _onMessage(ev) {
    if (typeof ev.data !== "string") return; // binary frames are server→client only for replay; ignored here
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.type) {
      case "partial":
        if (this.cb.onPartial) this.cb.onPartial(m);
        break;
      case "final":
        // Backend ack is implicit: `final.seq` is the highest committed.
        if (typeof m.seq === "number") this.lastCommittedSeq = Math.max(this.lastCommittedSeq, m.seq);
        if (this.cb.onFinal) this.cb.onFinal(m);
        break;
      case "voice_command":
        if (this.cb.onVoiceCommand) this.cb.onVoiceCommand(m);
        break;
      case "warning":
        if (this.cb.onWarning) this.cb.onWarning(m);
        break;
      case "heartbeat":
        if (this.cb.onHeartbeat) this.cb.onHeartbeat(m);
        break;
      case "token_expiring":
        this._handleTokenExpiring(m);
        break;
      case "session_terminated":
        if (this.cb.onSessionTerminated) this.cb.onSessionTerminated(m);
        break;
      case "error":
        this._emitError(m);
        break;
      default:
        // Unknown — keep stream open; backend may add new server types.
        break;
    }
  }

  async _handleTokenExpiring(m) {
    if (this.cb.onTokenExpiring) this.cb.onTokenExpiring(m);
    try {
      const newTok = await tryRefresh();
      if (newTok) this._send({ type: "refresh_token", token: newTok });
    } catch {
      // The next backend ping will close us with 4401 — handled in onclose.
    }
  }

  _emitError(m) {
    const close = (code) => { try { this.ws && this.ws.close(code); } catch {} };
    if (this.cb.onError) this.cb.onError(m);
    if (!m.recoverable) close(CLOSE_CODE.NORMAL);
  }

  _teardown(ev) {
    this._setState("closed");
    if (this._tabReleaser) this._tabReleaser();
    this._tabReleaser = null;
    const code = ev && ev.code;
    if (this.cb.onClose) this.cb.onClose({ code, reason: ev && ev.reason, explain: explainCloseCode(code) });
  }

  _setState(s) {
    this.state = s;
    if (this.cb.onState) this.cb.onState(s);
  }

  _send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  // Public client→server commands.
  pause()           { return this._send({ type: "pause" }); }
  resume()          { return this._send({ type: "resume" }); }
  endSession()      { return this._send({ type: "end_session" }); }
  retransmit(from_seq, to_seq) {
    return this._send({ type: "retransmit_range", from_seq, to_seq });
  }

  // Section-aware ASR (templates §4). Additive client message — no protocol
  // version bump. The backend validates `section_id` against the template
  // loaded into the session at start (we don't re-send the template), swaps the
  // ASR prompt for the next audio window, and audits it. An invalid id comes
  // back as a RECOVERABLE `error` frame (code:"bad_message") routed through
  // _onMessage → onError, which keeps the session alive (we only hard-close on
  // !recoverable). reason ∈ "voice_command" | "user_click" | "programmatic".
  switchSection(sectionId, reason = "user_click") {
    if (!sectionId) return false;
    return this._send({ type: "switch_section", section_id: sectionId, reason });
  }

  // Send one 20 ms PCM frame through the encoder onto the wire. Returns the
  // seq number used so the caller can persist into the FrameQueue.
  // Caller responsibility: do not call while paused (backend will reject
  // with pause_state_mismatch).
  pushAudio(int16) {
    if (!this.encoder) throw new Error("no_encoder");
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return null;
    const payload = this.encoder.encode(int16);
    if (payload.byteLength > MAX_PAYLOAD_BYTES) {
      // Backend would close as bad_message — caller must shrink before retry.
      throw new RangeError("encoded_frame_too_large");
    }
    const frame = encodeFrame(this.seq, payload);
    this.ws.send(frame);
    return this.seq++;
  }

  // Hard close — for navigation away, tab close, etc.
  close(code = CLOSE_CODE.NORMAL) {
    if (this.ws) {
      try { this.ws.close(code); } catch {}
    }
  }
}
