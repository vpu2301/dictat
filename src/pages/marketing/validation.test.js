// validation.test.js — the page that says what has been measured must not
// itself contain an unmeasured number.
//
//   node --test src/pages/marketing/validation.test.js
//
// /validation exists to state, in public, which of this product's claims have
// been measured and which have not. That makes it the one page where a
// plausible-looking figure is not a copy problem but a false statement to a
// clinician — so the honesty of the page is asserted here rather than left to
// whoever edits the copy next.
//
// Three failure modes, one test each:
//
//   1. A measured-looking number appears somewhere other than the targets
//      block. Every decimal on this page must be one of the four thresholds
//      that were written down BEFORE the runs (docs/eval/sprint-04-streaming-
//      wer.md). Anything else is a result, and there are no results yet.
//   2. The targets stop being labelled as targets. Four numbers under a
//      heading, with nothing saying they are goals, read as achievements.
//   3. The "what we have not published" block quietly disappears — which is
//      how a page like this turns into marketing without anyone deciding to.

import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGS } from "../../i18n.js";
import { getContent } from "./content.js";

const CODES = LANGS.map((l) => l.code);

/* The thresholds from the eval methodology — pre-registered, and labelled as
   targets everywhere they appear. */
const TARGET_NUMBERS = new Set(["0.18", "0.19", "0.14", "0.15", "0.10", "0.11", "0.08", "0.09"]);

/* The one other decimal the page is allowed to carry, and the reason it is
   allowed: WER = 1.0 is what every stored run currently scores, because the
   corpus holds placeholder fixtures instead of speech. It is the disclosure
   itself — a claim of total failure against an empty corpus — and it is the
   opposite of the thing this test exists to prevent. It leaves this set on the
   day real audio lands and the runs start producing results. */
const DISCLOSED_NUMBERS = new Set(["1.0"]);

/* Every string in a block tree, whatever its shape. */
function strings(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => strings(n, out));
  return out;
}

function page(lang) {
  const content = getContent("validation", lang);
  assert.ok(content, `/validation must resolve in ${lang}`);
  return content;
}

test("the page resolves in every language the site offers", () => {
  for (const lang of CODES) {
    const content = page(lang);
    assert.ok(content.hero.title.trim(), `${lang}: hero title`);
    assert.ok(content.blocks.length >= 6, `${lang}: blocks`);
  }
});

test("no decimal on the page is anything but a pre-registered target", () => {
  for (const lang of CODES) {
    const found = strings(page(lang))
      .flatMap((s) => s.match(/\d+[.,]\d+/g) || [])
      .map((n) => n.replace(",", "."));
    for (const n of found) {
      assert.ok(
        TARGET_NUMBERS.has(n) || DISCLOSED_NUMBERS.has(n),
        `${lang}: ${n} is not one of the pre-registered targets. If it is a `
        + "measured result, it needs the corpus version, model and run date "
        + "beside it; if it is illustrative, it does not belong on this page.",
      );
    }
    // And every target must actually be present — a page that lost the block
    // would pass the check above vacuously.
    for (const target of TARGET_NUMBERS) {
      assert.ok(found.includes(target), `${lang}: target ${target} is missing`);
    }
  }
});

test("the targets are labelled as targets, not as results", () => {
  for (const lang of CODES) {
    const spec = page(lang).blocks.find((b) => b.type === "spec");
    assert.ok(spec, `${lang}: the targets block`);
    assert.ok(spec.sub && spec.sub.trim(), `${lang}: the targets need their caveat`);
    // Every row states a threshold rather than a value.
    for (const row of spec.rows) {
      assert.match(row.value, /≤/, `${lang}: ${row.key} reads as a measurement`);
    }
  }
});

test("the page keeps saying which numbers do not exist yet", () => {
  for (const lang of CODES) {
    const blocks = page(lang).blocks;
    /* The disclosure block is the one carrying a lead — it is the only prose
       block on the page that opens with a standalone statement, because that
       statement is the point of the page. */
    const disclosure = blocks.filter((b) => b.type === "prose" && b.lead);
    assert.equal(disclosure.length, 1, `${lang}: exactly one disclosure block`);
    assert.ok(
      disclosure[0].paragraphs.length >= 2,
      `${lang}: the disclosure must say what is missing AND what would fill it`,
    );
  }
});
