// socket.js — medical-notifications.v1 client.
//
// Mirrors DictationWsClient (sprint 04): subprotocol as the second
// WebSocket arg, `?token=` query param because browsers cannot set
// Authorization on an upgrade, a switch-dispatch over server frames, and
// the shared CLOSE_CODE table.
//
// It differs in one way that matters: dictation treats a close as
// terminal and lets the caller re-connect, because a dropped audio
// session cannot be silently resumed. A notification socket must heal
// itself, so this one owns reconnect-with-backoff.
//
// The socket is an ACCELERATOR, never the ledger. Its most important
// job is calling back on every transition to open so the store can
// resync from REST — see store.jsx.

import { getAccessToken, tryRefresh } from "../api/client.js";
import { notificationWsBase } from "../api/services.js";
// Reused rather than redeclared: these are one wire contract shared by
// both sockets, and two copies would drift.
import { CLOSE_CODE } from "../dictation/wsClient.js";
import { SERVER_FRAME, SOCKET_STATUS, SUBPROTOCOL } from "./constants.js";

export { SUBPROTOCOL };

// Backoff: 1s, 2s, 4s … capped at 30s, plus jitter so a server restart
// does not bring every client back in the same tick (thundering herd).
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;
export const HEARTBEAT_MS = 25_000;

export function backoffDelay(attempt, { jitter = Math.random } = {}) {
  const raw = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
  // Full jitter over [raw/2, raw].
  return Math.round(raw / 2 + jitter() * (raw / 2));
}

// Which close codes are worth trying again, and how hard.
//   4401 — token died. Refresh once, then retry immediately.
//   4403 — origin/permission. Retrying cannot fix it; stop.
//   4400 — protocol mismatch. Same code will be offered again; stop.
//   4429 — rate limited. Retry, but skip ahead in the backoff curve.
//
// IMPORTANT — why the default ALSO refreshes:
//
// notification-service rejects a bad upgrade BEFORE accept(), and
// Starlette answers a pre-accept rejection with a plain HTTP 403. There
// is no WebSocket close frame at that point, so the browser reports an
// abnormal closure (1006) and the 4401 case below is UNREACHABLE for an
// expired token — the single most common reason the socket dies.
//
// Treating an abnormal close as possibly-auth and refreshing before the
// retry is what actually makes token expiry self-heal. `tryRefresh()` is
// single-flight in api/client.js, so a flapping network cannot turn this
// into a refresh storm. The explicit 4401 branch stays for the paths
// where the server does accept-then-close.
export function classifyClose(code) {
  switch (code) {
    case CLOSE_CODE.AUTH_INVALID:
      return { retry: true, refreshToken: true, penalty: 0, fatal: false };
    case CLOSE_CODE.ORIGIN_BAD:
      return { retry: false, refreshToken: false, penalty: 0, fatal: true };
    case CLOSE_CODE.BAD_PROTOCOL:
      return { retry: false, refreshToken: false, penalty: 0, fatal: true, protocol: true };
    case CLOSE_CODE.RATE_LIMITED:
      return { retry: true, refreshToken: false, penalty: 3, fatal: false };
    case CLOSE_CODE.NORMAL:
      // We asked for this one.
      return { retry: false, refreshToken: false, penalty: 0, fatal: false };
    default:
      return { retry: true, refreshToken: true, penalty: 0, fatal: false };
  }
}

export class NotificationSocket {
  constructor({ callbacks = {}, WebSocketImpl } = {}) {
    this.cb = callbacks;
    // Injectable so the test harness can drive frames deterministically
    // without a network or a browser.
    this.WS = WebSocketImpl || (typeof WebSocket !== "undefined" ? WebSocket : null);
    this.ws = null;
    this.status = SOCKET_STATUS.CLOSED;
    this.attempt = 0;
    this.stopped = false;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
  }

  _setStatus(status) {
    this.status = status;
    if (this.cb.onStatus) this.cb.onStatus(status);
  }

  connect() {
    this.stopped = false;
    this._open();
  }

  // Called when a tab regains focus: a backgrounded socket can be reaped
  // without ever firing onclose, so `status` lies until we look.
  ensureConnected() {
    if (this.stopped) return;
    const live =
      this.ws && (this.ws.readyState === 0 /* CONNECTING */ || this.ws.readyState === 1 /* OPEN */);
    if (!live) this._open();
  }

  _open() {
    if (!this.WS) return;
    const token = getAccessToken();
    if (!token) {
      // No session yet. Do not spin: the provider remounts on login.
      this._setStatus(SOCKET_STATUS.CLOSED);
      return;
    }

    this._clearTimers();
    this._setStatus(this.attempt === 0 ? SOCKET_STATUS.CONNECTING : SOCKET_STATUS.RECONNECTING);

    const url = `${notificationWsBase()}/ws/notifications?token=${encodeURIComponent(token)}`;
    let ws;
    try {
      ws = new this.WS(url, [SUBPROTOCOL]);
    } catch (e) {
      this._scheduleReconnect(0);
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      // Version skew: the server accepted us on a protocol we did not
      // offer. Frames may not mean what we think, so refuse to run.
      if (ws.protocol && ws.protocol !== SUBPROTOCOL) {
        if (this.cb.onProtocolMismatch) this.cb.onProtocolMismatch(ws.protocol);
        this.stopped = true;
        try { ws.close(CLOSE_CODE.NORMAL); } catch {}
        return;
      }
      this.attempt = 0;
      this._setStatus(SOCKET_STATUS.OPEN);
      this._startHeartbeat();
      if (this.cb.onOpen) this.cb.onOpen();
    };

    ws.onmessage = (ev) => this._onMessage(ev);

    ws.onerror = () => {
      if (this.cb.onError) this.cb.onError({ code: "transport_error" });
    };

    ws.onclose = (ev) => {
      this._clearTimers();
      this.ws = null;
      const code = ev && ev.code;
      const plan = classifyClose(code);

      if (plan.protocol && this.cb.onProtocolMismatch) this.cb.onProtocolMismatch(code);
      if (plan.fatal || this.stopped || !plan.retry) {
        this._setStatus(SOCKET_STATUS.CLOSED);
        if (plan.fatal && this.cb.onFatal) this.cb.onFatal(code);
        return;
      }

      this._setStatus(SOCKET_STATUS.RECONNECTING);
      this._scheduleReconnect(plan.penalty, plan.refreshToken);
    };
  }

  async _scheduleReconnect(penalty = 0, refreshToken = false) {
    if (this.stopped) return;
    if (refreshToken) {
      // The socket died because the token did. Refreshing before the
      // retry avoids a guaranteed second 4401.
      try { await tryRefresh(); } catch {}
    }
    const delay = backoffDelay(this.attempt + penalty);
    this.attempt += 1;
    this._reconnectTimer = setTimeout(() => this._open(), delay);
  }

  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      // A ping keeps an idle proxy from reaping the connection. There is
      // no server-initiated heartbeat in v1.
      this.send({ type: "ping" });
    }, HEARTBEAT_MS);
  }

  _clearTimers() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
  }

  _onMessage(ev) {
    if (typeof ev.data !== "string") return;
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return; // a frame we cannot parse is not a reason to drop the socket
    }

    switch (m.type) {
      case SERVER_FRAME.CONNECTED:
        // The count rides along, but the store resyncs on open anyway —
        // this just makes the badge correct a beat sooner.
        if (this.cb.onUnreadCount && Number.isFinite(m.unread_count)) {
          this.cb.onUnreadCount(m.unread_count);
        }
        break;

      case SERVER_FRAME.NOTIFICATION:
        if (this.cb.onNotification && m.notification) {
          this.cb.onNotification(m.notification, m.unread_count);
        }
        break;

      case SERVER_FRAME.UNREAD_COUNT:
        if (this.cb.onUnreadCount) this.cb.onUnreadCount(m.unread_count);
        break;

      case SERVER_FRAME.READ_ACK:
        if (this.cb.onReadAck) this.cb.onReadAck(m.notification_id, m.unread_count);
        break;

      case SERVER_FRAME.PONG:
        break;

      case SERVER_FRAME.ERROR:
        if (this.cb.onError) this.cb.onError(m);
        break;

      default:
        // Unknown type — the protocol may add server frames additively
        // (§ Versioning). Ignoring is correct; crashing is not.
        break;
    }
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  markRead(notificationId) {
    return this.send({ type: "mark_read", notification_id: notificationId });
  }

  close() {
    this.stopped = true;
    this._clearTimers();
    if (this.ws) {
      try { this.ws.close(CLOSE_CODE.NORMAL); } catch {}
    }
    this.ws = null;
    this._setStatus(SOCKET_STATUS.CLOSED);
  }
}
