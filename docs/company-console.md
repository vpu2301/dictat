# Klarnote platform-owner console (`/company`)

The vendor's view of the platform, as opposed to `/dashboard`, which is a
customer's view of their own clinic. Lives in `src/company/`, aggregation in
`src/api/company.js`.

Open at <http://localhost:5173/company> (a path→hash bridge in `src/main.jsx`
rewrites it to `#/company`; `#/company/<tab>` also works and is what the tab bar
navigates to).

---

## What the backend actually allows

This drove every design decision here, so it is worth stating precisely. Verified
against `~/Desktop/dictate/medical-dictation-backend`.

**The platform is single-tenant at the token level.** `libs/db` refuses to hand
out a connection that bypasses RLS — its integration test asserts `app_role` has
`rolbypassrls = false` — and every data read is scoped to `claims.tid`, the
tenant baked into the Keycloak-issued JWT.

**Three endpoints are the exception, and they are this console's backbone:**

| Endpoint | Scope |
|---|---|
| `GET /tenants` | every tenant the caller is a **member** of |
| `GET /tenants/{id}` | full profile of any such tenant |
| `GET /tenants/{id}/members` | full member roster of any such tenant |

`auth-service` serves those off `tenant_writer_pool` after an explicit
membership check (`_require_member`), *not* off the RLS-scoped app pool — so they
genuinely resolve cross-tenant. That is the entire Tenants tab.

**Everything deeper is active-tenant only.** Users, reports, dictation sessions,
ASR jobs and audit are RLS-scoped to `claims.tid`. `POST /tenants/{id}/switch`
does **not** change that — it is an authorization gate plus audit hook, and its
own response body says *"re-authenticate to obtain a token scoped to this tenant
before accessing its data."*

**There is no billing domain.** No plan, price, subscription, invoice, trial or
seat-limit resource exists anywhere in the backend. The only real commercial
signal is the ASR monthly byte quota
(`services/asr-service/.../validators/quota.py`), and even that exposes no
bytes-used readout — only an `asr.quota_exceeded` audit event.

**There is no platform-owner role.** `libs/auth/perms.py` pins `KNOWN_ROLES` to
`{tenant_admin, clinician, nurse, auditor, service}`. `super_admin` is referenced
by the SPA's role table but the server neither issues nor honours it
(`libs/auth/tests/unit/test_perms.py` asserts it is denied).

---

## The staff door (`/company/login`)

Klarnote's own team must never be bounced to a clinic's front desk, so
`/company` does **not** go through App's shared auth gate (which redirects to
`/login`). It is listed in `isPublicRoute` — not because it is public, it is the
most private surface in the app, but so it can own its own redirect. An
unauthenticated visit to `/company` lands on `/company/login`
(`src/company/CompanyLoginPage.jsx`).

That page differs from `/login` in four ways that matter:

- branded as Klarnote staff access — dark internal-tool shell, no tenant or
  marketing chrome, no sign-up, no "your clinic" language;
- lands on `/company`, never on a clinical workspace;
- **a non-staff account that signs in here is refused and signed straight back
  out** (`POST /auth/logout` + `clear()`), rather than being handed a working
  clinic session by the back door. This is the part that makes a separate
  entrance mean something, and it is covered by an e2e test that asserts the
  session is genuinely gone afterwards;
- the console runs full-bleed with its own *Clinic app* and *Sign out* controls,
  so a vendor screen is never framed by a clinician's sidebar. Sign-out returns
  to `/company/login`.

**It is not a separate credential store.** There is one Keycloak realm and one
`POST /auth/login` in the backend. A genuinely separate staff identity would
need either a second Keycloak realm/client for Klarnote staff, or a dedicated
staff endpoint on auth-service issuing tokens with a platform-scoped audience —
both backend work, listed under the `platform-role` gap below.

## Access gate

`src/company/ownerAccess.js` — an **email allowlist**, because of the last point
above. It is a *presentation* gate: it decides which nav entry renders, which
page body shows, and who the staff door admits — not what the API returns. A
non-owner who forces the route gets a refusal page, and any call they made would
be 403'd server-side anyway.

- Default allowlist: `vpu2301@gmail.com`
- Override: `VITE_PLATFORM_OWNER_EMAILS="a@x.com,b@y.com"` in `.env.local`
- `PLATFORM_ROLES` (`super_admin`, `platform_owner`) also grant access, so the
  allowlist degrades to a fallback the day the backend issues a real role.

Unit tests: `src/company/ownerAccess.test.js` (wired into `npm run test:unit`).

---

## Navigation

Thirteen sections is too many for a tab strip, so the console has a left rail
(`.co-rail`) grouped by job. The console runs full-bleed, so the rail is also
where identity, the way back to the clinic app, and sign-out live.

**Company** — run the business

| Section | Source | Scope |
|---|---|---|
| Overview | all of the below, rolled up | mixed — each tile labels its own scope |
| Business | live tenants/seats/reports + **mocked** revenue, churn, CAC, funnel | mixed, badged per tile |
| Subscriptions | `/admin/users` + `asr.quota_exceeded` audit event | active tenant |
| Support | **fully mocked** ticket queue + the real ASR signals that would feed one | — |

**Customers** — run the estate

| Section | Source | Scope |
|---|---|---|
| Tenants | `/tenants`, `/tenants/{id}`, `/tenants/{id}/members`; create + manage | read **cross-tenant**, write active-tenant only |
| Templates | `/templates` full lifecycle — list, clone, create, deprecate | active tenant |
| Usage | `/sessions`, `/asr/jobs`, `/v1/reports/search`, `/admin/users` | active tenant |

**Platform** — run the software

| Section | Source | Scope |
|---|---|---|
| Technical | static inventory verified against backend source + live `/readyz` | global |
| Telemetry | `/readyz` + `/healthz` × 9, `/audit/events`, `/audit/verify` | health global; audit active tenant |
| Errors | **live** audit error/warn, failed ASR jobs, unreachable services; **mocked** uptime/MTTR/incidents | mixed |
| Security | **entirely live** — the audit watch-list | active tenant |
| Operations | **live** ASR queue, privacy/DSAR queue, feature flags, env; **mocked** releases | mixed |
| Infrastructure | live links + reachability probes for every tool the stack runs | global |
| Roadmap | what to build next + the verified gap register | — |

### Infrastructure links

`src/company/infra.js` is the registry; every entry is overridable by a
`VITE_INFRA_*` env var. Verified working against the running stack:

| Tool | URL | Notes |
|---|---|---|
| Grafana | `:3001` | dashboards; also the practical way to read Loki logs (`admin`/`admin`) |
| Prometheus | `:9090` | metrics + PromQL — the series the Errors tab is missing |
| Jaeger | `:16686` | distributed traces |
| Loki | `:3100` | API only, no UI — query via Grafana |
| MinIO | `:9001` | object storage console (`minioadmin`/`minioadmin`) |
| Mailpit | `:8025` | dev email catcher |
| Keycloak | `:8088/admin/master/console/` | identity provider (`admin`/`admin`) |
| OTel Collector | `:8889/metrics` | collector's own metrics |
| public-edge | `:8443` | allowlist proxy — a 404 at the root is the design |

Postgres, Redis and Kafka are listed as connection strings, since a link to a
TCP service would be a link that cannot work.

**The reachability column says "answered", not "healthy"** — deliberately. These
are cross-origin and send no CORS headers, so a normal `fetch` is rejected by
the browser and reads identically to "not running". A `no-cors` fetch returns an
opaque response (status always 0) but the *promise still resolves* when
something answered, which is the only distinction the browser can actually
support. It cannot tell 200 from 404 from 500.

`public-edge` gets a third state, **"cannot check"**: it serves a self-signed dev
certificate, so the browser rejects it before any response is visible. Reporting
it down would send someone to debug a container that is working fine.

### Keycloak needed `sslRequired` relaxed (dev only)

Both realms shipped with `sslRequired: "external"` — Keycloak's default, and the
correct production value. On Docker Desktop a browser on the host reaches
Keycloak through the bridge gateway, which Keycloak treats as external, so every
realm endpoint answered `403 "HTTPS required"`: the admin console loaded but
could never sign in. (The SPA was unaffected throughout — auth-service talks to
Keycloak *inside* the Docker network.)

Both realms are now `NONE`, set at runtime and in `realm-export.json` for fresh
stacks. **Production must set this back to `external`** and terminate TLS in
front of Keycloak. The master realm is created by Keycloak bootstrap and is not
covered by the export file, so a fresh stack needs:

```bash
docker exec medical-dictation-keycloak-1 /opt/keycloak/bin/kcadm.sh \
  config credentials --server http://localhost:8080 --realm master \
  --user admin --password admin
docker exec medical-dictation-keycloak-1 /opt/keycloak/bin/kcadm.sh \
  update realms/master -s sslRequired=NONE
```

### Security is the one page with no placeholders

Worth calling out because it is unusual: the hash-chained audit trail already
records everything a security review asks for — failed sign-ins, role changes,
break-glass PHI access, refresh-token replays, deactivations, tenant switches.
Nothing on that page is invented.

A **refresh replay** gets its own alarm rather than a table row: auth-service
force-revokes the entire session when it sees one, because it means a refresh
token was used twice — a bug or a stolen token, never routine.

Every bound is disclosed rather than silently applied: capped page walks set a
`capped` flag that surfaces as a "capped" sub-label or an `≈` on the stat.

## Real vs mocked

The console mixes measured and invented numbers, which is only defensible while
the difference is impossible to miss. Three provenance badges
(`src/company/provenance.jsx`) appear on every figure:

- **live** — read from an endpoint on this page load
- **derived** — computed in the browser from live values; the tooltip states the
  assumption (e.g. "seats are only visible for the active tenant, so this
  under-reports")
- **mock** — not measured

**Every mocked value in the app lives in `src/company/mockData.js`**, and each
carries a `need` field naming the concrete thing that would replace it. A
placeholder without a route to becoming real is just a lie with a nice font.

Three unit tests in `src/company/noInlineMocks.test.js` keep this structural
rather than a matter of remembering: no panel may hard-code a currency amount,
any panel importing `mockData` must also import `Provenance`, and every mock
object must declare its `need`.

What is mocked today, and why: revenue/MRR/ARR, retention/churn, CAC/LTV, the
sales funnel, support metrics and runway — because Klarnote has no billing
service, no CRM and no helpdesk. The Roadmap tab lists all three as work items.

## Management

**Tenants** — `POST /tenants` (create a clinic; you become its owner) works for
any tenant. Everything else — profile `PATCH`, member add/role-change/remove —
is gated behind `_require_active_tenant` and 403s unless the target is the
tenant in your JWT. Rather than render buttons that fail, a non-active tenant
gets a read-only panel stating exactly why and what would change it.

**Templates** — report-service ships the full lifecycle and `templates.write` is
a `tenant_admin` permission the Klarnote account holds. Two behaviours the UI
surfaces because the backend enforces them: a structural edit creates a **new
version** (reports already written keep rendering against theirs), and deletion
is a **soft** deprecate (the template stays fetchable by id, leaves the picker).

Writes require MFA in principle — `requires_mfa()` guards them — but
`MDX_REQUIRE_MFA` defaults to `false`, so the dependency is a no-op in the
pilot. If that flag is ever turned on, these forms will start returning 401 with
`WWW-Authenticate: MFA` and will need a TOTP flow that does not yet exist.

---

## Provisioning the owner account

The account is checked into the backend repo in two places:

- `infra/keycloak/realm-export.json` — user `klarnote-owner`,
  email `vpu2301@gmail.com`, `sub = 0f000000-0000-0000-0000-00000000000f`,
  `tenant_id` attribute = tenant-a, realm roles `tenant_admin`, `clinician`,
  `auditor`.
- `scripts/seed/seed.sql` — the matching `users` row, plus a membership row in
  **every** tenant (`INSERT … SELECT t.id FROM tenants t`).

Why those three roles: `tenant_admin` for `/admin/users`, `/tenants/*` and
`/audit/*`; `auditor` so the audit reads survive any narrowing of the admin role;
and `clinician` because S14 dropped `tenant_admin` from reports, sessions and
ASR — without it the Usage tab would 403 on every call.

Why memberships in every tenant: `GET /tenants` returns exactly the tenants the
caller is a member of, so the portfolio is only ever as wide as those rows.

**On a fresh stack** (`cd ~/Desktop/dictate/medical-dictation-backend`):

```bash
make dev-up        # brings up Postgres + Keycloak, importing the realm export
make migrate-up
make seed
```

**On a stack that is already running**, the realm export is *not* re-imported —
Keycloak only reads it into a fresh volume, so editing `realm-export.json` does
nothing until the volume is wiped. Either `make reset-db && make migrate-up &&
make seed`, or provision the account by hand.

Two things bite when provisioning by hand, both found the hard way:

**Keycloak refuses admin calls from the host.** `http://localhost:8088` answers
`403 {"error_description":"HTTPS required"}` — the realm's `sslRequired` only
exempts container-internal localhost, and a host-side call arrives via the Docker
bridge, which counts as external. Work from inside the container:

```bash
KC="docker exec medical-dictation-keycloak-1 /opt/keycloak/bin/kcadm.sh"
$KC config credentials --server http://localhost:8080 --realm master \
      --user admin --password admin
$KC create users -r medical-dictation \
      -s username=klarnote-owner -s email=vpu2301@gmail.com \
      -s enabled=true -s emailVerified=true \
      -s 'attributes.tenant_id=["00000000-0000-0000-0000-00000000000a"]'
$KC set-password -r medical-dictation --username klarnote-owner --new-password '…'
for r in tenant_admin clinician auditor; do
  $KC add-roles -r medical-dictation --uusername klarnote-owner --rolename "$r"
done
```

**Keycloak will not accept a pinned user id here.** It honours a caller-supplied
`id` during *realm import* only; the admin REST API silently mints its own
(verified on KC 24 — both `kcadm -s id=…` and a direct `POST /users` with an
`id` field). So a hand-provisioned account always has a different `sub` than the
`0f000000-…-00000000000f` that `realm-export.json` and `seed.sql` pin.

That is why the owner rows in `seed.sql` reconcile on **`(tenant_id, email)`,
not on `sub`** — keeping whichever sub the live Keycloak issued, since that is
what the token actually carries. Conflicting on `sub` made the INSERT try to add
a second row for the same email, violating `users_tenant_id_email_key` and
aborting the entire seed transaction. (The same latent bug already affected
`owner@tenant-a.example` on any hand-provisioned stack; the bulk users INSERT was
fixed the same way.)

Then run `make seed` for the DB rows — it is idempotent and safe to re-run.

Then start the SPA (`npm run dev`) and sign in at the **staff door**,
<http://localhost:5173/company> — which redirects to `#/company/login`.
