#!/usr/bin/env node
// batch-a-verify.mjs — Sprint A3 integration checkpoint harness.
//
// Drives the SPA↔backend auth contract end-to-end against the REAL backend
// (auth-service, default http://localhost:8000) using the seeded dev realm.
// Every check maps 1:1 to an acceptance criterion in the Sprint A3 spec
// (AC-A3-1 … AC-A3-7) and to the audit invariants A1 proved at the API layer.
//
// This deliberately mirrors the frontend's own request shape — form-encoded
// login, in-memory bearer token, the `mdx_rt` HttpOnly refresh cookie, and the
// `auth_refresh_replay` problem code — so a green run here means the contract
// the SPA depends on (src/api/endpoints.js + client.js) holds against the live
// stack. It sends NO tenant id anywhere; isolation is server-derived.
//
// Run:   node scripts/integration/batch-a-verify.mjs
//        npm run verify:batch-a
//
// Config via env (defaults match infra/keycloak/realm-export.json):
//   AUTH_BASE                http://localhost:8000
//   A3_ADMIN_A / _PW         admin@tenant-a.example     / dev-password
//   A3_CLINICIAN_A / _PW     clinician@tenant-a.example / dev-password
//   A3_ADMIN_B / _PW         admin@tenant-b.example     / dev-password
//
// Exit code 0 = all acceptance criteria observed; non-zero = at least one failed.

const BASE = process.env.AUTH_BASE || "http://localhost:8000";
const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";

const ACCOUNTS = {
  adminA:     { email: process.env.A3_ADMIN_A     || "admin@tenant-a.example",     pw: process.env.A3_ADMIN_A_PW     || "dev-password" },
  clinicianA: { email: process.env.A3_CLINICIAN_A || "clinician@tenant-a.example", pw: process.env.A3_CLINICIAN_A_PW || "dev-password" },
  adminB:     { email: process.env.A3_ADMIN_B     || "admin@tenant-b.example",     pw: process.env.A3_ADMIN_B_PW     || "dev-password" },
};

/* ── tiny ANSI + result tracker ─────────────────────────────── */
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", dim: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const results = [];
function record(ac, title, ok, detail) {
  results.push({ ac, title, ok, detail });
  const tag = ok ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`;
  console.log(`  ${tag}  ${C.b}${ac}${C.x} ${title}`);
  if (detail) console.log(`        ${C.dim}${detail}${C.x}`);
}
function section(name) { console.log(`\n${C.b}${name}${C.x}`); }

/* ── HTTP with a minimal cookie jar (fetch does not persist cookies) ──
   A "session" object holds its own access token + mdx_rt cookie, so we can
   run several independent actors and craft a refresh-replay by hand. */
function newSession(label) {
  return { label, accessToken: null, rt: null };
}
function captureCookie(session, res) {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const m = /^mdx_rt=([^;]*)/.exec(sc);
    if (m) session.rt = m[1] === "deleted" || m[1] === "" ? null : m[1];
  }
}
async function call(session, method, path, { body, form, bearer = true, sendCookie = false } = {}) {
  const headers = {};
  if (bearer && session.accessToken) headers["Authorization"] = `Bearer ${session.accessToken}`;
  let payload;
  if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; payload = new URLSearchParams(form).toString(); }
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  if (sendCookie && session.rt) headers["Cookie"] = `mdx_rt=${session.rt}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  captureCookie(session, res);
  let json = null;
  // Accept application/json AND application/problem+json (RFC 7807 error bodies),
  // matching how the SPA's client.js parses every response with r.json().
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) { try { json = await res.json(); } catch {} }
  return { status: res.status, json, headers: res.headers };
}

/* ── contract helpers — mirror src/api/endpoints.js exactly ─────── */
async function login(session, email, pw) {
  // Mirrors endpoints.login(): POST /auth/login, x-www-form-urlencoded.
  const r = await call(session, "POST", "/auth/login", { form: { email, password: pw }, bearer: false });
  if (r.status === 200 && r.json && r.json.access_token) session.accessToken = r.json.access_token;
  return r;
}
const me           = (s) => call(s, "GET", "/auth/me");
const refresh      = (s) => call(s, "POST", "/auth/refresh", { bearer: false, sendCookie: true });
const inviteUser   = (s, body) => call(s, "POST", "/admin/users/invite", { body });
const deactivate   = (s, sub) => call(s, "POST", `/admin/users/${encodeURIComponent(sub)}/deactivate`);
const auditEvents  = (s, params = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  return call(s, "GET", `/audit/events?${qs.toString()}`);
};
const verifyChain  = (s, params = {}) => {
  const qs = new URLSearchParams({ from_seq: "1", ...params });
  return call(s, "GET", `/audit/verify?${qs.toString()}`);
};
const eventsOf = (r) => (r.json && (r.json.events || r.json.items)) || [];

/* ── run ─────────────────────────────────────────────────────── */
async function main() {
  console.log(`${C.b}Sprint A3 — Batch-A integration verification${C.x}`);
  console.log(`${C.dim}target: ${BASE}${C.x}`);

  // Preflight: is the stack up?
  try {
    const h = await fetch(`${BASE}/healthz`, { method: "GET" });
    if (!h.ok) throw new Error(`healthz ${h.status}`);
  } catch (e) {
    console.error(`\n${C.r}Backend not reachable at ${BASE} (${e.message}).${C.x}`);
    console.error(`${C.dim}Start it from the backend repo: make dev-up && make migrate-up && make run-auth-service${C.x}`);
    process.exit(2);
  }

  const stamp = Date.now();

  /* AC-A3-1 — end-to-end login → identity from /auth/me ----------------- */
  section("AC-A3-1 · End-to-end login + identity");
  const clinA = newSession("clinicianA");
  {
    const lr = await login(clinA, ACCOUNTS.clinicianA.email, ACCOUNTS.clinicianA.pw);
    const okLogin = lr.status === 200 && !!clinA.accessToken;
    record("AC-A3-1a", "login returns an access token (in body, not a cookie)", okLogin,
      `status=${lr.status} token=${clinA.accessToken ? "present" : "missing"}`);

    const m = await me(clinA);
    const claims = m.json && m.json.claims;
    const dbUser = m.json && m.json.db_user;
    const okMe = m.status === 200 && claims && Array.isArray(claims.roles) &&
      claims.roles.includes("clinician") && dbUser && !!dbUser.display_name && claims.tid === TENANT_A;
    record("AC-A3-1b", "/auth/me yields name + effective role + tenant", okMe,
      okMe ? `name="${dbUser.display_name}" roles=${JSON.stringify(claims.roles)} tid=A`
           : `status=${m.status} body=${JSON.stringify(m.json)}`);
  }

  /* AC-A3-7 — the client never sends a tenant id; it is server-derived --- */
  section("AC-A3-7 · Tenant id is server-derived, never client-sent");
  const adminA = newSession("adminA");
  const adminB = newSession("adminB");
  {
    await login(adminA, ACCOUNTS.adminA.email, ACCOUNTS.adminA.pw);
    await login(adminB, ACCOUNTS.adminB.email, ACCOUNTS.adminB.pw);
    const ma = await me(adminA);
    const mb = await me(adminB);
    const tidA = ma.json?.claims?.tid;
    const tidB = mb.json?.claims?.tid;
    const okDerived = tidA === TENANT_A && tidB === TENANT_B && tidA !== tidB;
    record("AC-A3-7a", "two admins resolve to different, token-derived tenants", okDerived,
      `tidA=${tidA === TENANT_A ? "A" : tidA}  tidB=${tidB === TENANT_B ? "B" : tidB}`);

    // Probe: inject a foreign tenant_id into the invite body. The server must
    // ignore it and place the user in the caller's (admin A's) tenant.
    const probeEmail = `a3-probe-${stamp}@tenant-a.example`;
    const inv = await inviteUser(adminA, {
      email: probeEmail, display_name: "A3 Tenant Probe", role: "clinician",
      tenant_id: TENANT_B, tid: TENANT_B, // hostile fields — must be ignored
    });
    let landedInA = false;
    if (inv.status === 201 || inv.status === 200) {
      // The user.invited audit row is tenant-scoped by RLS; admin A must see it,
      // admin B must not. That proves the injected tenant_id was ignored.
      const seenByA = eventsOf(await auditEvents(adminA, { kind: "user.invited", limit: 200 }))
        .some((e) => JSON.stringify(e).includes(probeEmail));
      const seenByB = eventsOf(await auditEvents(adminB, { kind: "user.invited", limit: 200 }))
        .some((e) => JSON.stringify(e).includes(probeEmail));
      landedInA = seenByA && !seenByB;
      // tidy up
      if (inv.json?.sub) await deactivate(adminA, inv.json.sub);
    }
    record("AC-A3-7b", "injected tenant_id in request body is ignored (lands in caller tenant)", landedInA,
      landedInA ? "invited user surfaced only in tenant A's audit stream" : `invite status=${inv.status}`);
  }

  /* AC-A3-2 + AC-A3-3 — admin write → exactly one audit row each --------- */
  section("AC-A3-2/3 · Admin invite + deactivate → exactly one audit row each");
  let createdSub = null;
  {
    const email = `a3-verify-${stamp}@tenant-a.example`;
    const before = (await auditEvents(adminA, { kind: "user.invited", limit: 1 })).json?.events?.[0]?.seq || 0;

    const inv = await inviteUser(adminA, { email, display_name: "A3 Verify User", role: "clinician" });
    createdSub = inv.json?.sub || null;
    const okInvite = (inv.status === 201 || inv.status === 200) && inv.json?.status === "invited" && inv.json?.role === "clinician";
    record("AC-A3-2a", "invite returns 201 with status=invited, role echoed", okInvite,
      `status=${inv.status} body=${JSON.stringify(inv.json)}`);

    const invitedRows = eventsOf(await auditEvents(adminA, { kind: "user.invited", from_seq: before + 1, limit: 200 }))
      .filter((e) => JSON.stringify(e).includes(email));
    record("AC-A3-3a", "exactly one user.invited audit row for this invite", invitedRows.length === 1,
      `matched ${invitedRows.length} row(s) since seq ${before}`);

    if (createdSub) {
      const beforeD = (await auditEvents(adminA, { kind: "user.deactivated", limit: 1 })).json?.events?.[0]?.seq || 0;
      const da = await deactivate(adminA, createdSub);
      const okDeact = (da.status === 200) && da.json?.status === "deactivated";
      record("AC-A3-2b", "deactivate returns 200 with status=deactivated", okDeact,
        `status=${da.status} body=${JSON.stringify(da.json)}`);

      const deactRows = eventsOf(await auditEvents(adminA, { kind: "user.deactivated", from_seq: beforeD + 1, limit: 200 }))
        .filter((e) => JSON.stringify(e).includes(createdSub));
      record("AC-A3-3b", "exactly one user.deactivated audit row for this action", deactRows.length === 1,
        `matched ${deactRows.length} row(s) since seq ${beforeD}`);
    } else {
      record("AC-A3-2b", "deactivate returns 200 with status=deactivated", false, "no sub returned from invite");
      record("AC-A3-3b", "exactly one user.deactivated audit row for this action", false, "skipped (no sub)");
    }
  }

  /* AC-A3-4 — clinician is denied admin/audit at the SERVER (403 + audit) - */
  section("AC-A3-4 · Clinician blocked by server with 403 + authz.denied");
  {
    const invDenied = await inviteUser(clinA, { email: `nope-${stamp}@x.example`, display_name: "Nope", role: "clinician" });
    record("AC-A3-4a", "clinician → POST /admin/users/invite returns 403", invDenied.status === 403,
      `status=${invDenied.status}`);

    const auditDenied = await auditEvents(clinA, { limit: 1 });
    record("AC-A3-4b", "clinician → GET /audit/events returns 403", auditDenied.status === 403,
      `status=${auditDenied.status}`);

    // The route-guard layer (SPA RequireRole) is verified in the SPA itself;
    // here we confirm the SERVER independently denies + audits (defence in depth).
    const denials = eventsOf(await auditEvents(adminA, { kind: "authz.denied", limit: 50, severity: "sec" }));
    const clinSub = (await me(clinA)).json?.claims?.sub;
    const mine = denials.filter((e) => e.actor_sub === clinSub);
    record("AC-A3-4c", "server emitted authz.denied (sec) rows for the clinician", mine.length >= 1,
      `found ${mine.length} authz.denied row(s) for clinician sub`);
  }

  /* AC-A3-5 — silent refresh works; replayed refresh is rejected + audited */
  section("AC-A3-5 · Silent refresh + refresh-replay detection");
  {
    // A dedicated throwaway login: replay detection revokes ALL of this user's
    // sessions, so we use the clinician and run it after the 403 checks above.
    const replaySession = newSession("replay");
    await login(replaySession, ACCOUNTS.clinicianA.email, ACCOUNTS.clinicianA.pw);
    const rt0 = replaySession.rt;

    const ok1 = await refresh(replaySession); // consumes rt0, rotates to rt1
    record("AC-A3-5a", "first /auth/refresh succeeds and rotates the cookie", ok1.status === 200 && replaySession.rt && replaySession.rt !== rt0,
      `status=${ok1.status} rotated=${replaySession.rt && replaySession.rt !== rt0}`);

    // Replay the now-consumed rt0 from a fresh "attacker" session.
    const replayWithOld = await (async () => {
      const s = newSession("attacker"); s.rt = rt0; return refresh(s);
    })();
    const code = replayWithOld.json && (replayWithOld.json.code || replayWithOld.json?.detail?.code);
    const okReplay = replayWithOld.status === 401 && code === "auth_refresh_replay";
    record("AC-A3-5b", "replayed (consumed) refresh token → 401 auth_refresh_replay", okReplay,
      `status=${replayWithOld.status} code=${code ?? "none"}`);

    const replayRows = eventsOf(await auditEvents(adminA, { kind: "auth.refresh_replay_detected", limit: 20, severity: "sec" }));
    record("AC-A3-5c", "auth.refresh_replay_detected (sec) audit row present", replayRows.length >= 1,
      `found ${replayRows.length} replay-detection row(s)`);
  }

  /* AC-A3-6 — cross-tenant isolation observed through the API (RLS) ------ */
  section("AC-A3-6 · Cross-tenant isolation (RLS observed end-to-end)");
  {
    // Admin B performs a write in tenant B; admin A must never see it.
    const bEmail = `a3-bxtenant-${stamp}@tenant-b.example`;
    const invB = await inviteUser(adminB, { email: bEmail, display_name: "Tenant B User", role: "clinician" });

    // Pull a broad recent window for admin A and confirm zero tenant-B leakage.
    const aEvents = eventsOf(await auditEvents(adminA, { limit: 500 }));
    const adminBSub = (await me(adminB)).json?.claims?.sub;
    const leakByEmail = aEvents.some((e) => JSON.stringify(e).includes(bEmail));
    const leakByActor = aEvents.some((e) => e.actor_sub === adminBSub);
    const okIsolation = !leakByEmail && !leakByActor;
    record("AC-A3-6a", "tenant A admin sees zero tenant-B audit rows", okIsolation,
      `scanned ${aEvents.length} rows · leak(email)=${leakByEmail} leak(actorB)=${leakByActor}`);

    // And admin B *does* see its own row — isolation, not a broken query.
    const bEvents = eventsOf(await auditEvents(adminB, { kind: "user.invited", limit: 200 }));
    const bSeesOwn = bEvents.some((e) => JSON.stringify(e).includes(bEmail));
    record("AC-A3-6b", "tenant B admin sees its own write (isolation, not an empty query)", bSeesOwn,
      bSeesOwn ? "tenant B's invite visible to tenant B only" : "tenant B could not see its own row");

    if (invB.json?.sub) await deactivate(adminB, invB.json.sub); // tidy
  }

  /* Bonus — A1 audit-chain integrity reaffirmed through the API --------- */
  section("Bonus · Audit chain integrity (A1 invariant, reaffirmed at exit)");
  {
    const v = await verifyChain(adminA);
    record("AC-A1-chain", "GET /audit/verify reports ok:true for tenant A", v.status === 200 && v.json?.ok === true,
      `status=${v.status} ok=${v.json?.ok} checked=${v.json?.events_checked ?? "?"}`);
  }

  /* ── summary ─────────────────────────────────────────────────── */
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${C.b}Summary:${C.x} ${C.g}${passed} passed${C.x}, ${failed ? C.r : C.dim}${failed} failed${C.x} of ${results.length} checks`);
  if (failed) {
    console.log(`${C.r}Acceptance NOT met:${C.x}`);
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.ac} ${r.title}${r.detail ? ` (${r.detail})` : ""}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${C.r}Harness crashed:${C.x} ${e.stack || e.message}`);
  process.exit(3);
});
