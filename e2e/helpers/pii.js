// e2e/helpers/pii.js — sprint 11 step 07: the PII-hygiene sweep + shared
// live-suite plumbing.
//
// The scan itself (`findPiiLeaks`) is a pure function so the mutation check
// (src/patients — no; e2e/helpers/pii.test.js) can prove it catches a
// planted leak: a hygiene assertion nobody has seen fail is not evidence.

// ── pure scanner ─────────────────────────────────────────────────────────
// snapshot: { urls: string[], storage: object, telemetryBodies: string[] }
// fixture:  { name: string, ipn?: string, mrn?: string }
// → array of human-readable leak descriptions (empty = clean).
export function findPiiLeaks(snapshot, fixture) {
  const leaks = [];
  const needles = [
    ["name", fixture.name],
    ["ipn", fixture.ipn],
    ["mrn", fixture.mrn],
  ].filter(([, v]) => v && String(v).length >= 4);

  const scan = (where, text) => {
    for (const [what, needle] of needles) {
      const hay = String(text);
      if (hay.includes(needle) || decodeURIComponentSafe(hay).includes(needle)) {
        leaks.push(`${what} "${needle}" leaked into ${where}: ${String(text).slice(0, 120)}`);
      }
    }
  };

  for (const u of snapshot.urls || []) scan("URL", u);
  scan("storage", JSON.stringify(snapshot.storage || {}));
  for (const b of snapshot.telemetryBodies || []) scan("telemetry", b);
  return leaks;
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// ── page taps (observe mode — no route mocking) ─────────────────────────
// Collects every VISITED (navigable/shareable) URL and every telemetry
// request body; call assertNoPatientPii(...) at the end of a case.
//
// Deliberately NOT scanned: API request URLs. Searching sends the typed
// text (name/ІПН) as `?query=` to the data's own backend over TLS — that
// is the feature, not a leak. The hygiene rules guard what persists or
// leaves the trust boundary: the address bar / history (shareable),
// storage, and the telemetry sink.
export function installPiiTaps(page) {
  const taps = { urls: [], telemetryBodies: [] };
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) taps.urls.push(f.url()); });
  page.on("request", (req) => {
    if (req.url().includes("/autocomplete/telemetry")) {
      taps.telemetryBodies.push(req.postData() || "");
    }
  });
  return taps;
}

export async function collectStorage(page) {
  return page.evaluate(() => ({ l: { ...localStorage }, s: { ...sessionStorage } }));
}

export async function assertNoPatientPii(page, taps, fixture) {
  const storage = await collectStorage(page);
  const leaks = findPiiLeaks({ urls: taps.urls, storage, telemetryBodies: taps.telemetryBodies }, fixture);
  if (leaks.length) {
    throw new Error(`PII hygiene sweep FAILED:\n${leaks.join("\n")}`);
  }
}

// ── console guard ────────────────────────────────────────────────────────
// Zero console errors is an assertion in every case. Browser network-log
// lines ("Failed to load resource") are excluded — expected 401s during
// the auth bootstrap land there; uncaught JS errors and app console.error
// calls are what we refuse to ship.
export function installConsoleGuard(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text().startsWith("Failed to load resource")) return;
    // known dev-stack gap (see e2e/README.md): dictation-service :8002
    // ships no CORS headers; its readiness probe noise is not app error
    if (/blocked by CORS policy/.test(msg.text()) && /:8002/.test(msg.text())) return;
    // known dev-stack gap: notification-service :8004 is not part of the
    // minimal stack; the bell's WS retry logs a browser connection error
    // (handled in-app by the socket's backoff — not an app error).
    if (/WebSocket connection to 'ws:\/\/localhost:8004/.test(msg.text())) return;
    errors.push(`console.error: ${msg.text().slice(0, 200)}`);
  });
  return {
    assertClean() {
      if (errors.length) throw new Error(`console not clean:\n${errors.join("\n")}`);
    },
  };
}

// ── run-scoped fixtures ──────────────────────────────────────────────────
export const runId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// A checksum-valid random ІПН (РНОКПП weights — mirrors src/patients/ipn.js).
export function genValidIpn() {
  const W = [-1, 5, 7, 9, 4, 6, 10, 5, 7];
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const control = (((d.reduce((s, x, i) => s + W[i] * x, 0) % 11) + 11) % 11) % 10;
  return d.join("") + control;
}
