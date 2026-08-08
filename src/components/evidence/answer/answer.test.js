// answer.test.js — EVA-S04: everything the answer screen DECIDES.
//
// The components draw; these modules decide, and this is where the deciding is
// proven. In particular the two properties that are impossible to test through
// a browser without inviting a flake — that a shuffled event stream and a
// replayed one both produce the same envelope — are ordinary assertions here.
//
// Written for `node --test` (the repo's unit net) rather than Vitest: the
// evidence module's rule since S03 is that its decisions live in pure siblings
// so they need no runner, no JSX transform and no DOM. Rendering is Playwright's
// job (e2e/evidence-quicksearch.spec.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSseParser } from "../../../api/sse.js";
import {
  askIssues, buildAskRequest, canAsk, isOverloaded, retryAfterSeconds,
} from "../../../api/evidenceAnswers.js";
import {
  KIND_STYLE, SEGMENT_KINDS, isKnownKind, kindClass, kindStyle, orderSegments,
} from "./segmentKinds.js";
import {
  envelopeFrom, hasContent, initialAnswerState, lateSourcesPending,
  reduceAnswerEvent, reduceAnswerEvents, stateFromEnvelope,
} from "./answerEnvelope.js";
import {
  accessedDate, citationNumbers, groupSources, hasWebSources,
  resolveCitations, sourceBadges, sourceLabel, webHref,
} from "./sourceView.js";
import { answerToText } from "./copyAnswer.js";
import { excerpt, historyPage, historyRow, statusTone } from "../history/historyView.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const dts = readFileSync(path.join(repoRoot, "src/types/evidence.d.ts"), "utf8");

/** The union members the generated contract declares for a named type. */
function unionFromDts(name) {
  const m = new RegExp(`^export type ${name} =([^;]+);`, "m").exec(dts);
  assert.ok(m, `${name} missing from the generated contract`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// ── fixtures ────────────────────────────────────────────────────────────
// One answer exercising all six kinds, a corpus source and a web source.
const CORPUS_SOURCE = {
  id: "src-corpus-1",
  kind: "corpus",
  title: "Уніфікований клінічний протокол: артеріальна гіпертензія",
  evidence_tier: "guideline",
  source_authority: "national",
  document_version_id: "dv-1",
};
const WEB_SOURCE = {
  id: "src-web-1",
  kind: "web",
  title: "Hypertension in adults: diagnosis and management",
  evidence_tier: "guideline",
  source_authority: "international",
  web: {
    domain: "nice.org.uk",
    url: "https://www.nice.org.uk/guidance/ng136",
    trust_tier: "guideline_registry",
    accessed_at: "2026-08-01T09:15:00Z",
    snapshot_ref: null,
  },
};

const seg = (id, kind, text, citations) => ({ id, kind, text, ...(citations ? { citations } : {}) });

const EVENTS = [
  { event: "meta", data: { answer_id: "ans-1", provenance_ref: "prov-1", contract_version: "1.0" } },
  { event: "segment", data: { area: "summary", index: 0, segment: seg("s1", "evidence", "Тіазидний діуретик — перша лінія.", [{ source_id: "src-corpus-1" }]) } },
  { event: "segment", data: { area: "summary", index: 1, segment: seg("s2", "patient_fact", "Дані пацієнта не використано.") } },
  { event: "segment", data: { area: "summary", index: 2, segment: seg("s3", "interpretation", "Вибір залежить від супутніх станів.") } },
  { event: "segment", data: { area: "detail", index: 0, segment: seg("d1", "uncertainty", "Дані щодо похилого віку суперечливі.", [{ source_id: "src-web-1" }]) } },
  { event: "segment", data: { area: "detail", index: 1, segment: seg("d2", "missing_info", "Функція нирок невідома.") } },
  { event: "segment", data: { area: "detail", index: 2, segment: seg("d3", "next_step", "Оцінити ШКФ перед призначенням.") } },
  // Sources carry an index for the same reason segments do — see the
  // citation-numbering test below, which is why this is not optional.
  { event: "source", data: { index: 0, source: CORPUS_SOURCE } },
  { event: "late_sources_expected", data: {} },
  { event: "source", data: { index: 1, source: WEB_SOURCE } },
  { event: "done", data: { status: "ok" } },
];

const runEvents = (events, question = "Перша лінія при гіпертензії?") =>
  reduceAnswerEvents(initialAnswerState(question), events);

/** Deterministic shuffle — a seeded LCG, so a failure is reproducible. */
function shuffled(list, seed) {
  const a = [...list];
  let s = seed;
  const next = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── the kind table (rule FE7) ───────────────────────────────────────────

test("the kind table covers the contract's SegmentKind union exactly", () => {
  assert.deepEqual(SEGMENT_KINDS, unionFromDts("SegmentKind"));
  assert.deepEqual(Object.keys(KIND_STYLE).sort(), [...SEGMENT_KINDS].sort());
});

test("every kind has an icon, a label key and a token — and the key is the enum value", () => {
  for (const kind of SEGMENT_KINDS) {
    const s = kindStyle(kind);
    assert.ok(s.icon, `${kind} has no icon`);
    assert.equal(s.labelKey, `kind.${kind}`, `${kind}'s label key must be the enum value`);
    assert.match(s.token, /^--/, `${kind}'s token must be a CSS custom property`);
    assert.equal(kindClass(kind), `evd-kind evd-kind-${kind}`);
  }
});

test("every kind label is translated in BOTH shipped languages", async () => {
  const { STRINGS } = await import("../../../i18n.js");
  for (const kind of SEGMENT_KINDS) {
    for (const lang of ["uk", "en"]) {
      const value = STRINGS[lang][`kind.${kind}`];
      assert.ok(value && value !== `kind.${kind}`, `kind.${kind} missing in ${lang}`);
    }
  }
});

test("every key the evidence screens ask for exists in BOTH uk and en", async () => {
  // The e2e suite can only prove this in Ukrainian — the UI language is React
  // state seeded from TWEAK_DEFAULTS, with no picker and no storage a spec
  // could set before mount. So English coverage is proven here instead, and
  // by scanning the call sites rather than one rendered screen it also covers
  // the keys no single screen state reaches (the deflection copy, the resume
  // hints, the insufficient-basis empty state).
  const { STRINGS } = await import("../../../i18n.js");
  const dirs = ["ask", "answer", "history"].map((d) => path.join(here, "..", d));
  const files = dirs.flatMap((d) =>
    readdirSync(d).filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith(".test.js"))
      .map((f) => path.join(d, f)),
  );

  const keys = new Set();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // t("literal") and t(`prefix.${…}`) — the template form is expanded from
    // the contract unions in the enum test above, so only literals here.
    for (const m of src.matchAll(/\bt\(\s*"([a-z_]+(?:\.[a-z_0-9]+)+)"/g)) keys.add(m[1]);
  }
  // Sanity: the scan must actually find keys, or it passes by finding nothing.
  assert.ok(keys.size >= 25, `only ${keys.size} keys scanned — the regex missed the call sites`);

  const missing = [];
  for (const key of keys) {
    for (const lang of ["uk", "en"]) {
      if (!STRINGS[lang][key]) missing.push(`${lang}:${key}`);
    }
  }
  assert.deepEqual(missing, [], `\n  ${missing.join("\n  ")}\n`);
});

test("a kind from a future contract degrades to a labelled neutral segment", () => {
  const s = kindStyle("contraindication_alert");
  assert.equal(s.unknown, true);
  assert.equal(s.labelKey, "kind.contraindication_alert");
  assert.equal(s.token, "--muted");
  assert.equal(isKnownKind("contraindication_alert"), false);
  assert.equal(kindClass("contraindication_alert"), "evd-kind evd-kind-unknown");
});

test("segments order by index, and unindexed ones keep arrival order behind them", () => {
  const entries = [
    { index: 2, segment: seg("c", "evidence", "third") },
    { index: null, segment: seg("x", "evidence", "no index, first seen") },
    { index: 0, segment: seg("a", "evidence", "first") },
    { index: null, segment: seg("y", "evidence", "no index, second seen") },
    { index: 1, segment: seg("b", "evidence", "second") },
  ];
  assert.deepEqual(orderSegments(entries).map((e) => e.segment.id), ["a", "b", "c", "x", "y"]);
});

// ── the reducer ─────────────────────────────────────────────────────────

test("the happy stream assembles every area of the envelope", () => {
  const env = envelopeFrom(runEvents(EVENTS));
  assert.equal(env.answer_id, "ans-1");
  assert.equal(env.provenance_ref, "prov-1");
  assert.equal(env.status, "ok");
  assert.deepEqual(env.summary_segments.map((s) => s.kind), ["evidence", "patient_fact", "interpretation"]);
  assert.deepEqual(env.detail_segments.map((s) => s.kind), ["uncertainty", "missing_info", "next_step"]);
  assert.deepEqual(env.sources.map((s) => s.id), ["src-corpus-1", "src-web-1"]);
  // All six kinds are represented — AC-S04-F-1's data precondition.
  const kinds = [...env.summary_segments, ...env.detail_segments].map((s) => s.kind);
  assert.deepEqual([...kinds].sort(), [...SEGMENT_KINDS].sort());
});

test("SHUFFLED events produce the identical envelope, for every seed", () => {
  const expected = envelopeFrom(runEvents(EVENTS));
  for (const seed of [1, 7, 42, 1337, 99991]) {
    // `done` is terminal, so it must stay last for the shuffle to be a
    // shuffle of the ANSWER rather than a test of early termination — that
    // has its own case below.
    const body = EVENTS.filter((e) => e.event !== "done");
    const mixed = [...shuffled(body, seed), { event: "done", data: { status: "ok" } }];
    assert.deepEqual(envelopeFrom(runEvents(mixed)), expected, `seed ${seed}`);
  }
});

test("DUPLICATED events change nothing — a replayed stream is not a doubled answer", () => {
  const once = envelopeFrom(runEvents(EVENTS));
  const twice = envelopeFrom(runEvents([...EVENTS, ...EVENTS]));
  assert.deepEqual(twice, once);
  assert.equal(twice.summary_segments.length, 3);
  assert.equal(twice.sources.length, 2);
});

test("a duplicate carrying MORE of the same segment replaces the earlier copy", () => {
  const partial = { event: "segment", data: { area: "summary", index: 0, segment: seg("s1", "evidence", "Тіазид") } };
  const full = EVENTS[1];
  const env = envelopeFrom(runEvents([partial, full, { event: "done", data: { status: "ok" } }]));
  assert.equal(env.summary_segments.length, 1);
  assert.equal(env.summary_segments[0].text, "Тіазидний діуретик — перша лінія.");
});

test("a late source arriving AFTER done is still accepted", () => {
  const early = EVENTS.filter((e) => e.event !== "source" || e.data.source.kind !== "web");
  const state = runEvents([...early, { event: "source", data: { index: 1, source: WEB_SOURCE } }]);
  assert.equal(state.done, true);
  assert.deepEqual(envelopeFrom(state).sources.map((s) => s.id), ["src-corpus-1", "src-web-1"]);
});

test("citation numbering does NOT depend on which connector answered first", () => {
  // The failure this guards: the web connector wins the race, `[1]` becomes
  // the web page, and the reopened answer — which gets the service's
  // canonical order — renumbers every citation in a document the clinician
  // may already have pasted into a note. The index decides, not the clock.
  const webFirst = runEvents([
    { event: "source", data: { index: 1, source: WEB_SOURCE } },
    { event: "source", data: { index: 0, source: CORPUS_SOURCE } },
    { event: "done", data: { status: "ok" } },
  ]);
  assert.deepEqual(envelopeFrom(webFirst).sources.map((s) => s.id), ["src-corpus-1", "src-web-1"]);
  assert.equal(citationNumbers(envelopeFrom(webFirst).sources).get("src-corpus-1"), 1);
});

test("a terminal event arriving behind a finished answer cannot blank it", () => {
  const state = runEvents([...EVENTS, { event: "error", data: { code: "pipeline_overloaded" } }]);
  assert.equal(state.error, null);
  assert.equal(state.status, "ok");
  assert.equal(hasContent(state), true);
});

test("deflection is terminal, sets its own status, and is not an error", () => {
  const state = runEvents([
    EVENTS[0],
    { event: "deflected", data: { reason: "individual_dosing", message: "Скористайтесь протоколом." } },
    { event: "segment", data: { area: "summary", index: 0, segment: seg("s9", "evidence", "should not appear") } },
  ]);
  assert.equal(state.status, "deflected");
  assert.equal(state.error, null);
  assert.equal(state.deflection.reason, "individual_dosing");
  // Non-terminal events still apply after a deflection — but the card, not
  // the segments, is what AnswerView renders. What matters here is that
  // nothing crashed and the deflection stands.
  assert.equal(state.deflection.message, "Скористайтесь протоколом.");
});

test("an unknown event name and a malformed payload are both no-ops", () => {
  const base = runEvents(EVENTS);
  assert.deepEqual(reduceAnswerEvent(base, "quantum_flux", { anything: 1 }), base);
  assert.deepEqual(reduceAnswerEvent(base, "source", { source: { title: "no id" } }), base);
  assert.deepEqual(reduceAnswerEvent(base, "segment", { segment: { id: "z" } }), base);
});

test("notices, flags, checks and followups each dedupe on their own identity", () => {
  const state = runEvents([
    { event: "notice", data: { code: "web_unavailable", message: "egress blocked" } },
    { event: "notice", data: { code: "web_unavailable", message: "egress blocked" } },
    { event: "flag", data: { code: "off_label", message: "off-label use", severity: "warning" } },
    { event: "check", data: { rule_id: "ddi-1", engine: "ddi", outcome: "passed", severity: "info" } },
    { event: "check", data: { rule_id: "ddi-1", engine: "ddi", outcome: "warning", severity: "warning" } },
    { event: "followup", data: { id: "f1", question: "eGFR?", answer_type: "number", priority: "high", why_needed: "dosing" } },
    { event: "done", data: { status: "ok" } },
  ]);
  assert.equal(state.notices.length, 1);
  assert.equal(state.flags.length, 1);
  assert.equal(state.checks.length, 1);
  assert.equal(state.checks[0].outcome, "warning", "the later copy wins");
  assert.equal(state.followups.length, 1);
});

// ── the late-sources chip resolves three ways, and only three ───────────

test("the late-web chip stays up while web sources are genuinely outstanding", () => {
  const upTo = EVENTS.slice(0, EVENTS.indexOf(EVENTS.find((e) => e.event === "late_sources_expected")) + 1);
  assert.equal(lateSourcesPending(runEvents(upTo)), true);
});

test("the late-web chip clears when the web source lands", () => {
  assert.equal(lateSourcesPending(runEvents(EVENTS.slice(0, -1))), false);
});

test("the late-web chip clears when the service says web is unavailable", () => {
  const state = runEvents([
    { event: "late_sources_expected", data: {} },
    { event: "notice", data: { code: "web_unavailable", message: "" } },
  ]);
  assert.equal(lateSourcesPending(state), false);
});

test("the late-web chip clears when the stream ends with neither", () => {
  const state = runEvents([{ event: "late_sources_expected", data: {} }, { event: "done", data: { status: "ok" } }]);
  assert.equal(lateSourcesPending(state), false);
});

// ── reopen equality (AC-S04-F-3) ────────────────────────────────────────

test("a fetched envelope round-trips to the identical envelope", () => {
  const streamed = envelopeFrom(runEvents(EVENTS));
  const reopened = envelopeFrom(stateFromEnvelope(streamed, "Перша лінія при гіпертензії?"));
  assert.deepEqual(reopened, streamed);
});

test("a stored deflected envelope reopens AS a deflection, not as a blank answer", () => {
  const stored = {
    answer_id: "ans-2",
    provenance_ref: "prov-2",
    status: "deflected",
    flags: [{ code: "triage_deflected", message: "Скористайтесь протоколом.", severity: "info" }],
  };
  const state = stateFromEnvelope(stored, "…");
  assert.equal(state.deflection.message, "Скористайтесь протоколом.");
  assert.equal(state.done, true);
});

// ── citations and sources ───────────────────────────────────────────────

test("citation numbers follow the envelope's source order, and survive a duplicate", () => {
  const numbers = citationNumbers([CORPUS_SOURCE, WEB_SOURCE, CORPUS_SOURCE]);
  assert.equal(numbers.get("src-corpus-1"), 1);
  assert.equal(numbers.get("src-web-1"), 2);
  assert.equal(numbers.size, 2);
});

test("a citation whose source has not arrived is kept as pending, not dropped", () => {
  const segment = seg("s1", "evidence", "…", [{ source_id: "src-web-1" }, { source_id: "src-corpus-1" }]);
  const resolved = resolveCitations(segment, [CORPUS_SOURCE]);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].number, null, "the missing source's marker is pending");
  assert.equal(resolved[0].source, null);
  assert.equal(resolved[1].number, 1);
});

test("sources group corpus-first and drop empty groups", () => {
  const groups = groupSources([WEB_SOURCE, CORPUS_SOURCE]);
  assert.deepEqual(groups.map((g) => g.kind), ["corpus", "web"]);
  assert.equal(groups[0].items[0].number, 2, "numbering follows the array, not the grouping");
  assert.equal(hasWebSources([CORPUS_SOURCE]), false);
  assert.equal(hasWebSources([CORPUS_SOURCE, WEB_SOURCE]), true);
});

test("a web source with no title still has an accessible name", () => {
  assert.equal(sourceLabel({ ...WEB_SOURCE, title: "" }), "nice.org.uk");
  assert.equal(sourceLabel(CORPUS_SOURCE), CORPUS_SOURCE.title);
});

test("web sources carry trust tier and access date as badges; corpus sources do not", () => {
  assert.deepEqual(sourceBadges(WEB_SOURCE), [
    { key: "tier", value: "guideline" },
    { key: "authority", value: "international" },
    { key: "trust", value: "guideline_registry" },
    { key: "accessed", value: "2026-08-01T09:15:00Z" },
  ]);
  assert.deepEqual(sourceBadges(CORPUS_SOURCE).map((b) => b.key), ["tier", "authority"]);
  assert.equal(accessedDate("2026-08-01T09:15:00Z"), "2026-08-01");
});

test("the contract's enum values are all translatable — no badge can render as a raw key", async () => {
  const { STRINGS } = await import("../../../i18n.js");
  const cases = [
    ["tier", unionFromDts("EvidenceTier")],
    ["authority", unionFromDts("SourceAuthority")],
    ["trust", unionFromDts("WebTrustTier")],
    ["answer_status", unionFromDts("AnswerStatus")],
  ];
  for (const [prefix, values] of cases) {
    for (const v of values) {
      for (const lang of ["uk", "en"]) {
        assert.ok(STRINGS[lang][`${prefix}.${v}`], `${prefix}.${v} missing in ${lang}`);
      }
    }
  }
});

// ── AC-S04-F-4: externalLinks off ⇒ no href, ever ───────────────────────

test("webHref returns null with the flag off, whatever the URL says", () => {
  assert.equal(webHref(WEB_SOURCE, false), null);
  assert.equal(webHref(WEB_SOURCE, true), "https://www.nice.org.uk/guidance/ng136");
});

test("a non-http scheme is refused even with the flag ON", () => {
  const hostile = { ...WEB_SOURCE, web: { ...WEB_SOURCE.web, url: "javascript:alert(1)" } };
  assert.equal(webHref(hostile, true), null);
  assert.equal(webHref({ ...WEB_SOURCE, web: { ...WEB_SOURCE.web, url: "data:text/html,x" } }, true), null);
});

// ── AC-S04-F-5: copy as text ────────────────────────────────────────────

const t = (key, params) => {
  const table = {
    "kind.evidence": "Evidence", "kind.patient_fact": "Patient fact",
    "kind.interpretation": "Interpretation", "kind.uncertainty": "Uncertainty",
    "kind.missing_info": "Missing info", "kind.next_step": "Next step",
    "tier.guideline": "guideline", "authority.national": "national",
    "authority.international": "international", "trust.guideline_registry": "guideline registry",
    "answer.sources": "Sources", "answer.web_accessed_at": "accessed",
    "answer.unverified": "Unverified: check the sources.",
    "deflect.title": "Declined", "deflect.body": "Use your protocol.",
  };
  let s = table[key] ?? key;
  for (const [k, v] of Object.entries(params || {})) s = s.replace(`{${k}}`, v);
  return s;
};

test("copy-as-text preserves kind labels, [n] markers and the source list", () => {
  const envelope = envelopeFrom(runEvents(EVENTS));
  const text = answerToText({ question: "Перша лінія при гіпертензії?", envelope, t });

  assert.match(text, /^Перша лінія при гіпертензії\?/);
  // Every kind is labelled…
  for (const label of ["Evidence", "Patient fact", "Interpretation", "Uncertainty", "Missing info", "Next step"]) {
    assert.ok(text.includes(`[${label}]`), `${label} lost in the clipboard`);
  }
  // …every citation keeps its number…
  assert.ok(text.includes("Тіазидний діуретик — перша лінія. [1]"));
  assert.ok(text.includes("Дані щодо похилого віку суперечливі. [2]"));
  // …the numbers resolve to a source list…
  assert.ok(text.includes("Sources:"));
  assert.ok(text.includes("[1] Уніфікований клінічний протокол: артеріальна гіпертензія — guideline · national"));
  assert.ok(text.includes("[2] nice.org.uk — guideline · international · guideline registry · accessed 2026-08-01"));
  // …and the unverified notice cannot be lost by copying (AC-S04-F-2).
  assert.ok(text.trimEnd().endsWith("Unverified: check the sources."));
});

test("the pasted citation keeps its URL even with external links disabled", () => {
  // The flag governs NAVIGATION, not whether a citation is checkable by the
  // person who receives the paste. This is deliberate and is asserted so a
  // later "tighten the flag" change has to argue with a test.
  const envelope = envelopeFrom(runEvents(EVENTS));
  const text = answerToText({ question: "q", envelope, t });
  assert.ok(text.includes("https://www.nice.org.uk/guidance/ng136"));
});

test("a deflection copies as the deflection, with the notice, and no empty source list", () => {
  const text = answerToText({ question: "q", envelope: null, t, deflection: "Use your protocol." });
  assert.ok(text.includes("Declined: Use your protocol."));
  assert.ok(!text.includes("Sources"));
  assert.ok(text.includes("Unverified: check the sources."));
});

// ── the request shapes ──────────────────────────────────────────────────

test("the ask body carries question, mode and locale — and trims the question", () => {
  assert.deepEqual(buildAskRequest({ question: "  метформін  ", mode: "quick", locale: "uk" }), {
    question: "метформін", mode: "quick", locale: "uk",
  });
  // An unknown mode falls back rather than reaching the wire.
  assert.equal(buildAskRequest({ question: "x", mode: "patient_context" }).mode, "quick");
  // Blank locale is omitted, not sent as "".
  assert.equal("locale" in buildAskRequest({ question: "x" }), false);
});

test("a question the service would reject is refused before a request is spent", () => {
  assert.deepEqual(askIssues("  "), ["too_short"]);
  assert.deepEqual(askIssues("ok?"), []);
  assert.deepEqual(askIssues("x".repeat(2001)), ["too_long"]);
  assert.equal(canAsk("Яка перша лінія?"), true);
  assert.equal(canAsk(""), false);
});

test("overload is recognised from status or code, and its countdown has a floor", () => {
  assert.equal(isOverloaded({ status: 429 }), true);
  assert.equal(isOverloaded({ status: 503 }), true);
  assert.equal(isOverloaded({ status: 500, problem: { code: "pipeline_overloaded" } }), true);
  assert.equal(isOverloaded({ status: 422 }), false);
  assert.equal(isOverloaded(null), false);
  assert.equal(retryAfterSeconds({ problem: { retry_after_s: 30 } }), 30);
  assert.equal(retryAfterSeconds({ problem: {} }), 10);
  assert.equal(retryAfterSeconds({ problem: { retry_after_s: -5 } }), 10);
});

// ── the SSE frame parser ────────────────────────────────────────────────

test("a frame split across chunks still dispatches once, whole", () => {
  const p = createSseParser();
  assert.deepEqual(p.push("event: seg\nda"), []);
  assert.deepEqual(p.push('ta: {"a":1}\n\n'), [{ event: "seg", data: '{"a":1}', id: null, retry: null }]);
});

test("CRLF, comments and multi-line data are all handled", () => {
  const p = createSseParser();
  const out = p.push(": keepalive\r\nevent: x\r\ndata: {\r\ndata:   \"a\": 1}\r\nid: 7\r\n\r\n");
  assert.equal(out.length, 1, "the comment must not dispatch a frame");
  assert.equal(out[0].event, "x");
  assert.equal(out[0].id, "7");
  // One leading space is framing; a second one is data.
  assert.equal(out[0].data, '{\n  "a": 1}');
  assert.deepEqual(JSON.parse(out[0].data), { a: 1 });
});

test("a stream that ends without its terminating blank line still yields the frame", () => {
  const p = createSseParser();
  assert.deepEqual(p.push('event: done\ndata: {"status":"ok"}'), []);
  assert.deepEqual(p.flush(), [{ event: "done", data: '{"status":"ok"}', id: null, retry: null }]);
});

test("a bare comment stream produces nothing at all", () => {
  const p = createSseParser();
  assert.deepEqual(p.push(":\n\n: still here\n\n"), []);
  assert.deepEqual(p.flush(), []);
});

// ── history rows ────────────────────────────────────────────────────────

test("an excerpt breaks on a word and only ellipsises when it truncated", () => {
  assert.equal(excerpt("Short question?"), "Short question?");
  const long = "Яка перша лінія терапії артеріальної гіпертензії у пацієнта похилого віку";
  const cut = excerpt(long);
  assert.ok(cut.length <= 49, `too long: ${cut.length}`);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("  "));
  // Whitespace from a two-part dictation collapses to one line.
  assert.equal(excerpt("first\n\n  second"), "first second");
  // A single word longer than the cap truncates mid-word rather than to "…".
  assert.equal(excerpt("x".repeat(60)), `${"x".repeat(48)}…`);
});

test("a question that never produced an answer is listed but not openable", () => {
  const row = historyRow({ id: "q1", question: "why?", created_at: "2026-08-01T10:00:00Z", status: null });
  assert.equal(row.openable, false);
  assert.equal(row.answerId, null);
  assert.equal(historyRow({ id: "q2", question: "y", answer_id: "a2", status: "ok" }).openable, true);
});

test("deflected reads as info in the list, not as a warning", () => {
  assert.equal(statusTone("ok"), "ok");
  assert.equal(statusTone("insufficient_basis"), "warn");
  assert.equal(statusTone("deflected"), "info");
  assert.equal(statusTone("something_new"), "info");
});

test("the list page unwraps whichever key the service used", () => {
  const withQuestions = historyPage({ questions: [{ id: "a", question: "q" }], next_cursor: "c1" });
  assert.equal(withQuestions.items.length, 1);
  assert.equal(withQuestions.nextCursor, "c1");
  assert.equal(historyPage({ items: [{ id: "b", question: "q" }] }).items.length, 1);
  assert.deepEqual(historyPage(null), { items: [], nextCursor: null });
});
