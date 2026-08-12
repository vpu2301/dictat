// demo.js — the "Book a demo" request, sent to our own backend.
//
// This is NOT a replacement for leads.js. The two do different jobs and
// both run on a demo submission:
//
//   leads.js  → HubSpot. The CRM record: who they are, which company,
//               the consent artefact. Sales works from that.
//   demo.js   → marketing-service. The two transactional EMAILS: an
//               acknowledgement carrying the booking button, and — once
//               they pick a slot on the Google appointment page — the
//               confirmation with the date, time and Meet link.
//
// Keeping them separate is deliberate. HubSpot workflows could in
// principle send the first mail, but they cannot send the second: only
// something watching the sales calendar knows a booking happened, and
// that is the backend's job. Splitting the two also means a HubSpot
// outage costs us the CRM row and not the reply the visitor is waiting
// for, and vice versa.
//
// `lang` is the one field that matters most here. The backend picks the
// email template from it, falling back to the request's country and then
// Accept-Language — so sending the UI language the visitor actually read
// the form in is what makes the answer come back in their language.

import { SERVICES } from "./services.js";

// The languages marketing-service has designed templates for. Anything
// else is sent as-is and resolved server-side; this list exists so the
// common case does not depend on a round trip agreeing with us.
export const EMAIL_LANGS = ["en", "de", "uk"];

// The SPA speaks eleven languages, the emails speak three. A visitor
// reading the Polish or Czech page is in the German-adjacent market by
// geography but has no template of their own, so nothing is forced here:
// the tag is passed through, the backend fails to match it, and the
// country decides. Mapping pl → de in the browser would guess where the
// backend can actually look.
export function emailLangFor(lang) {
  const primary = String(lang || "").trim().toLowerCase().split(/[-_]/)[0];
  return primary || "";
}

// The Google appointment page. The SAME value marketing-service puts in the
// acknowledgement email (MDX_DEMO_BOOKING_URL, config.py) — duplicated here
// because a page can also link straight to it without waiting for a mail, and
// the two must not drift. Overridable so a staging deployment can point at a
// throwaway calendar instead of the real sales one.
export const DEMO_BOOKING_URL =
  (import.meta.env && import.meta.env.VITE_DEMO_BOOKING_URL) ||
  "https://calendar.app.google/336HQrX67TV9UNJr8";

export function demoRequestEndpoint(base = SERVICES.marketing) {
  return `${String(base).replace(/\/+$/, "")}/public/demo/requests`;
}

// What the endpoint accepts. Blank optional values are DROPPED rather
// than sent empty — the model rejects unknown keys (extra="forbid") and
// an empty string is not the same as an absent field to a NOT NULL
// column further down.
// The message cap, mirroring `DemoRequestIn.message` (routers/demo.py). Trimmed
// here rather than left to the server: over the cap the model 422s, and the
// visitor — who was already thanked, because the submit is fire-and-forget —
// would never learn their enquiry did not arrive. A truncated long message is
// strictly better than a silently dropped one.
export const MESSAGE_MAX = 8000;

export function demoRequestBody(form = {}, { lang = "", pageUri = "", kind = "" } = {}) {
  const v = (x) => String(x ?? "").trim();
  const body = { email: v(form.email) };
  const optional = {
    // Which acknowledgement to send. "contact" gets the contact template
    // ("a manager will be in touch, and here is the calendar if you would
    // rather not wait"); anything else, including absent, is the demo
    // acknowledgement — so an older client keeps working unchanged.
    kind: v(kind),
    lang: emailLangFor(lang),
    first_name: v(form.firstName),
    organisation: v(form.org),
    source_page: v(pageUri).slice(0, 300),
    // The contact form's own two fields. marketing-service forwards the
    // message to the sales mailbox with Reply-To set to the sender — which is
    // what makes the acknowledgement's promise ("a manager reads it") true
    // without anyone having to watch the CRM. Absent on the demo and subscribe
    // forms, and dropped when blank like every other optional field, so those
    // submissions are byte-identical to what they were before.
    message: v(form.message).slice(0, MESSAGE_MAX),
    // The ENGLISH dropdown value, not the translated label — the same value
    // that leads the HubSpot message, so the CRM row and the mail agree.
    reason: v(form.reason).slice(0, 80),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) body[key] = value;
  }
  return body;
}

// Resolves to { ok, status } and never throws — same contract as
// submitLead, and for the same reason: a visitor who has just asked for
// a demo must not be shown an error page because a backend had a bad
// minute. They are thanked either way and the failure goes to the
// console for the operator.
//
// The mail itself is queued in an outbox before this returns, so a slow
// or unreachable SMTP relay does not surface here at all — `ok` means
// "the request is recorded and the mail is queued", not "delivered".
// The keys an older marketing-service has never heard of. Its request model is
// `extra="forbid"`, so sending one to a deployment that predates them fails the
// WHOLE submission — including the acknowledgement the visitor is waiting for.
// See the retry in submitDemoRequest.
const NEWER_FIELDS = ["message", "reason"];

async function postRequest(endpoint, body) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // No cookies: the endpoint is unauthenticated and sending
    // credentials cross-origin would require the server to widen CORS
    // for nothing.
    credentials: "omit",
    body: JSON.stringify(body),
  });
  let detail = "";
  if (!r.ok) {
    try { detail = JSON.stringify(await r.json()); } catch { /* not json */ }
  }
  return { ok: r.ok, status: r.status, detail };
}

export async function submitDemoRequest(form, ctx = {}) {
  const endpoint = demoRequestEndpoint(ctx.base);
  const body = demoRequestBody(form, ctx);
  try {
    const first = await postRequest(endpoint, body);
    if (first.ok) return { ok: true, status: first.status };

    // ── the version-skew retry ──────────────────────────────────────────
    // The SPA and marketing-service deploy separately, so a browser running
    // today's bundle can be talking to yesterday's service. When the only
    // thing it dislikes is a field it has never heard of, drop those fields
    // and send again: losing the sales forward is a degradation, losing the
    // visitor's acknowledgement is an outage, and the second is what an
    // unconditional failure here actually costs.
    //
    // Narrow on purpose. A 422 that is NOT about an unknown field — a
    // malformed address, say — is a real rejection and retrying it only
    // doubles the load, so the detail has to name one of our own new keys.
    const skew = first.status === 422
      && NEWER_FIELDS.some((k) => k in body && first.detail.includes(k));
    if (skew) {
      const legacy = { ...body };
      for (const k of NEWER_FIELDS) delete legacy[k];
      const second = await postRequest(endpoint, legacy);
      console.error(
        "demo.request_degraded",
        "marketing-service rejected", NEWER_FIELDS.filter((k) => k in body).join("+"),
        "— retried without them; the contact message did NOT reach sales.",
        "Deploy marketing-service and run migration 0080 to restore it.",
      );
      return { ok: second.ok, status: second.status, degraded: true };
    }

    console.error("demo.request_failed", first.status, first.detail);
    return { ok: false, status: first.status };
  } catch (e) {
    console.error("demo.request_error", e);
    return { ok: false, status: 0 };
  }
}
