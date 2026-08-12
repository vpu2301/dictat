// adminMocks.js — the mocked backend the admin-console specs drive (sprint 17).
//
// One installer, parameterised by WHO signs in and which failure fixtures are
// armed, mirroring the wire shapes the console reads:
//   auth-service  /auth/*  /admin/users*  /audit/events  /audit/verify  /auth/mfa/*
//
// The mock keeps a mutable user map so a PUT …/roles round-trips: the next
// /auth/me for that user reflects the new set, which is how the "target's nav
// changes on their next login" assertion works without a real backend.

const DEV_SERVER_PORT = "5173";

export const TENANT_A = "00000000-0000-0000-0000-00000000000a";
export const ADMIN_SUB = "0a000000-0000-0000-0000-00000000000a";
export const ADMIN_EMAIL = "admin@tenant-a.example";
export const CLINICIAN_SUB = "0c000000-0000-0000-0000-00000000000a";
export const CLINICIAN_EMAIL = "clinician@tenant-a.example";
export const OTP = "123456";

export function defaultUsers() {
  return [
    {
      sub: ADMIN_SUB, email: ADMIN_EMAIL, display_name: "Dev Admin A",
      roles: ["tenant_admin"], status: "active",
      created_at: "2026-01-01T00:00:00Z", last_login_at: "2026-08-01T08:00:00Z",
      mfa_enrolled_at: null,
    },
    {
      sub: CLINICIAN_SUB, email: CLINICIAN_EMAIL, display_name: "Dev Clinician A",
      roles: ["clinician"], status: "active",
      created_at: "2026-01-02T00:00:00Z", last_login_at: "2026-08-05T08:00:00Z",
      mfa_enrolled_at: "2026-07-01T10:00:00Z",
    },
    {
      sub: "0d000000-0000-0000-0000-00000000000a", email: "nurse@tenant-a.example",
      display_name: "Dev Nurse A", roles: ["nurse"], status: "deactivated",
      created_at: "2026-01-03T00:00:00Z", last_login_at: null, mfa_enrolled_at: null,
    },
  ];
}

export function defaultAuditEvents() {
  const t = (h) => new Date(Date.UTC(2026, 7, 8, h)).toISOString();
  return [
    { seq: 1, created_at: t(1), actor_sub: ADMIN_SUB, actor_role: "tenant_admin", kind: "auth.login", target_kind: "user", target_id: ADMIN_SUB, payload: { ok: true }, severity: "info" },
    { seq: 2, created_at: t(2), actor_sub: ADMIN_SUB, actor_role: "tenant_admin", kind: "user.invited", target_kind: "user", target_id: CLINICIAN_SUB, payload: { email: CLINICIAN_EMAIL }, severity: "info" },
    { seq: 3, created_at: t(3), actor_sub: ADMIN_SUB, actor_role: "tenant_admin", kind: "user.role_changed", target_kind: "user", target_id: CLINICIAN_SUB, payload: { old_roles: ["clinician"], new_roles: ["clinician", "auditor"] }, severity: "sec" },
    { seq: 4, created_at: t(4), actor_sub: CLINICIAN_SUB, actor_role: "clinician", kind: "template.cloned", target_kind: "template", target_id: "11111111-0000-4000-8000-000000000001", payload: { code: "cardio" }, severity: "info" },
    { seq: 5, created_at: t(5), actor_sub: ADMIN_SUB, actor_role: "tenant_admin", kind: "user.deactivated", target_kind: "user", target_id: "0d000000-0000-0000-0000-00000000000a", payload: {}, severity: "sec" },
  ];
}

const PRECEDENCE = ["tenant_admin", "clinician", "nurse", "auditor", "knowledge_admin", "service"];
const primaryRole = (roles) => PRECEDENCE.find((r) => roles.includes(r)) || roles[0] || "clinician";

const summaryOf = (u) => ({
  sub: u.sub, email: u.email, display_name: u.display_name,
  role: primaryRole(u.roles), status: u.status,
});

/**
 * Options:
 *   users          — user fixtures (mutable copies are kept in ctl.users)
 *   graceOn        — MFA required: mutations 403 `mfa_enrolment_required`
 *                    until the session enrols (then they pass)
 *   lastAdmin409   — the roles PUT answers the last-admin conflict when the
 *                    write would strip tenant_admin from the last holder
 *   forbidUsersList— GET /admin/users answers 403 (server-boundary check)
 *   auditEvents    — audit fixture
 *   tamperedVerify — /audit/verify reports a payload_hash_mismatch
 */
export async function installAdminMocks(page, {
  users = defaultUsers(),
  graceOn = false,
  lastAdmin409 = true,
  forbidUsersList = false,
  auditEvents = defaultAuditEvents(),
  tamperedVerify = false,
} = {}) {
  const ctl = {
    sessionOpen: false,
    currentEmail: null,
    enrolled: false,   // did THIS browser session complete TOTP enrolment?
    users: users.map((u) => ({ ...u, roles: [...u.roles] })),
    auditQueries: [],
    verifyQueries: [],
    calls: { invites: [], rolePuts: [], deactivates: [], reactivates: [], mfaResets: [] },
    graceOn,
    lastAdmin409,
    forbidUsersList,
    tamperedVerify,
    auditEvents,
  };

  const isApi = (url) =>
    url.hostname === "localhost" && !!url.port && url.port !== DEV_SERVER_PORT;

  const me = () => ctl.users.find((u) => u.email === ctl.currentEmail) || null;

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const problem = (status, detail, extras = {}) =>
      json(status, { type: "about:blank", title: "Problem", status, detail, instance: "urn:uuid:mock", ...extras });

    // The MFA gate every mutation sits behind when the deployment requires it.
    const mfaGate = () => {
      if (ctl.graceOn && !ctl.enrolled) {
        problem(403, "MFA enrolment required for this endpoint", { code: "mfa_enrolment_required" });
        return true;
      }
      return false;
    };

    // ── auth ─────────────────────────────────────────────────────────
    if (path.endsWith("/auth/login") && method === "POST") {
      const form = new URLSearchParams(req.postData() || "");
      ctl.currentEmail = form.get("email");
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer" });
    }
    if (path.endsWith("/auth/refresh") && method === "POST")
      return ctl.sessionOpen ? json(200, { access_token: "tok" }) : json(401, { title: "refresh_failed" });
    if (path.endsWith("/auth/logout") && method === "POST") {
      ctl.sessionOpen = false;
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      const u = me();
      if (!u) return json(401, { title: "expired" });
      return json(200, {
        claims: {
          sub: u.sub, tid: TENANT_A, roles: [...u.roles], scope: "openid",
          iss: "mock", mfa: ctl.enrolled, mfa_enrolled: ctl.enrolled || !!u.mfa_enrolled_at,
        },
        db_user: {
          sub: u.sub, tenant_id: TENANT_A, email: u.email, display_name: u.display_name,
          role: primaryRole(u.roles), status: u.status,
          mfa_enrolled_at: u.mfa_enrolled_at, last_login_at: u.last_login_at,
        },
      });
    }

    // ── MFA enrolment ────────────────────────────────────────────────
    if (path === "/auth/mfa/enrol" && method === "POST") {
      return json(200, {
        provisioning_uri: "otpauth://totp/Mock:admin?secret=GEZDGNBVGY3TQOJQ&issuer=Mock",
        secret: "GEZDGNBVGY3TQOJQ", issuer: "Mock", account: ctl.currentEmail,
      });
    }
    if (path === "/auth/mfa/verify" && method === "POST") {
      const body = req.postDataJSON?.() || {};
      if (body.code !== OTP) return problem(400, "invalid TOTP code");
      ctl.enrolled = true;
      const u = me();
      if (u) u.mfa_enrolled_at = "2026-08-08T12:00:00Z";
      return json(200, { enrolled: true, enrolled_at: "2026-08-08T12:00:00Z" });
    }
    const mfaReset = path.match(/^\/auth\/mfa\/([0-9a-z-]+)$/);
    if (mfaReset && method === "DELETE") {
      if (mfaGate()) return;
      ctl.calls.mfaResets.push(mfaReset[1]);
      const u = ctl.users.find((x) => x.sub === mfaReset[1]);
      if (!u) return problem(404, "user not found in this tenant");
      u.mfa_enrolled_at = null;
      return route.fulfill({ status: 204, body: "" });
    }

    // ── users ────────────────────────────────────────────────────────
    if (path === "/admin/users" && method === "GET") {
      if (ctl.forbidUsersList)
        return problem(403, "deny: roles=['clinician'] cannot 'user.read' on 'user'");
      const limit = Number(url.searchParams.get("limit") || 50);
      const offset = Number(url.searchParams.get("offset") || 0);
      return json(200, ctl.users.slice(offset, offset + limit).map(summaryOf));
    }
    const userDetail = path.match(/^\/admin\/users\/([0-9a-z-]+)$/);
    if (userDetail && method === "GET") {
      const u = ctl.users.find((x) => x.sub === userDetail[1]);
      if (!u) return problem(404, "user not found in this tenant");
      return json(200, {
        ...summaryOf(u),
        created_at: u.created_at, updated_at: u.created_at,
        last_login_at: u.last_login_at, mfa_enrolled_at: u.mfa_enrolled_at,
      });
    }
    if (path === "/admin/users/invite" && method === "POST") {
      if (mfaGate()) return;
      const body = req.postDataJSON?.() || {};
      ctl.calls.invites.push(body);
      if (ctl.users.some((u) => u.email === body.email))
        return problem(409, "email already registered");
      const sub = `0e000000-0000-0000-0000-${String(ctl.users.length).padStart(12, "0")}`;
      ctl.users.push({
        sub, email: body.email, display_name: body.display_name,
        roles: [body.role], status: "invited",
        created_at: new Date().toISOString(), last_login_at: null, mfa_enrolled_at: null,
      });
      return json(201, { sub, email: body.email, role: body.role, status: "invited" });
    }
    const userAct = path.match(/^\/admin\/users\/([0-9a-z-]+)\/(deactivate|reactivate|roles)$/);
    if (userAct) {
      if (mfaGate()) return;
      const u = ctl.users.find((x) => x.sub === userAct[1]);
      if (!u) return problem(404, "user not found in this tenant");
      if (userAct[2] === "deactivate" && method === "POST") {
        ctl.calls.deactivates.push(u.sub);
        u.status = "deactivated";
        return json(200, { sub: u.sub, status: "deactivated" });
      }
      if (userAct[2] === "reactivate" && method === "POST") {
        ctl.calls.reactivates.push(u.sub);
        u.status = "active";
        return json(200, { sub: u.sub, status: "active" });
      }
      if (userAct[2] === "roles" && method === "PUT") {
        const body = req.postDataJSON?.() || {};
        ctl.calls.rolePuts.push({ sub: u.sub, roles: body.roles });
        const desired = body.roles || [];
        const wasAdmin = u.roles.includes("tenant_admin");
        const staysAdmin = desired.includes("tenant_admin");
        if (ctl.lastAdmin409 && wasAdmin && !staysAdmin) {
          const admins = ctl.users.filter(
            (x) => x.roles.includes("tenant_admin") && x.status !== "deactivated",
          );
          if (admins.length <= 1)
            return problem(409, "cannot remove the last tenant_admin of the tenant");
        }
        u.roles = [...new Set(desired)];
        return json(200, { sub: u.sub, roles: [...u.roles].sort() });
      }
    }

    // ── audit ────────────────────────────────────────────────────────
    if (path === "/audit/events" && method === "GET") {
      ctl.auditQueries.push(url.search);
      const q = url.searchParams;
      let events = ctl.auditEvents;
      if (q.get("kind")) events = events.filter((e) => e.kind === q.get("kind"));
      if (q.get("severity")) events = events.filter((e) => e.severity === q.get("severity"));
      if (q.get("actor_sub")) events = events.filter((e) => e.actor_sub === q.get("actor_sub"));
      if (q.get("from_seq")) events = events.filter((e) => e.seq >= Number(q.get("from_seq")));
      if (q.get("cursor")) events = events.filter((e) => e.seq > Number(q.get("cursor")));
      const limit = Number(q.get("limit") || 100);
      const pageRows = events.slice(0, limit);
      return json(200, {
        events: pageRows,
        next_cursor: pageRows.length === limit ? pageRows[pageRows.length - 1].seq : null,
        count: pageRows.length,
      });
    }
    if (path === "/audit/verify" && method === "GET") {
      ctl.verifyQueries.push(url.search);
      if (ctl.tamperedVerify) {
        return json(200, {
          ok: false, tenant_id: TENANT_A,
          from_seq: Number(url.searchParams.get("from_seq") || 1),
          to_seq: null, events_checked: 2, last_seq: 3, last_hash: null,
          first_divergence_seq: 3, divergence_reason: "payload_hash_mismatch",
          expected_hash: "aa11", actual_hash: "bb22",
        });
      }
      return json(200, {
        ok: true, tenant_id: TENANT_A,
        from_seq: Number(url.searchParams.get("from_seq") || 1),
        to_seq: null, events_checked: ctl.auditEvents.length,
        last_seq: ctl.auditEvents.length ? ctl.auditEvents[ctl.auditEvents.length - 1].seq : null,
        last_hash: "cafe0042", first_divergence_seq: null, divergence_reason: null,
        expected_hash: null, actual_hash: null,
      });
    }

    // Probes + anything a background widget asks for.
    if (path.endsWith("/readyz") || path.endsWith("/healthz"))
      return json(200, { status: "ready" });
    return json(200, { items: [] });
  });

  return ctl;
}

// `landing` is the post-login URL this role settles on. Waiting for it matters:
// login triggers a redirect CHAIN — LoginPage's own navigate("/"), then the
// App's gateToHome effect (scheduled while React's route state is still
// /login) firing ANOTHER navigate("/"), then the role-home redirect. A goto
// issued mid-chain gets stomped by whichever effect fires last, so after the
// URL first reads as landed we give the effect queue a beat to drain — the
// stray navigate lands within milliseconds; 300ms is two orders of margin.
export async function login(page, email = ADMIN_EMAIL, landing = /#\/dashboard$/) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(landing);
  await page.waitForTimeout(300);
  await page.waitForURL(landing); // the chain settled where we expect
}
