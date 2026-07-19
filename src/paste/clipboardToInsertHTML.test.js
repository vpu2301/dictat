// Units for clipboardToInsertHTML — the paste-flavor logic that fixes the
// "pasting between sections carries the section label" bug. The plain-text
// path is DOM-free (the html-fallback branch needs a browser DOM and is
// exercised in the editor E2E, not here).
//
//   node --test src/paste/clipboardToInsertHTML.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { clipboardToInsertHTML, escapeHTML } from "./sanitizingPaste.js";

test("prefers text/plain over text/html (the in-editor cross-section case)", () => {
  // An in-editor copy's HTML flavor carries the source <section> wrapper whose
  // title 'ПОКАЗАННЯ' would leak as a label; text/plain is the clean content.
  const out = clipboardToInsertHTML({
    plain: "Скарги на кашель протягом двох тижнів.",
    html: '<section data-section-title="ПОКАЗАННЯ" class="tiptap-section"><p>Скарги на кашель протягом двох тижнів.</p></section>',
  });
  assert.equal(out, "Скарги на кашель протягом двох тижнів.");
  assert.ok(!/ПОКАЗАННЯ/.test(out), "section label must never survive");
  assert.ok(!/section/i.test(out), "no section structure in the insert");
});

test("newlines become <br> so line-per-finding layout survives", () => {
  const out = clipboardToInsertHTML({ plain: "Правобічна.\nБронхопневмонія базальна." });
  assert.equal(out, "Правобічна.<br>Бронхопневмонія базальна.");
});

test("normalizes CRLF and collapses 3+ blank lines to one gap", () => {
  assert.equal(clipboardToInsertHTML({ plain: "a\r\nb" }), "a<br>b");
  assert.equal(clipboardToInsertHTML({ plain: "a\n\n\n\nb" }), "a<br><br>b");
});

test("escapes HTML so pasted angle brackets are inert (no injection)", () => {
  const out = clipboardToInsertHTML({ plain: "<img src=x onerror=alert(1)> & <b>x</b>" });
  assert.ok(!/<img/.test(out) && !/<b>/.test(out));
  assert.equal(out, "&lt;img src=x onerror=alert(1)&gt; &amp; &lt;b&gt;x&lt;/b&gt;");
});

test("empty / whitespace-only clipboard yields empty insert", () => {
  assert.equal(clipboardToInsertHTML({}), "");
  assert.equal(clipboardToInsertHTML({ plain: "" }), "");
});

test("escapeHTML is pure and covers the three metacharacters", () => {
  assert.equal(escapeHTML('a & b < c > d'), "a &amp; b &lt; c &gt; d");
});
