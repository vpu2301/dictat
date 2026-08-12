// session-revocation.spec.js — a session that dies before its token expires.
//
// Sprint 16 / backend ADR-0040. The revocation denylist means logout in
// another tab, an administrator deactivating an account, or an MFA reset now
// kill a live access token within the second. Two things had to be true for
// that to be survivable, and neither was:
//
//   1. THE APP MUST END CLEANLY. The old client refreshed once, retried, got a
//      second 401 and threw it at whatever screen was showing — an error dump
//      for an event with a perfectly clear explanation. And the redirect it
//      did perform left AuthContext populated, so App.jsx's `gateToHome`
//      effect bounced the user straight back to the workspace, which 401'd
//      again. A revoked clinician watched two screens flicker at each other.
//   2. IT MUST NOT COST A CONSULTATION. Revocation can land three minutes into
//      a recording. The audio is in the sprint-04 IndexedDB ring; before this
//      sprint nothing ever read it back, so the guarantee was theoretical.
//
// The recording half is driven for real: a routed WebSocket speaking the v2
// protocol, a fake microphone and a stand-in AudioEncoder — everything above
// the encoder (framing, sequencing, the ring, the manifest) is the app's own
// code. The harness is deliberately a smaller, local copy of the one in
// conversation.spec.js rather than a shared import: that file's fixture exists
// to test diarization and carries a whole scripted consultation, and coupling
// the two would make a change to either able to break the other.

import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const ENC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const PROMPT_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";

// The room refuses to start without a recognition profile AND a template —
// the draft has to land somewhere. One of each is all this fixture needs.
const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: {
    sections: [{ id: "anamnesis", name: "Anamnesis", order: 0, required: false, field_type: "text", voice_aliases: ["anamnesis"] }],
  },
};

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: false,
};
const ENCOUNTER = {
  id: ENC, patient_id: PID, kind: "visit", reason: "головний біль",
  occurred_at: "2026-07-26T09:00:00Z", status: "in_progress", created_at: "2026-07-26T09:00:00Z",
};
const RECORDING_CONSENT = {
  id: "c-rec", patient_id: PID, encounter_id: null, type: "recording", method: "verbal",
  version: "v1", status: "granted", granted_at: "2026-07-26T08:00:00Z", withdrawn_at: null,
  signed_envelope_id: null,
};
const AI_SCRIBE_CONSENT = { ...RECORDING_CONSENT, id: "c-ai", type: "ai_scribe" };

const roomUrl = `/#/studio?mode=scribe&patient=${PID}&encounter=${ENC}`;

// The mock's whole state is these two switches.
//
//   sessionOpen — is there a refresh cookie?
//   revoked     — is the ACCESS token denylisted? This is the sprint-16 case
//                 and the one that used to have no handling: refresh keeps
//                 working (the refresh token is a different credential with a
//                 different lifetime), so the client gets a brand-new access
//                 token and is refused with it. That second 401 is the signal.
function installBackend(page, { consents = [RECORDING_CONSENT] } = {}) {
  const ctl = { sessionOpen: false, revoked: false, refreshes: 0, meCalls: 0, consents: [...consents] };

  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8004", "8005", "8006", "8007", "8008", "8009"].includes(url.port);

  const install = page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body, headers) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers });

    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      ctl.revoked = false;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer" });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      ctl.refreshes++;
      // The refresh token is NOT the thing that was revoked. This is what
      // makes the case distinct from an expiry, and what the client has to
      // notice: refresh succeeds, and the fresh token is still refused.
      return ctl.sessionOpen ? json(200, { access_token: "tok2" }) : json(401, { title: "refresh_failed" });
    }
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }

    if (ctl.revoked) {
      return json(401, { title: "Unauthorized", detail: "Session has been revoked" },
        { "www-authenticate": 'Bearer realm="medical-dictation"' });
    }

    if (path.endsWith("/auth/me")) {
      ctl.meCalls++;
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });
    if (path === "/asr/prompts") return json(200, [{ id: PROMPT_ID, language: "uk", specialty: "general", is_default: true }]);
    if (path === "/templates") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}`) return json(200, TEMPLATE_DETAIL);
    if (path === `/patients/${PID}`) return json(200, PATIENT);
    if (path === `/encounters/${ENC}`) return json(200, ENCOUNTER);
    if (/^\/patients\/[0-9a-f-]+\/consents$/.test(path) && method === "GET") return json(200, ctl.consents);
    if (/^\/patients\/[0-9a-f-]+\/(timeline|encounters|anamnesis)$/.test(path)) return json(200, { items: [] });
    return json(200, { items: [] });
  });

  return install.then(() => ctl);
}

// A fake microphone and a stand-in AudioEncoder, so the capability gate passes
// headlessly and real frames flow into the real ring.
async function installBrowserSeams(page) {
  await page.addInitScript(() => {
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const dst = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.connect(dst);
      osc.start();
      return dst.stream;
    };
    navigator.mediaDevices.enumerateDevices = async () => ([
      { deviceId: "default", kind: "audioinput", label: "Default", groupId: "g1", toJSON() { return this; } },
    ]);
    window.AudioEncoder = class {
      static async isConfigSupported() { return { supported: true }; }
      constructor({ output }) { this._out = output; }
      configure() {}
      encode() { this._out({ byteLength: 8, copyTo: (buf) => buf.set(new Uint8Array(8).fill(7)) }); }
      async flush() {}
      close() {}
    };
    window.AudioData = class { constructor(init) { Object.assign(this, init); } close() {} };
  });
}

// A socket that starts a session and then says nothing. Nothing about this
// test depends on what the transcript contains — only that audio was flowing
// when the session was revoked.
async function installSilentWs(page) {
  await page.routeWebSocket(/\/ws\/dictate/, (ws) => {
    ws.onMessage((raw) => {
      if (typeof raw !== "string") return;
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === "start_session") {
        ws.send(JSON.stringify({
          type: "session_started", protocol_version: 2, session_id: SESSION_ID,
          resumed: !!m.resume_session_id,
          last_committed_seq: m.resume_session_id ? 5 : 0,
          committed_audio_until_ms: 0, server_time_ms: 1000,
          model: "whisper-fixture", language: "uk", mode: "conversation",
        }));
      }
    });
  });
}

async function login(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
}

// Reads the recovery manifests straight out of IndexedDB. The banner is the
// user-facing proof; this is the proof that the DATA is right, which is what
// the sprint-04 guarantee is actually about.
function readManifests(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("mdx-dictation");
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("recordings")) { resolve([]); return; }
      const r = db.transaction("recordings", "readonly").objectStore("recordings").getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => resolve([]);
    };
  }));
}

function countFrames(page, sessionId) {
  return page.evaluate((sid) => new Promise((resolve) => {
    const req = indexedDB.open("mdx-dictation");
    req.onerror = () => resolve(0);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("frames")) { resolve(0); return; }
      const idx = db.transaction("frames", "readonly").objectStore("frames").index("by_session");
      const r = idx.count(IDBKeyRange.only(sid));
      r.onsuccess = () => resolve(r.result || 0);
      r.onerror = () => resolve(0);
    };
  }), sessionId);
}

// ══════════════════════════════════════════════════════════════════════
// 1. The plain case: revoked while using the app
// ══════════════════════════════════════════════════════════════════════

test("a revoked token lands on login saying the session ENDED, not that it expired", async ({ page }) => {
  const ctl = await installBackend(page);
  await login(page);

  // An administrator deactivates the account. The refresh cookie is untouched.
  ctl.revoked = true;

  // Any authenticated call now: 401 → refresh (succeeds) → retry → 401.
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));

  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });

  // NO RETRY LOOP. Every request in flight when the revocation landed refreshes
  // once — they are independent calls — but the session ends by clearing the
  // in-memory token, and a request with no bearer does not refresh. So the
  // count must go quiet, not climb, against a backend that is refusing on
  // purpose. (Before sprint 16 the second 401 fell through to a thrown
  // ApiError with the token still set, and every subsequent screen tried again.)
  const settled = ctl.refreshes;
  await page.waitForTimeout(2000);
  expect(ctl.refreshes).toBe(settled);

  // And it settled on the RIGHT reason. "We ended up at /login" is equally
  // true of an ordinary expiry, and these two owe the user different words.
  //
  // Read from the RECORDER, not from peek: the login screen consumes the
  // reason as it renders (deliberately — a reload must not re-announce an
  // ending the user already read), so by the time this line runs there is
  // nothing left to peek at.
  expect(await page.evaluate(() => window.__mdxClient.sessionEndReasons())).toContain("revoked");

  const banner = page.getByTestId("session-ended");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/Сеанс завершено|Session ended/);
  // Never an error dump.
  await expect(banner).not.toContainText(/401|Unauthorized|problem/i);
});

test("the redirect sticks — no bounce back into the workspace", async ({ page }) => {
  const ctl = await installBackend(page);
  await login(page);
  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));
  await expect(page).toHaveURL(/#\/login/);

  // The old bug: AuthContext still held a session, so App.jsx's `gateToHome`
  // effect saw "signed in, sitting on an auth route" and navigated away again.
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator(".sb-brand")).toHaveCount(0);
});

test("an ordinary expiry says something different", async ({ page }) => {
  const ctl = await installBackend(page);
  await login(page);

  // Refresh cookie gone: this is a day ending, not an incident.
  ctl.sessionOpen = false;
  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));

  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__mdxClient.sessionEndReasons())).toContain("expired");
  await expect(page.getByTestId("session-ended")).toContainText(/Термін сеансу минув|Session expired/);
});

test("signing out on purpose is not announced as an incident", async ({ page }) => {
  await installBackend(page);
  await login(page);

  await page.locator(".sb-user").click();
  await page.locator(".sb-user-menu-item.danger").click();
  // The sidebar asks first — signing out is not undoable in one click.
  await page.locator(".signout-modal-actions .btn-danger").click();

  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__mdxClient.sessionEndReasons())).toContain("signed_out");
  // No "your session was ended" banner: the user knows, they just clicked it.
  await expect(page.getByTestId("session-ended")).toHaveCount(0);
});

// ══════════════════════════════════════════════════════════════════════
// 2. The case that matters: revoked mid-consultation
// ══════════════════════════════════════════════════════════════════════

test("a revocation during recording preserves the audio and offers it back", async ({ page }) => {
  const ctl = await installBackend(page);
  await installBrowserSeams(page);
  await installSilentWs(page);
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("cv-recording")).toBeVisible({ timeout: 15_000 });

  // Let real audio frames reach the real ring.
  await expect.poll(() => countFrames(page, SESSION_ID), { timeout: 15_000 }).toBeGreaterThan(0);
  const framesWhileLive = await countFrames(page, SESSION_ID);

  // The manifest is open and ACTIVE — this is what will be offered back.
  const active = await readManifests(page);
  expect(active).toHaveLength(1);
  expect(active[0].sessionId).toBe(SESSION_ID);
  expect(active[0].status).toBe("active");
  expect(active[0].patientId).toBe(PID);
  expect(active[0].encounterId).toBe(ENC);

  // …and now the session is killed, three minutes into a consultation.
  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });

  // THE GUARANTEE. The frames are still there — every one of them.
  expect(await countFrames(page, SESSION_ID)).toBeGreaterThanOrEqual(framesWhileLive);

  // …and the manifest now knows the recording was interrupted, and why.
  const after = await readManifests(page);
  expect(after).toHaveLength(1);
  expect(after[0].status).toBe("interrupted");
  expect(after[0].reason).toBe("revoked");

  // Sign back in: the Studio offers the recording back.
  await login(page);
  await page.goto(roomUrl);
  const offer = page.getByTestId("dictation-recovery");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toContainText(/Сеанс було завершено під час запису|Your session was ended while recording/);

  // Restoring reopens THAT session, with its patient and visit intact.
  await page.getByTestId("recovery-restore").click();
  await expect(page).toHaveURL(new RegExp(`recover=${SESSION_ID}`));
  await expect(page).toHaveURL(new RegExp(`patient=${PID}`));
});

test("restoring replays the preserved frames into a RESUMED session", async ({ page }) => {
  const ctl = await installBackend(page);
  await installBrowserSeams(page);

  const started = [];
  let binaryAfterStart = 0;
  await page.routeWebSocket(/\/ws\/dictate/, (ws) => {
    let open = false;
    ws.onMessage((raw) => {
      if (typeof raw !== "string") { if (open) binaryAfterStart++; return; }
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === "start_session") {
        started.push(m);
        open = true;
        ws.send(JSON.stringify({
          type: "session_started", protocol_version: 2, session_id: SESSION_ID,
          resumed: !!m.resume_session_id, last_committed_seq: 0,
          committed_audio_until_ms: 0, server_time_ms: 1000,
          model: "whisper-fixture", language: "uk", mode: "conversation",
        }));
      }
    });
  });

  await login(page);
  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("cv-recording")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => countFrames(page, SESSION_ID), { timeout: 15_000 }).toBeGreaterThan(3);

  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });

  await login(page);
  started.length = 0;
  binaryAfterStart = 0;
  await page.goto(`${roomUrl}&recover=${SESSION_ID}`);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("cv-recording")).toBeVisible({ timeout: 15_000 });

  // The whole point: this is not a NEW session. The client asked the server to
  // resume the one whose audio it is holding — which is what lets the
  // preserved frames mean anything on the far side.
  await expect.poll(() => started.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(started[0].resume_session_id).toBe(SESSION_ID);

  // …and the preserved frames went back down the wire.
  await expect.poll(() => binaryAfterStart, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("discarding a preserved recording deletes the audio, after asking twice", async ({ page }) => {
  const ctl = await installBackend(page);
  await installBrowserSeams(page);
  await installSilentWs(page);
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("cv-recording")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => countFrames(page, SESSION_ID), { timeout: 15_000 }).toBeGreaterThan(0);

  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });

  await login(page);
  await page.goto(roomUrl);
  await expect(page.getByTestId("dictation-recovery")).toBeVisible({ timeout: 15_000 });

  // The only control in the app that can destroy a recording, so one click is
  // not enough — the first arms it, the second does it.
  const discard = page.getByTestId("recovery-discard");
  await discard.click();
  await expect(discard).toContainText(/Точно видалити|Delete for good/);
  expect(await countFrames(page, SESSION_ID)).toBeGreaterThan(0);

  await discard.click();
  await expect(page.getByTestId("dictation-recovery")).toHaveCount(0, { timeout: 10_000 });
  expect(await countFrames(page, SESSION_ID)).toBe(0);
  expect(await readManifests(page)).toEqual([]);
});

test("a consultation the clinician ended normally is never offered back", async ({ page }) => {
  await installBackend(page);
  await installBrowserSeams(page);
  await installSilentWs(page);
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("cv-recording")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => countFrames(page, SESSION_ID), { timeout: 15_000 }).toBeGreaterThan(0);

  await page.getByTestId("cv-stop").click();

  // Stop means the server holds the transcript. Keeping the local audio would
  // both offer to "recover" a finished consultation and leave patient audio on
  // a shared workstation's disk for no reason.
  await expect.poll(() => countFrames(page, SESSION_ID), { timeout: 15_000 }).toBe(0);
  expect(await readManifests(page)).toEqual([]);

  await page.goto(roomUrl);
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("dictation-recovery")).toHaveCount(0);
});

test("without recording consent nothing is recorded, so nothing is preserved", async ({ page }) => {
  // The gate that runs before any of this: an ai_scribe consent authorises
  // dictation, not recording the patient.
  const ctl = await installBackend(page, { consents: [AI_SCRIBE_CONSENT] });
  await installBrowserSeams(page);
  await installSilentWs(page);
  await login(page);

  await page.goto(roomUrl);
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible();
  await page.getByTestId("cv-start").click();

  ctl.revoked = true;
  await page.evaluate(() => window.__mdxClient.api("/auth/me").catch(() => {}));
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });

  expect(await readManifests(page)).toEqual([]);
});
