// leads.js — where a completed signup actually goes.
//
// The public signup form (pages/SignupFlow.jsx) is a LEAD form, not an account
// form: this platform is admin-invite-only, so nothing here creates a login.
// What it creates is a HubSpot Contact and — through the organisation name —
// an associated Company. That association is the whole point of the form: 20
// doctors from one hospital have to arrive as one account with 20 people on it,
// not as 20 unrelated strangers.
//
// Submission goes STRAIGHT to HubSpot's Forms API from the browser:
//
//   POST https://api.hsforms.com/submissions/v3/integration/submit/{portal}/{form}
//
// That endpoint is designed for exactly this — it is CORS-enabled, it takes no
// secret (a portal id and a form guid are public identifiers, the same pair
// HubSpot's own embed script puts in the page), and HubSpot owns the dedupe,
// the company association and the consent record. A backend of our own in front
// of it would add a public unauthenticated endpoint to defend, a second copy of
// the PII to retain, and nothing the CRM does not already do.
//
// Everything below the fetch is PURE, and tested that way: what the CRM
// receives is too easy to get quietly wrong to leave untested.

const HUBSPOT_ORIGIN = "https://api.hsforms.com";

// HubSpot's object type id for Contact. Company fields ride on the contact
// record (`company`, `city`, `country`) — HubSpot promotes them to the
// associated Company itself, which is why the form does not post a second
// object.
const CONTACT = "0-1";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

// Configured, or not at all. A half-configured portal is the worse failure:
// the form would look like it submits and every lead would 404 into nothing.
export function hubspotConfig(e = env) {
  const portalId = String(e.VITE_HUBSPOT_PORTAL_ID || "").trim();
  const formGuid = String(e.VITE_HUBSPOT_FORM_GUID || "").trim();
  return portalId && formGuid ? { portalId, formGuid } : null;
}

export function leadEndpoint(cfg) {
  return `${HUBSPOT_ORIGIN}/submissions/v3/integration/submit/${encodeURIComponent(cfg.portalId)}/${encodeURIComponent(cfg.formGuid)}`;
}

// The CSP's `connect-src` addition, mirroring company/infra.js's `infraOrigins`
// — the policy is computed from the code, never hand-kept. Empty when HubSpot
// is not configured: a deployment that submits no leads must not advertise an
// origin it never talks to.
export function leadOrigins(e = env) {
  return hubspotConfig(e) ? [HUBSPOT_ORIGIN] : [];
}

// ── the payload ────────────────────────────────────────────────────────
//
// Internal HubSpot property names. The first eight are built-ins on every
// portal; the last three are custom properties this form needs created (a
// submission naming a property the portal does not have is rejected whole, so
// they are listed in one place rather than scattered through the form).
export const CUSTOM_PROPERTIES = ["medical_specialty", "organisation_type", "clinician_count"];

// Every visitor is Ukraine for now — the form does not ask (doc: "don't waste
// form space"), and a Company with no country cannot be territory-mapped. When
// a second market opens, this becomes a field again; until then it is a
// constant HERE rather than a hidden input, so it cannot be tampered with in
// the DOM and cannot drift away from what the form claims.
export const DEFAULT_COUNTRY = "Ukraine";

// form state → HubSpot fields. Blank optional values are DROPPED rather than
// sent empty: an empty string overwrites a phone number a returning lead
// already gave us.
export function leadFields(lead = {}) {
  const v = (x) => String(x ?? "").trim();
  const pairs = [
    ["firstname", v(lead.firstName)],
    ["lastname", v(lead.lastName)],
    ["email", v(lead.email)],
    ["phone", v(lead.phone)],
    // The B2B signal. `company` is what HubSpot associates a Company record by.
    ["company", v(lead.org)],
    ["city", v(lead.city)],
    ["country", v(lead.country) || DEFAULT_COUNTRY],
    // Buying power. `jobtitle` is the built-in that means this, so the role
    // lands somewhere every HubSpot view and workflow already understands.
    ["jobtitle", v(lead.role)],
    ["medical_specialty", v(lead.specialty)],
    ["organisation_type", v(lead.orgType)],
    ["clinician_count", v(lead.size)],
    // The contact form's free text. A HubSpot BUILT-IN ("Message"), not one of
    // CUSTOM_PROPERTIES — it ships on every portal, so naming it cannot get a
    // submission rejected the way an absent custom property would.
    //
    // It is here and not on the demo request because marketing-service's
    // DemoRequestIn is extra="forbid" and has no message field: sending one
    // would 422 the whole request and cost the visitor their acknowledgement
    // email. So the two halves split the way they already do — HubSpot keeps
    // what was said, marketing-service sends the reply.
    ["message", v(lead.message)],
  ];
  return pairs
    .filter(([, value]) => value !== "")
    .map(([name, value]) => ({ objectTypeId: CONTACT, name, value }));
}

// The full v3 submission body. `legalConsentOptions` is HubSpot's own consent
// record — the compliance artefact — and it stores the exact wording that was
// agreed to, so it must be the text the visitor actually saw, in the language
// they saw it in.
export function leadSubmission(lead = {}, { pageUri = "", pageName = "", consentText = "" } = {}) {
  const body = {
    fields: leadFields(lead),
    context: {},
  };
  if (pageUri) body.context.pageUri = pageUri;
  if (pageName) body.context.pageName = pageName;
  if (lead.consent) {
    body.legalConsentOptions = {
      consent: {
        consentToProcess: true,
        text: consentText || "I agree to the Terms and the Privacy Policy.",
      },
    };
  }
  return body;
}

// Fire the submission. Resolves to { ok, skipped, status } rather than
// throwing: a lead form that shows an error page because a marketing endpoint
// hiccuped has turned a won lead into a lost one. The caller confirms receipt
// either way and the failure is reported to the console for the operator.
export async function submitLead(lead, ctx = {}) {
  const cfg = hubspotConfig(ctx.env || env);
  if (!cfg) return { ok: false, skipped: true, status: 0 };
  try {
    const r = await fetch(leadEndpoint(cfg), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadSubmission(lead, ctx)),
    });
    if (!r.ok) {
      // HubSpot answers a rejected submission with a JSON body naming the
      // offending property — by far the most useful thing to have in the log
      // when a portal is missing one of CUSTOM_PROPERTIES.
      let detail = "";
      try { detail = JSON.stringify(await r.json()); } catch { /* not json */ }
      console.error("lead.submit_failed", r.status, detail);
    }
    return { ok: r.ok, skipped: false, status: r.status };
  } catch (e) {
    console.error("lead.submit_error", e);
    return { ok: false, skipped: false, status: 0 };
  }
}
