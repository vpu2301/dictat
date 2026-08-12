// csp.js — the Content-Security-Policy and its companion security headers,
// as one pure function over the deployment's service map.
//
// WHY THIS FILE EXISTS. The auth design has assumed a CSP since sprint 02:
// the refresh token lives in an HttpOnly cookie and the access token lives in
// a module-scoped variable precisely so that script cannot read either. That
// assumption is only worth anything if injected script cannot run at all —
// otherwise an XSS simply calls `api()` with the victim's live session, and
// the cookie flags have bought nothing. The threat model recorded the gap as
// "sprint-16 frontend adds CSP". This is that.
//
// WHY IT IS COMPUTED, NOT WRITTEN DOWN. In dev this SPA talks to thirteen
// services on thirteen ports; in production they all sit behind one
// same-origin gateway. A policy typed out as a string would be wrong in one of
// those two worlds and would rot the first time a port moved. So the policy is
// derived from `resolveServices()` — the same map the fetch clients use — and
// collapses to a nearly bare `'self'` policy in the deployment where every
// service is same-origin.
//
// WHY HEADERS AND NOT A <meta> TAG. `frame-ancestors` (the clickjacking
// defence) and `report-only` mode are both ignored inside a meta tag. Headers
// are the only complete option, so the policy ships as headers from the Vite
// dev server, the preview server, and the generated deployment configs
// (dist/_headers, dist/security-headers.nginx.conf).

const SELF = "'self'";
const NONE = "'none'";

// Everything the browser is allowed to reach, derived from the service map.
// `evidenceChat` is legitimately blank in most deployments (the module answers
// from fixtures) — a blank base must not become a `""` token in the policy.
function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const toWs = (origin) => origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

/**
 * Unique HTTP origins the app calls, in stable (sorted) order so the emitted
 * header is byte-identical across builds — a policy that reshuffles on every
 * build is a policy nobody can diff.
 */
export function serviceOrigins(services = {}) {
  const set = new Set();
  for (const url of Object.values(services)) {
    const o = originOf(url);
    if (o) set.add(o);
  }
  return [...set].sort();
}

/**
 * The two WebSocket endpoints: dictation (live transcription, sprint 04) and
 * notifications (sprint 12). Both derive their WS base from the matching HTTP
 * base by scheme upgrade — services.js does exactly this — so the policy does
 * the same rather than inventing a third source of truth.
 */
export function socketOrigins(services = {}) {
  const set = new Set();
  for (const key of ["dictation", "notification"]) {
    const o = originOf(services[key]);
    if (o) set.add(toWs(o));
  }
  return [...set].sort();
}

/**
 * The policy, as an ordered map of directive → source list.
 *
 * Every non-obvious entry is justified here, because a CSP that nobody can
 * explain is a CSP that gets widened the first time something breaks.
 */
export function cspDirectives(services = {}, { reportUri = "", extraConnect = [] } = {}) {
  const http = serviceOrigins(services);
  const ws = socketOrigins(services);
  // Origins that are reached but are not services — today, the owner console's
  // infrastructure reachability probe (src/company/infra.js). Passed in rather
  // than imported so this module stays a leaf: the caller decides what else
  // the deployment talks to, and csp.test.js can state it explicitly.
  const extra = [...new Set(extraConnect.filter(Boolean))].sort();

  const directives = {
    // The floor. Anything not named below falls here, so a resource type we
    // forgot is refused rather than quietly allowed.
    "default-src": [SELF],

    // No inline script, no eval, no CDN. index.html carries no <script> block
    // and no event attributes, and nothing in src/ calls eval or new Function
    // — so this needs neither a nonce nor a hash.
    "script-src": [SELF],

    // No inline style either. Two things had to change for this to hold:
    // the three webfont families are self-hosted (src/fonts.css) instead of
    // imported from fonts.googleapis.com, and @tiptap/core's runtime
    // <style> injection is switched off (`injectCSS: false`) with its
    // stylesheet shipped as src/prosemirror.css.
    //
    // React's `style={{…}}` props are NOT affected: React writes them through
    // CSSOM (`node.style.setProperty`), which CSP does not govern. Only markup
    // — a <style> element or a style="" attribute the parser sees — is.
    "style-src": [SELF],

    // Self-hosted woff2 only. No fonts.gstatic.com.
    "font-src": [SELF],

    // `data:` for canvas/QR exports, `blob:` for tenant logos, which arrive as
    // authenticated bytes and are handed to <img> as object URLs
    // (src/api/tenants.js) rather than as a URL the browser could fetch
    // unauthenticated.
    "img-src": [SELF, "data:", "blob:"],

    // Audio replay (sprint 15). The clip URL is tokenised but STILL requires
    // the bearer, so src/api/audioClips.js fetches the bytes and gives <audio>
    // an object URL. That is why no storage-bucket origin appears here: the
    // browser never fetches a clip as media, only as a blob it already holds.
    "media-src": [SELF, "blob:"],

    // The API surface: every service base, the two sockets, and whatever else
    // the deployment legitimately reaches (the infra probe).
    "connect-src": [SELF, ...http, ...ws, ...extra],

    // pages/marketing/ApiDocsPage.jsx embeds each service's own Swagger UI at
    // {base}/docs. This is the directive that is easy to forget and loud when
    // wrong — the pane just goes blank.
    "frame-src": [SELF, ...http],

    // Nothing in this app spawns a Worker; Opus encoding uses the browser's
    // native WebCodecs AudioEncoder, not a wasm worker. Keep it shut.
    "worker-src": [NONE],

    // Legacy plugin content. Never wanted.
    "object-src": [NONE],

    // Clickjacking: this app is never framed. (X-Frame-Options: DENY below is
    // the same statement for browsers that predate frame-ancestors.)
    "frame-ancestors": [NONE],

    // An injected <base href> would silently repoint every relative URL in the
    // document — including the module script — at an attacker's origin.
    "base-uri": [SELF],

    // An injected form cannot post the user's input off-origin.
    "form-action": [SELF],

    "manifest-src": [SELF],
  };

  // Report-only rollout wants somewhere to send violations; enforcement mode
  // can carry the same endpoint to catch what the rollout missed. Omitted
  // entirely when unset — an empty report-uri is a parse error in some
  // browsers and a silent no-op in the rest.
  if (reportUri) directives["report-uri"] = [reportUri];

  return directives;
}

/** Serialize a directive map to a header value. */
export function serializeCsp(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

// Permissions-Policy. The microphone is the whole product — dictation cannot
// work without it — so it is granted to this origin and to nothing else. Every
// other powerful feature is denied outright: a medical record system has no
// business reading a camera, a location or a payment handler, and an empty
// allowlist means an injected iframe cannot ask for one either.
export const PERMISSIONS_POLICY = [
  "microphone=(self)",
  "autoplay=(self)",
  "fullscreen=(self)",
  "accelerometer=()",
  "ambient-light-sensor=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/**
 * Every security header this app is served with.
 *
 * @param {object}  opts
 * @param {object}  opts.services  resolved service base URLs (resolveServices)
 * @param {string}  opts.mode      "enforce" | "report-only" | "off"
 * @param {string}  opts.reportUri where violations are POSTed (optional)
 * @param {boolean} opts.hsts      add Strict-Transport-Security (https only)
 * @param {string[]} opts.extraConnect additional connect-src origins
 */
export function securityHeaders({
  services = {}, mode = "enforce", reportUri = "", hsts = false, extraConnect = [],
} = {}) {
  const headers = {
    // MIME sniffing turns an uploaded "image" into a script. Never guess.
    "X-Content-Type-Options": "nosniff",

    // Report-URLs leak: a report id in a path sent to a third party is a
    // patient identifier sent to a third party. Same-origin gets the full URL,
    // cross-origin gets the bare origin, downgrades get nothing.
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // The pre-frame-ancestors spelling, for the browsers that need it.
    "X-Frame-Options": "DENY",

    // Severs window.opener for anything this app opens, and puts the app in
    // its own browsing-context group.
    "Cross-Origin-Opener-Policy": "same-origin",

    "Permissions-Policy": PERMISSIONS_POLICY,
  };

  // HSTS is meaningless over http and actively harmful if a browser caches it
  // from a dev origin, so it is opt-in and only ever set by the generated
  // production config.
  if (hsts) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

  if (mode !== "off") {
    const value = serializeCsp(cspDirectives(services, { reportUri, extraConnect }));
    const name = mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
    headers[name] = value;
  }

  return headers;
}

/**
 * Read the CSP mode out of an env bag, defaulting to enforcement.
 *
 * The rollout the threat model asks for is report-only first, then enforce —
 * so the mode is a deployment setting, not a code change. `off` exists for one
 * situation only: proving, in a test, that a violation the policy would have
 * blocked really does happen without it.
 */
export function cspModeFrom(env = {}) {
  const raw = String(env.VITE_CSP_MODE || "enforce").toLowerCase();
  return ["enforce", "report-only", "off"].includes(raw) ? raw : "enforce";
}
