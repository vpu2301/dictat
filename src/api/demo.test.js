// Units for the public demo / contact request sent to marketing-service.
//
//   node --test src/api/demo.test.js
//
// node:test rather than vitest, which this file used to import. The runner in
// package.json `test:unit` is `node --test` over an explicit file list, so a
// vitest-only file here is a file that never runs — and the contact-form
// fields below are exactly the kind of contract that must not rot unwatched.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGE_MAX,
  demoRequestBody,
  demoRequestEndpoint,
  emailLangFor,
  submitDemoRequest,
} from "./demo.js";

describe("emailLangFor", () => {
  test("reduces a tag to its primary subtag", () => {
    assert.equal(emailLangFor("de-AT"), "de");
    assert.equal(emailLangFor("uk_UA"), "uk");
    assert.equal(emailLangFor(" EN "), "en");
  });

  test("passes an unmapped language through rather than guessing", () => {
    // pl has no template. Forcing it to `de` here would guess where the
    // backend can actually look (country, then Accept-Language).
    assert.equal(emailLangFor("pl"), "pl");
  });

  test("is empty for nothing", () => {
    assert.equal(emailLangFor(""), "");
    assert.equal(emailLangFor(undefined), "");
  });
});

describe("demoRequestBody", () => {
  test("sends the email and the language", () => {
    const body = demoRequestBody({ email: " a@b.test " }, { lang: "uk" });
    assert.deepEqual(body, { email: "a@b.test", lang: "uk" });
  });

  test("drops blank optional fields instead of sending empty strings", () => {
    const body = demoRequestBody(
      { email: "a@b.test", firstName: "  ", org: "" },
      { lang: "" },
    );
    assert.deepEqual(body, { email: "a@b.test" });
    assert.equal("first_name" in body, false);
    assert.equal("lang" in body, false);
  });

  test("carries the name and organisation when the form has them", () => {
    const body = demoRequestBody(
      { email: "a@b.test", firstName: "Olena", org: "City Hospital No. 1" },
      { lang: "en", pageUri: "https://klarnote.com/#/signup" },
    );
    assert.equal(body.first_name, "Olena");
    assert.equal(body.organisation, "City Hospital No. 1");
    assert.equal(body.source_page, "https://klarnote.com/#/signup");
  });

  test("clamps source_page to the column width", () => {
    const body = demoRequestBody(
      { email: "a@b.test" },
      { lang: "en", pageUri: "https://x.test/" + "y".repeat(500) },
    );
    assert.equal(body.source_page.length, 300);
  });

  test("sends no key the endpoint forbids", () => {
    // The backend model is extra="forbid": one stray key rejects the
    // whole submission, so the body must be exactly the agreed shape.
    const allowed = new Set([
      "email", "lang", "country", "first_name", "organisation", "source_page",
      "kind", "message", "reason",
    ]);
    const body = demoRequestBody(
      {
        email: "a@b.test", firstName: "O", org: "H", consent: true, phone: "+380",
        message: "hello", reason: "Sales",
      },
      { lang: "de", pageUri: "https://x.test", kind: "contact" },
    );
    for (const key of Object.keys(body)) {
      assert.ok(allowed.has(key), `unexpected key ${key}`);
    }
  });

  // ── the contact form's message ───────────────────────────────────────
  // marketing-service forwards this to the sales mailbox. Before it was
  // sent, the message reached HubSpot and nothing else — so the field being
  // present, and surviving intact, is the whole feature.

  test("carries the contact message and reason verbatim", () => {
    const body = demoRequestBody(
      {
        email: "a@b.test",
        firstName: "Anna",
        message: "  Do you support German dictation?\n\nWe are twelve radiologists.  ",
        reason: "Sales",
      },
      { lang: "de", kind: "contact" },
    );
    // Trimmed at the ends, untouched in the middle: the blank line between
    // the two paragraphs is how the sender wrote it and how sales reads it.
    assert.equal(
      body.message,
      "Do you support German dictation?\n\nWe are twelve radiologists.",
    );
    assert.equal(body.reason, "Sales");
    assert.equal(body.kind, "contact");
  });

  test("truncates an over-long message rather than letting the server 422 it", () => {
    // The submit is fire-and-forget — the visitor was already thanked — so a
    // rejected body is an enquiry that vanishes with nobody the wiser.
    const body = demoRequestBody(
      { email: "a@b.test", message: "x".repeat(MESSAGE_MAX + 500) },
      { kind: "contact" },
    );
    assert.equal(body.message.length, MESSAGE_MAX);
  });

  test("leaves the demo and subscribe bodies exactly as they were", () => {
    // Those two forms have no message field. Adding the key here must not
    // change a single byte of what they send.
    const body = demoRequestBody(
      { email: "a@b.test", firstName: "Olena" },
      { lang: "uk", kind: "demo" },
    );
    assert.deepEqual(body, {
      email: "a@b.test", lang: "uk", kind: "demo", first_name: "Olena",
    });
    assert.equal("message" in body, false);
    assert.equal("reason" in body, false);
  });
});

describe("demoRequestEndpoint", () => {
  test("joins without doubling the slash", () => {
    assert.equal(
      demoRequestEndpoint("http://localhost:8012/"),
      "http://localhost:8012/public/demo/requests",
    );
  });
});

describe("submitDemoRequest", () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  afterEach(() => {
    globalThis.fetch = realFetch;
    console.error = realError;
  });

  test("posts JSON without credentials", async () => {
    const calls = [];
    globalThis.fetch = async (...args) => {
      calls.push(args);
      return { ok: true, status: 202 };
    };

    const res = await submitDemoRequest(
      { email: "a@b.test" },
      { lang: "uk", base: "http://svc" },
    );

    assert.deepEqual(res, { ok: true, status: 202 });
    const [url, init] = calls[0];
    assert.equal(url, "http://svc/public/demo/requests");
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "omit");
    assert.deepEqual(JSON.parse(init.body), { email: "a@b.test", lang: "uk" });
  });

  test("puts the contact message on the wire", async () => {
    const calls = [];
    globalThis.fetch = async (...args) => {
      calls.push(args);
      return { ok: true, status: 202 };
    };

    await submitDemoRequest(
      { email: "a@b.test", firstName: "Anna", message: "Two questions.", reason: "Sales" },
      { lang: "de", base: "http://svc", kind: "contact" },
    );

    assert.deepEqual(JSON.parse(calls[0][1].body), {
      email: "a@b.test",
      kind: "contact",
      lang: "de",
      first_name: "Anna",
      message: "Two questions.",
      reason: "Sales",
    });
  });

  // ── version skew ─────────────────────────────────────────────────────
  // The SPA and marketing-service deploy separately. A bundle that sends
  // `message` to a service that has never heard of it must not take the
  // visitor's acknowledgement down with it — that was a real regression, and
  // these two tests are what stop it coming back.

  test("retries without the new fields when an older service rejects them", async () => {
    const bodies = [];
    globalThis.fetch = async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) {
        return {
          ok: false,
          status: 422,
          json: async () => ({
            errors: [
              { type: "extra_forbidden", loc: ["body", "message"] },
              { type: "extra_forbidden", loc: ["body", "reason"] },
            ],
          }),
        };
      }
      return { ok: true, status: 202 };
    };
    console.error = () => {};

    const res = await submitDemoRequest(
      { email: "a@b.test", firstName: "Anna", message: "Two questions.", reason: "Sales" },
      { lang: "de", base: "http://svc", kind: "contact" },
    );

    // The visitor still gets their acknowledgement.
    assert.equal(res.ok, true);
    assert.equal(res.degraded, true);
    assert.equal(bodies.length, 2);
    // The retry drops ONLY the two unknown keys; everything else survives.
    assert.equal("message" in bodies[1], false);
    assert.equal("reason" in bodies[1], false);
    assert.deepEqual(bodies[1], {
      email: "a@b.test", kind: "contact", lang: "de", first_name: "Anna",
    });
  });

  test("does not retry a 422 that is a genuine rejection", async () => {
    // A malformed address is not version skew. Retrying it doubles the load
    // and still fails, so the detail has to name one of our own new keys.
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return {
        ok: false,
        status: 422,
        json: async () => ({ errors: [{ loc: ["body", "email"], msg: "not an email" }] }),
      };
    };
    console.error = () => {};

    const res = await submitDemoRequest(
      { email: "nope", message: "hi" },
      { base: "http://svc", kind: "contact" },
    );
    assert.equal(calls, 1);
    assert.equal(res.ok, false);
    assert.equal(res.degraded, undefined);
  });

  test("resolves rather than throwing when the network fails", async () => {
    globalThis.fetch = async () => { throw new Error("offline"); };
    console.error = () => {};
    // A visitor who just asked for a demo must not see an error page.
    assert.deepEqual(
      await submitDemoRequest({ email: "a@b.test" }, {}),
      { ok: false, status: 0 },
    );
  });

  test("reports a rejected submission without throwing", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: "bad email" }),
    });
    let logged = 0;
    console.error = () => { logged += 1; };
    const res = await submitDemoRequest({ email: "nope" }, {});
    assert.equal(res.ok, false);
    assert.ok(logged > 0, "a failed submission must reach the operator's console");
  });
});
