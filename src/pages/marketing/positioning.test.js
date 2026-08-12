// positioning.test.js — the category story holds together in every language.
//
//   node --test src/pages/marketing/positioning.test.js
//
// Marketing copy is not usually worth a test. This copy is, for three reasons,
// and each test below is one of them:
//
//   1. The site ships in eleven languages. A missing key does not look like a
//      bug in review — it looks like English, and only to speakers of the other
//      ten. The parity test is the only thing that catches a half-translated
//      pillar before a customer does.
//   2. The positioning is deliberately duplicated across surfaces (landing,
//      /platform, the pillar pages). It is duplicated by IMPORT, not by
//      retyping, and these tests pin that: a page that grows its own copy of
//      the USP is how a site starts contradicting itself.
//   3. Two of the claims are not built yet. The roadmap items must stay
//      labelled and must stay out of the shipped bullet lists — a check mark
//      next to "national health registry" would be a false claim, not a typo.

import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGS } from "../../i18n.js";
import { PILLARS, TRANSLATED, positioning, pillars, moatItems } from "./positioning.js";
import { getContent } from "./content.js";

const CODES = LANGS.map((l) => l.code);

test("every shipped language has the whole story written out", () => {
  // Not "renders without crashing" — the fallback guarantees that. This is the
  // stronger claim: nobody is reading English where they asked for Hungarian.
  for (const code of CODES) {
    assert.ok(TRANSLATED.includes(code), `${code}: positioning is not translated`);
    const p = positioning(code);
    for (const key of ["category", "usp", "soonLabel"]) {
      assert.ok(p[key]?.length > 3, `${code}: ${key} is missing`);
    }
    for (const key of ["eyebrow", "title", "sub", "foot", "more", "safety"]) {
      assert.ok(p.loop[key]?.length > 3, `${code}: loop.${key} is missing`);
    }
    assert.equal(p.moat.items.length, 6, `${code}: the moat lost a card`);
    for (const m of p.moat.items) {
      assert.ok(m.t && m.d, `${code}: a moat card is half-written`);
    }
    for (const pil of pillars(code)) {
      assert.ok(pil.verb && pil.tagline, `${code}: pillar ${pil.key} is half-written`);
      // Three claims per pillar — but a pillar that has shipped nothing makes
      // them as roadmap items, not as bullets with a check mark beside them.
      // Bill is the only one in that state today; if a second one appears the
      // shape below is what keeps it honest rather than a special case.
      const claims = pil.points.length ? pil.points : pil.soon ?? [];
      assert.equal(claims.length, 3, `${code}: pillar ${pil.key} has the wrong claim count`);
      if (!pil.points.length) {
        assert.ok(pil.soon?.length, `${code}: pillar ${pil.key} claims nothing at all`);
      }
    }
  }
});

test("no language is quietly falling back to English", () => {
  // A language that renders English text is the failure mode the fallback
  // exists to soften and the one this file exists to prevent. Ukrainian is the
  // sample because it shares no vocabulary with English — a match there means
  // the key was never translated, not that two languages agree on a word.
  const en = positioning("en");
  const uk = positioning("uk");
  assert.notEqual(uk.category, en.category);
  assert.notEqual(uk.usp, en.usp);
  assert.notEqual(uk.loop.title, en.loop.title);
});

test("the pillars are the loop, in order, and each one has somewhere to go", () => {
  assert.deepEqual(PILLARS.map((p) => p.key), ["listen", "verify", "authorize", "bill"]);
  assert.deepEqual(PILLARS.map((p) => p.n), ["01", "02", "03", "04"]);
  for (const p of PILLARS) {
    // The link a card makes must resolve, or the loop dead-ends in a 404 at
    // exactly the moment a reader got interested.
    const slug = p.path.replace(/^\//, "");
    assert.ok(getContent(slug, "en"), `${p.key}: ${p.path} has no page`);
    assert.ok(getContent(slug, "uk"), `${p.key}: ${p.path} has no Ukrainian page`);
  }
});

test("the platform page exists in every language and carries the USP verbatim", () => {
  // Verbatim, because the USP is a claim we make identically everywhere. If a
  // page ever needs a different one, that is a positioning decision — it
  // belongs in positioning.js, not in a page that quietly diverged.
  for (const code of CODES) {
    const page = getContent("platform", code);
    assert.ok(page, `${code}: /platform is missing`);
    assert.equal(page.hero.sub, positioning(code).usp, `${code}: /platform restates the USP`);
    assert.ok(page.blocks.length >= 4, `${code}: /platform lost a block`);
  }
});

test("the roadmap claims are labelled, and never sold as shipped", () => {
  // The registry commit and e-prescription are not built. They may be said —
  // they are part of the story — but never with a check mark next to them and
  // never without the label. Both languages, because a label that exists only
  // in English is not a label.
  for (const code of ["en", "uk"]) {
    const p = positioning(code);
    const authorize = pillars(code).find((x) => x.key === "authorize");
    assert.ok(authorize.soon?.length, `${code}: the roadmap items vanished from the pillar`);
    assert.ok(p.soonLabel?.length > 2, `${code}: there is no label to mark them with`);
    const shipped = [...authorize.points, ...pillars(code).flatMap((x) => x.points)].join(" ").toLowerCase();
    for (const claim of ["registry", "реєстр", "prescription", "рецепт"]) {
      assert.ok(!shipped.includes(claim),
        `${code}: "${claim}" is being presented as a shipped capability`);
    }
  }
});

test("the pillar pages restate the pillar rather than inventing a second version", () => {
  for (const key of ["verify", "authorize"]) {
    const pillar = pillars("en").find((p) => p.key === key);
    const page = getContent(pillar.path.replace(/^\//, ""), "en");
    assert.equal(page.hero.sub, pillar.tagline, `${key}: the page rewrote the tagline`);
    assert.deepEqual(page.hero.points, pillar.points, `${key}: the page rewrote the points`);
  }
  // Bill's page is /rcm, which adds a per-country argument the other pillar
  // pages have no equivalent of — so it restates the tagline but carries its
  // own hero points. The tagline is the part that must not fork.
  const bill = pillars("en").find((p) => p.key === "bill");
  assert.equal(getContent("rcm", "en").hero.sub, bill.tagline, "bill: /rcm rewrote the tagline");
});
