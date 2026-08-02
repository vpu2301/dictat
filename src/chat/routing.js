// chat/routing.js — the scoped router.
//
// Paths are always built FROM `basePath`, never hardcoded, so the same module
// works at /apps/evidence-chat in one host and /chat in another. Parsing is
// deliberately dumb string work: this is a three-view module, not a routing
// framework.
//
// There is no settings or connectors view: the module publishes both as data
// (settingsContract.js, the connector hooks) and the host renders them on its
// own settings page, so a user never has two places to look for one preference.

export const VIEWS = ["chat", "history", "agents"];

const stripTrailing = (s) => (s.length > 1 ? s.replace(/\/+$/, "") : s);

// "/chat/s/ses_01" → { view: "chat", sessionId: "ses_01" }
export function parsePath(path, basePath) {
  const base = stripTrailing(basePath || "");
  const [pathname] = String(path || base).split("?");
  const rest = stripTrailing(pathname).startsWith(base)
    ? stripTrailing(pathname).slice(base.length)
    : "";
  const segments = rest.split("/").filter(Boolean);

  if (segments.length === 0) return { view: "chat", sessionId: null };
  if (segments[0] === "history") return { view: "history", sessionId: null };
  if (segments[0] === "agents") return { view: "agents", sessionId: null };
  if (segments[0] === "s" && segments[1]) {
    return { view: "chat", sessionId: decodeURIComponent(segments[1]) };
  }
  // Anything else under the base is still ours — land on the chat rather than
  // rendering nothing inside the host's content area.
  return { view: "chat", sessionId: null };
}

export function buildPath(basePath, { view = "chat", sessionId } = {}) {
  const base = stripTrailing(basePath || "");
  if (view === "history") return `${base}/history`;
  if (view === "agents") return `${base}/agents`;
  if (view === "chat" && sessionId) return `${base}/s/${encodeURIComponent(sessionId)}`;
  return base;
}
