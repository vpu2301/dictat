// constants.js — the closed vocabularies of medical-notifications.v1.
//
// Mirrors libs/notification_events/enums.py on the backend. Values are
// compared against the wire verbatim, so a typo here is a silent
// mis-render rather than a crash — `contract.test.js` pins every member
// against docs/api/notifications-ws-v1.md.

export const SUBPROTOCOL = "medical-notifications.v1";

// Server → client frame types.
export const SERVER_FRAME = {
  CONNECTED: "connected",
  NOTIFICATION: "notification",
  UNREAD_COUNT: "unread_count",
  READ_ACK: "read_ack",
  PONG: "pong",
  ERROR: "error",
};

// Client → server frame types.
export const CLIENT_FRAME = {
  MARK_READ: "mark_read",
  PING: "ping",
};

export const CATEGORY = {
  REPORT_FINALIZED: "report.finalized",
  REPORT_SIGNED: "report.signed",
  REPORT_SIGNING_FAILED: "report.signing_failed",
  REPORT_AMENDED: "report.amended",
  REPORT_CHAIN_FAILURE: "report.chain_failure",
  REPORT_SHARED_WITH_YOU: "report.shared_with_you",
  DICTATION_COMPLETED: "dictation.completed",
  TRANSCRIPTION_COMPLETED: "transcription.completed",
  TRANSCRIPTION_FAILED: "transcription.failed",
  SYSTEM_DIGEST: "system.digest",
};

export const ALL_CATEGORIES = Object.values(CATEGORY);

export const SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
};

export const EMAIL_MODE = {
  IMMEDIATE: "immediate",
  DIGEST: "digest",
  OFF: "off",
};

export const ALL_EMAIL_MODES = Object.values(EMAIL_MODE);

// Every severity toasts, but not equally — see dismissDelay() in
// NotificationToasts.jsx: info clears itself in a few seconds, warning
// lingers, critical waits for an acknowledgement.
//
// `info` used to be badge-only, on the theory that a toast per finalized
// report trains reflex-dismissal. In practice it read as the feature
// being broken: the bell is hidden on the focused routes (Studio, the
// note editor), so finishing a dictation produced no visible reaction
// anywhere. A brief, quiet toast is the smaller cost.
export const TOASTED_SEVERITIES = [SEVERITY.INFO, SEVERITY.WARNING, SEVERITY.CRITICAL];

export function isToastWorthy(severity) {
  return TOASTED_SEVERITIES.includes(severity);
}

// Socket lifecycle, surfaced on the bell as a muted dot.
export const SOCKET_STATUS = {
  CONNECTING: "connecting",
  OPEN: "open",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
};
