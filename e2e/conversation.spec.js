// conversation.spec.js — FE sprint 14: conversation mode, end to end against a
// two-voice fixture that speaks the REAL v2 wire protocol.
//
// The fixture is a routed WebSocket (Playwright's routeWebSocket), so the SPA
// runs its actual client: negotiation, start_session, the partial/final stream
// with speaker fields, speaker_mapping_updated, set_speaker_mapping.
//
// What the page OFFERS in Sec-WebSocket-Protocol is read from the client's
// dev-only `window.__mdxWsOffers` seam: routing a socket replaces the
// WebSocket constructor, so the offer is unobservable from the page — and
// "conversation asks for v2, dictation never does" is the whole point of the
// negotiation VERIFY.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const PID = "11111111-1111-4111-8111-111111111111";
const ENC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const PROMPT_ID = "66666666-6666-4666-8666-666666666666";

const PATIENT = {
  id: PID, name: { uk: "Іван Петренко", en: "Ivan Petrenko" }, dob: "1984-03-12",
  sex: "M", mrn: "MRN-001", summary: { uk: "", en: "" }, tags: [], status: "active",
  last_visit: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", has_ipn: false,
};
const ENCOUNTER = {
  id: ENC, patient_id: PID, kind: "visit", reason: "головний біль",
  occurred_at: "2026-07-26T09:00:00Z", status: "in_progress", created_at: "2026-07-26T09:00:00Z",
};
const TEMPLATE_DETAIL = {
  id: TEMPLATE_ID, code: "GEN", name: "General note", specialty: "general",
  is_system: true, status: "active", language: "uk", schema_version: 1,
  schema_jsonb: {
    sections: [{ id: "anamnesis", name: "Anamnesis", order: 0, required: false, field_type: "text", voice_aliases: ["anamnesis"] }],
  },
};

const RECORDING_CONSENT = {
  id: "c-rec", patient_id: PID, encounter_id: null, type: "recording", method: "verbal",
  version: "v1", status: "granted", granted_at: "2026-07-26T08:00:00Z", withdrawn_at: null,
  signed_envelope_id: null,
};
const AI_SCRIBE_CONSENT = { ...RECORDING_CONSENT, id: "c-ai", type: "ai_scribe" };

// The consultation the fixture plays, in wire order. Shaped from the backend's
// own end-to-end run (sign-off: "13 finals with correct turn structure; 1
// turn-straddling segment honestly UNKNOWN; 2 early segments pending"):
//
//   seq 0  doctor  "що вас турбує"   label TRAILS by a window, then lands
//   seq 1  —       "угу"             turn-straddling → honestly UNKNOWN
//   seq 2  patient "болить голова"   MISLABELLED S1 at 0.41 — the flip target
//   seq 3  patient "вже тиждень"     correctly S2
//
// The mislabel sits between an UNKNOWN and an S2 on purpose: a mislabel
// adjacent to a correct turn of the SAME label merges into it (which is what
// a mislabel looks like), and a turn-level flip could then not separate them.
// That merging rule has its own test below; this stream exercises the flip.
const SCRIPT = [
  { seq: 0, text: "що вас турбує", speaker: "S1", conf: 0.92, trails: true },
  { seq: 1, text: "угу", speaker: "UNKNOWN", conf: 0.2 },
  { seq: 2, text: "болить голова", speaker: "S1", conf: 0.41 },
  { seq: 3, text: "вже тиждень", speaker: "S2", conf: 0.88 },
];

// The persisted transcript GET /dictate/sessions/{id} returns after finalize:
// segment UUIDs (minted at finalize, never on the wire) + the server's labels.
const PERSISTED = SCRIPT.map((s, i) => ({
  id: `seg-${i + 1}`,
  text: s.text,
  start_ms: s.seq * 1000,
  end_ms: s.seq * 1000 + 900,
  speaker: s.speaker,
  speaker_confidence: s.conf,
  speaker_role: s.speaker === "S1" ? "doctor" : s.speaker === "S2" ? "patient" : null,
  words: [],
}));

function newCalls() {
  return { consentCreate: [], reportCreate: [], wsMessages: [], sockets: [] };
}

async function installMocks(page, calls, { consents = [RECORDING_CONSENT] } = {}) {
  const ctl = { sessionOpen: false, consents: [...consents] };
  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8005", "8006", "8007", "8008"].includes(url.port);

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      return ctl.sessionOpen ? json(200, { access_token: "tok" }) : json(401, { title: "refresh_failed" });
    }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, {
        claims: { sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
        db_user: { email: "user@tenant-a.example", display_name: "Dr Test", role: "clinician", status: "active" },
      });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    if (path === "/asr/prompts") return json(200, [{ id: PROMPT_ID, language: "uk", specialty: "general", is_default: true }]);

    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_DETAIL] });
    if (path === `/templates/${TEMPLATE_ID}` && method === "GET") return json(200, TEMPLATE_DETAIL);

    if (path === `/patients/${PID}` && method === "GET") return json(200, PATIENT);
    if (path === `/encounters/${ENC}` && method === "GET") return json(200, ENCOUNTER);
    if (/^\/patients\/[0-9a-f-]+\/consents$/.test(path) && method === "GET") return json(200, ctl.consents);
    if (/^\/patients\/[0-9a-f-]+\/consents$/.test(path) && method === "POST") {
      const body = req.postDataJSON();
      calls.consentCreate.push(body);
      const created = { ...RECORDING_CONSENT, id: `c-${calls.consentCreate.length}`, ...body };
      ctl.consents.push(created);
      return json(201, created);
    }
    if (/^\/patients\/[0-9a-f-]+\/(timeline|encounters|anamnesis)$/.test(path)) return json(200, { items: [] });

    if (path === `/dictate/sessions/${SESSION_ID}` && method === "GET") {
      return json(200, {
        id: SESSION_ID, tenant_id: TENANT_A, user_id: "user-123", status: "finalized",
        language: "uk", target_kind: "generic", prompt_id: PROMPT_ID,
        transcript: PERSISTED, total_audio_ms: 3400, avg_partial_latency_ms: 400,
        avg_final_latency_ms: 600, network_drop_count: 0,
        started_at: "2026-07-26T09:00:00Z", last_active_at: "2026-07-26T09:01:00Z",
        finalized_at: "2026-07-26T09:01:00Z",
      });
    }

    if (path === "/v1/reports" && method === "POST") {
      calls.reportCreate.push(req.postDataJSON());
      return json(201, { id: "report-1", code: "R-1", version_id: "v1", version_number: 1, status: "draft" });
    }
    if (/^\/v1\/reports\/[^/]+$/.test(path) && method === "GET") {
      return json(200, {
        id: "report-1", code: "R-1", status: "draft", current_version_number: 1,
        patient_id: PID,
        content: {
          template_id: TEMPLATE_ID, template_schema_version: 1,
          sections: [{ section_key: "anamnesis", text: calls.reportCreate[0]?.content?.sections?.[0]?.text || "" }],
        },
      });
    }
    if (/^\/v1\/reports\/[^/]+\/draft$/.test(path) && method === "PUT") {
      return json(200, { id: "report-1", version_number: 2, status: "draft" });
    }

    return json(200, { items: [] });
  });
  return ctl;
}

// Grants a fake microphone and a fake Opus encoder so the capability gate
// passes headlessly. Everything above the encoder — framing, sequencing, the
// protocol — is the real code.
async function installBrowserSeams(page) {
  await page.addInitScript(() => {
    // A microphone that exists but produces a tone: conversation mode must
    // reach the socket, and the fixture supplies the transcript.
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

    // WebCodecs AudioEncoder stand-in. Always installed, never conditionally:
    // a test whose behaviour depends on whether the CI image ships the Opus
    // encoder is a test that reports different things on different machines.
    // It emits one packet per encode, exactly like the real one — everything
    // above it (framing, sequencing, the ring, the protocol) is real code.
    window.AudioEncoder = class {
      static async isConfigSupported() { return { supported: true }; }
      constructor({ output }) { this._out = output; }
      configure() {}
      encode() {
        this._out({ byteLength: 8, copyTo: (buf) => buf.set(new Uint8Array(8).fill(7)) });
      }
      async flush() {}
      close() {}
    };
    window.AudioData = class {
      constructor(init) { Object.assign(this, init); }
      close() {}
    };
  });
}

// The two-voice fixture. Speaks v2 and nothing else.
//
// `labelLag` reproduces the documented behaviour that diarization trails the
// text by up to one window: the segment is announced with speaker:null and
// resolved on a later frame carrying the SAME seq.
async function installConversationWs(page, calls, opts = {}) {
  const { mappingUpdates = true, dropOnce = false } = opts;

  await page.routeWebSocket(/\/ws\/dictate/, (ws) => {
    calls.sockets.push(ws.url());
    const send = (obj) => ws.send(JSON.stringify(obj));
    const base = { session_id: SESSION_ID };
    let opened = 0;

    ws.onMessage((raw) => {
      if (typeof raw !== "string") return;      // binary audio frames
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      calls.wsMessages.push(m);

      if (m.type === "start_session") {
        opened += 1;
        send({
          type: "session_started", protocol_version: 2, session_id: SESSION_ID,
          resumed: !!m.resume_session_id,
          last_committed_seq: m.resume_session_id ? 40 : 0,
          committed_audio_until_ms: m.resume_session_id ? 2000 : 0,
          server_time_ms: 1000, model: "whisper-fixture", language: "uk",
          mode: "conversation",
        });
        if (m.resume_session_id) return;        // committed turns stay rendered

        // ── the consultation ─────────────────────────────────────────
        const final = (s, speaker, conf) => send({
          ...base, type: "final", seq: s.seq, text: s.text,
          start_ms: s.seq * 1000, end_ms: s.seq * 1000 + 900,
          words: [], avg_confidence: 0.9, is_provisional: false, voice_command: null,
          speaker, speaker_confidence: conf, speaker_mapping_hint: null,
        });

        // The live tail arrives before anything is committed.
        setTimeout(() => {
          send({ ...base, type: "partial", seq: 0, text: "що вас", start_ms: 0, end_ms: 500, words: [], avg_confidence: 0.9, speaker: null, speaker_confidence: null, speaker_mapping_hint: null });
        }, 40);

        SCRIPT.forEach((s, i) => {
          setTimeout(() => {
            // `trails`: the segment is committed with NO label — diarization is
            // one window behind. Text must render now regardless.
            final(s, s.trails ? null : s.speaker, s.trails ? null : s.conf);
          }, 80 + i * 60);
        });

        // …and the label for the trailing segment lands a window later, on the
        // SAME seq. This is the backfill the UI must absorb in place.
        const trailing = SCRIPT.find((s) => s.trails);
        if (trailing) setTimeout(() => final(trailing, trailing.speaker, trailing.conf), 420);

        // The inference forms, then changes its mind — both recolour the
        // already-rendered turns.
        if (mappingUpdates) {
          setTimeout(() => {
            send({ type: "speaker_mapping_updated", session_id: SESSION_ID, mapping: { S1: "doctor", S2: "patient" }, confidence: 0.72, rationale: "opener 0.81 vs 0.19", manual: false });
          }, 560);
          setTimeout(() => {
            send({ type: "speaker_mapping_updated", session_id: SESSION_ID, mapping: { S1: "patient", S2: "doctor" }, confidence: 0.9, rationale: "clinician-register density 0.77 vs 0.23", manual: false });
          }, 1500);
        }

        if (dropOnce && opened === 1) {
          setTimeout(() => ws.close({ code: 1006, reason: "network" }), 900);
        }
        return;
      }

      if (m.type === "set_speaker_mapping") {
        // The server's acknowledgement; after this it never re-infers.
        send({ type: "speaker_mapping_updated", session_id: SESSION_ID, mapping: m.mapping, confidence: 1, rationale: "", manual: true });
        return;
      }

      if (m.type === "end_session") {
        send({ type: "session_terminated", session_id: SESSION_ID, reason: "normal", finalized_audio_file_id: null });
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

const roomUrl = `/#/studio?mode=scribe&patient=${PID}&encounter=${ENC}`;

// ══════════════════════════════════════════════════════════════════════
// 1. Consent gating + subprotocol negotiation
// ══════════════════════════════════════════════════════════════════════

test("no recording consent → the socket is NEVER opened", async ({ page }) => {
  const calls = newCalls();
  // An ai_scribe consent is present — it authorises dictation, not recording
  // the patient. It must not satisfy this gate.
  await installMocks(page, calls, { consents: [AI_SCRIBE_CONSENT] });
  await installBrowserSeams(page);
  await installConversationWs(page, calls);
  await login(page);

  await page.goto(roomUrl);
  await expect(page.getByTestId("consent-gate-banner")).toBeVisible();
  await page.getByTestId("cv-start").click();

  // The consent sheet opens instead — and it is the RECORDING sheet.
  const sheet = page.getByTestId("consent-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-consent-type", "recording");
  await expect(page.getByText(/Записується вся розмова/)).toBeVisible();

  expect(calls.sockets).toHaveLength(0);
  expect(await page.evaluate(() => (window.__mdxWsOffers || []).length)).toBe(0);
});

test("consent granted → conversation negotiates v2 (v2 first, v1 fallback)", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls);
  await login(page);

  await page.goto(roomUrl);
  await expect(page.getByTestId("consent-gate-banner")).toHaveCount(0);
  await page.getByTestId("cv-start").click();

  await expect(page.getByTestId("cv-recording")).toBeVisible();
  const offers = await page.evaluate(() => window.__mdxWsOffers || []);
  expect(offers).toHaveLength(1);
  expect(offers[0].mode).toBe("conversation");
  expect(offers[0].protocols).toEqual(["medical-dictation.v2", "medical-dictation.v1"]);

  const start = calls.wsMessages.find((m) => m.type === "start_session");
  expect(start.protocol_version).toBe(2);
  expect(start.mode).toBe("conversation");
  expect(start.encounter_id).toBe(ENC);
  // No template_id: with one, the service writes the draft from ITS labels and
  // the clinician's review would be lost.
  expect(start.template_id).toBeUndefined();
});

test("dictation still negotiates v1 only, with no mode key (zero regression)", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await login(page);

  // Drive the shared client the way the dictation path does: v1, no mode.
  await page.goto(`/#/studio?mode=dictate&patient=${PID}&encounter=${ENC}`);
  await expect(page.locator(".ProseMirror").first()).toBeVisible({ timeout: 10000 });

  const wire = await page.evaluate(async () => {
    const mod = await import("/src/dictation/wsClient.js");
    return {
      offers: mod.subprotocolsFor("dictation"),
      start: mod.msgStartSession({ promptId: "p1", language: "uk", targetKind: "generic", encounterId: "e1" }),
    };
  });
  expect(wire.offers).toEqual(["medical-dictation.v1"]);
  expect(wire.start).toEqual({
    type: "start_session", protocol_version: 1, prompt_id: "p1", language: "uk",
    target_kind: "generic", encounter_id: "e1",
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Turn rendering with trailing labels
// ══════════════════════════════════════════════════════════════════════

test("text renders before its label; the label backfills; UNKNOWN stays grey", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();

  // The first turn's TEXT is on screen while its speaker is still unresolved.
  const first = page.getByTestId("turn").first();
  await expect(first).toContainText("що вас турбує");
  await expect(first).toHaveAttribute("data-speaker", "pending");

  // …and the label lands on the same bubble, without duplicating it.
  await expect(first).toHaveAttribute("data-speaker", "S1");
  await expect(first).toContainText("що вас турбує");

  await expect(page.getByTestId("turn")).toHaveCount(4);
  const unknown = page.getByTestId("turn").nth(1);
  await expect(unknown).toHaveAttribute("data-speaker", "UNKNOWN");
  await expect(unknown).toContainText("угу");
  await expect(unknown.getByTestId("speaker-chip")).toContainText("Невідомо");
});

test("consecutive same-speaker finals merge into ONE bubble", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await page.routeWebSocket(/\/ws\/dictate/, (ws) => {
    ws.onMessage((raw) => {
      if (typeof raw !== "string") return;
      const m = JSON.parse(raw);
      if (m.type !== "start_session") return;
      ws.send(JSON.stringify({
        type: "session_started", protocol_version: 2, session_id: SESSION_ID, resumed: false,
        last_committed_seq: 0, committed_audio_until_ms: 0, server_time_ms: 1,
        model: "fixture", language: "uk", mode: "conversation",
      }));
      const f = (seq, text, speaker) => ws.send(JSON.stringify({
        type: "final", session_id: SESSION_ID, seq, text, start_ms: seq * 1000, end_ms: seq * 1000 + 900,
        words: [], avg_confidence: 0.9, is_provisional: false, voice_command: null,
        speaker, speaker_confidence: 0.9, speaker_mapping_hint: null,
      }));
      setTimeout(() => { f(0, "добрий день", "S1"); f(1, "що вас турбує", "S1"); f(2, "болить голова", "S2"); }, 50);
    });
  });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("turn")).toHaveCount(2);
  await expect(page.getByTestId("turn").first()).toContainText("добрий день що вас турбує");
});

// ══════════════════════════════════════════════════════════════════════
// 3. Correction + mapping controls
// ══════════════════════════════════════════════════════════════════════

test("tap-flip corrects one turn and marks it confirmed", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("turn")).toHaveCount(4);

  // "болить голова" was put in the doctor's voice at 0.41 — flip it.
  const wrong = page.getByTestId("turn").nth(2);
  await expect(wrong).toHaveAttribute("data-speaker", "S1");
  await wrong.getByTestId("speaker-chip").click();

  await expect(wrong).toHaveAttribute("data-speaker", "S2");
  await expect(wrong).toHaveAttribute("data-source", "clinician");
  // Confirmed = solid; and a confirmed label carries no confidence meter.
  await expect(wrong.getByTestId("speaker-chip")).toHaveClass(/pgm-confirmed/);
  await expect(wrong.getByTestId("speaker-chip").locator(".pgm-conf")).toHaveCount(0);
});

test("swap sends set_speaker_mapping, freezes, and later inference is ignored", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls);   // emits a mapping FLIP at ~1400ms
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();

  const banner = page.getByTestId("mapping-banner");
  await expect(banner).toContainText(/Синій — лікар|Зелений — лікар/);

  await page.getByTestId("mapping-swap").click();

  const sent = calls.wsMessages.find((m) => m.type === "set_speaker_mapping");
  expect(sent).toBeTruthy();
  expect(Object.values(sent.mapping).sort()).toEqual(["doctor", "patient"]);
  await expect(banner).toHaveAttribute("data-frozen", "true");
  await expect(page.getByTestId("mapping-frozen")).toBeVisible();

  // The pre-scheduled inference update arrives AFTER the freeze and must not
  // repaint the answer the clinician just gave.
  const frozenText = await banner.locator(".cv-mapping-text").innerText();
  await page.waitForTimeout(1600);
  await expect(banner.locator(".cv-mapping-text")).toHaveText(frozenText);
  await expect(banner).toHaveAttribute("data-source", "manual");
});

test("a pre-freeze mapping update recolours turns without moving the scroll", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls);
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();

  const first = page.getByTestId("turn").first();
  await expect(first).toHaveAttribute("data-role", "doctor");     // first hypothesis
  const before = await page.getByTestId("turn-list").evaluate((el) => el.scrollTop);

  await expect(first).toHaveAttribute("data-role", "patient");    // the flip lands
  const after = await page.getByTestId("turn-list").evaluate((el) => el.scrollTop);
  expect(after).toBe(before);
});

test("long-press menu assigns a role explicitly", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  const unknownTurn = page.getByTestId("turn").nth(1);
  await unknownTurn.locator(".cv-turn-more").click();
  await expect(page.getByTestId("speaker-menu")).toBeVisible();
  await page.getByTestId("speaker-menu").getByRole("menuitem", { name: "Це пацієнт" }).click();

  await expect(unknownTurn).toHaveAttribute("data-source", "clinician");
  await expect(unknownTurn.getByTestId("speaker-chip")).toContainText("Пацієнт");
});

// ══════════════════════════════════════════════════════════════════════
// 4. No voice-command surface
// ══════════════════════════════════════════════════════════════════════

test("conversation mode shows NO voice-command hints or undo toast", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("turn").first()).toBeVisible();

  // The sprint-05 command surfaces, by their own selectors.
  await expect(page.locator(".cmd-ref")).toHaveCount(0);
  await expect(page.locator(".cmd-list")).toHaveCount(0);
  await expect(page.locator(".toast-stack")).toHaveCount(0);
  const body = await page.locator(".cv-room").innerText();
  expect(body).not.toMatch(/новий абзац|Голосові команди(?!.*не працюють)/);
});

test("dictation mode still shows the voice-command reference (unchanged)", async ({ page }) => {
  await installMocks(page, newCalls());
  await installBrowserSeams(page);
  await login(page);
  await page.goto(`/#/studio?mode=dictate&patient=${PID}&encounter=${ENC}`);
  // (.cmd-ref is shared with the autocomplete settings panel — the first is
  //  the command reference itself)
  await expect(page.locator(".cmd-ref").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".cmd-list")).toBeVisible();
});

// ══════════════════════════════════════════════════════════════════════
// 5. Finalize → review → draft
// ══════════════════════════════════════════════════════════════════════

test("corrections survive into the draft, which opens in the Studio", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("turn")).toHaveCount(4);

  // Establish the mapping the clinician actually means: the opening question
  // was theirs, so voice 1 is the clinician (and voice 2 the patient).
  await page.getByTestId("turn").first().locator(".cv-turn-more").click();
  await page.getByTestId("speaker-menu").getByRole("menuitem", { name: "Це лікар" }).click();
  await expect(page.getByTestId("mapping-frozen")).toBeVisible();

  // Then correct the mislabelled turn: "болить голова" was the PATIENT.
  await page.getByTestId("turn").nth(2).getByTestId("speaker-chip").click();  // S1 → S2
  await expect(page.getByTestId("turn").nth(2)).toHaveAttribute("data-role", "patient");

  await page.getByTestId("cv-stop").click();
  await expect(page.getByTestId("cv-create-draft")).toBeVisible();
  expect(calls.wsMessages.some((m) => m.type === "end_session")).toBe(true);

  await page.getByTestId("cv-create-draft").click();
  await expect.poll(() => calls.reportCreate.length, { timeout: 8000 }).toBe(1);

  const payload = calls.reportCreate[0];
  const section = payload.content.sections[0];
  expect(payload.patient_id).toBe(PID);
  expect(payload.source_session_id).toBe(SESSION_ID);
  // Sprint-08 linkage: the segment UUIDs read back from the persisted
  // transcript (they never appear on the wire).
  expect(section.transcript_segment_ids).toEqual(["seg-1", "seg-2", "seg-3", "seg-4"]);

  // THE ASSERTION THIS WHOLE SPRINT EXISTS FOR: the clinician flipped
  // "болить голова" off the doctor, and the record says so.
  expect(section.text).toContain("ПАЦІЄНТ: болить голова");
  expect(section.text).not.toContain("ЛІКАР: болить голова");
  expect(section.text).toContain("НЕВІДОМО: угу");

  await expect(page).toHaveURL(/report=report-1/);
  await expect(page.locator(".ProseMirror").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".ProseMirror").first()).toContainText("болить голова");
});

// ══════════════════════════════════════════════════════════════════════
// 6. Resume
// ══════════════════════════════════════════════════════════════════════

test("a dropped socket resumes and the committed turns stay on screen", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls, { mappingUpdates: false, dropOnce: true });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();
  await expect(page.getByTestId("turn")).toHaveCount(4);

  // The socket dies at ~700ms; the client resumes with the same session id.
  await expect.poll(
    () => calls.wsMessages.filter((m) => m.type === "start_session").length,
    { timeout: 10000 },
  ).toBe(2);

  const resume = calls.wsMessages.filter((m) => m.type === "start_session")[1];
  expect(resume.resume_session_id).toBe(SESSION_ID);
  expect(resume.protocol_version).toBe(2);
  expect(resume.mode).toBe("conversation");

  // Committed turns, with their speakers, are still rendered — not re-fetched,
  // not lost, not duplicated.
  await expect(page.getByTestId("turn")).toHaveCount(4);
  await expect(page.getByTestId("turn").first()).toHaveAttribute("data-speaker", "S1");
  await expect(page.getByTestId("turn").nth(1)).toHaveAttribute("data-speaker", "UNKNOWN");
  await expect(page.getByTestId("cv-recording")).toBeVisible();
});

// ── the service is simply not there ──────────────────────────────────
//
// The single most common real failure, and the one this room used to handle
// worst: dictation-service down or restarting, so the socket closes before
// session_started. The clinician saw «Помилка сесії (connect_failed)» — an
// internal identifier — on a live-looking recording surface, with
// "Завершити розмову" as the only exit. Nothing was recorded, and nothing on
// screen said so.
test("a socket that never starts a session returns to the intro and says so", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  // The upgrade succeeds and the connection is then cut — exactly what a
  // crash-looping worker looks like from the browser.
  await page.routeWebSocket(/\/ws\/dictate/, (ws) => {
    calls.sockets.push(ws.url());
    ws.onMessage(() => ws.close({ code: 1006 }));
    setTimeout(() => ws.close({ code: 1006 }), 50);
  });
  await login(page);

  await page.goto(roomUrl);
  await page.getByTestId("cv-start").click();

  const room = page.getByTestId("conversation-room");
  await expect(room).toHaveAttribute("data-phase", "intro");
  await expect(page.getByTestId("cv-recording")).toHaveCount(0);

  const err = page.getByTestId("cv-error");
  await expect(err).toBeVisible();
  await expect(err).toContainText(/нічого не записано/i);
  await expect(err).not.toContainText(/connect_failed/);

  // The start button is the retry, and it still works.
  await expect(page.getByTestId("cv-start")).toBeEnabled();
});

// A visit that is over cannot take a recording — dictation-service refuses it
// with `encounter_closed`. Finding that out costs a consent conversation with
// the patient unless the room checks first.
test("a completed visit blocks the start before consent is ever asked for", async ({ page }) => {
  const calls = newCalls();
  await installMocks(page, calls);
  await installBrowserSeams(page);
  await installConversationWs(page, calls);
  // Override the encounter with a finished one.
  await page.route(`**/encounters/${ENC}`, (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ...ENCOUNTER, status: "completed" }),
    }));
  await login(page);

  await page.goto(roomUrl);
  await expect(page.getByTestId("cv-visit-closed")).toBeVisible();
  await expect(page.getByTestId("cv-start")).toBeDisabled();
  expect(calls.sockets).toHaveLength(0);
});
