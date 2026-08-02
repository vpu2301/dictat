// degraded.test.js — sprint 15: "the audio is gone" is an ANSWER, and each
// backend code is a different fact about the world. Collapsing them into one
// apology is the failure this sprint exists to avoid, so the mapping is pinned
// here rather than left to whoever edits the JSX next.
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../api/client.js";
import { classifyClipError, clipErrorCode } from "../api/audioClips.js";
import { degradedCopy } from "./degraded.js";

const gone = (code) => new ApiError(410, { code, detail: "x" });
const goneNested = (code) => new ApiError(410, { detail: { code, detail: "x" } });

test("410 codes are read at either problem level (FastAPI nests dict details)", () => {
  assert.equal(clipErrorCode(gone("audio_erased")), "audio_erased");
  assert.equal(clipErrorCode(goneNested("audio_not_retained")), "audio_not_retained");
});

test("each 410 code produces its OWN sentence — no shared apology", () => {
  const codes = [
    "no_audio_source", "audio_not_retained", "audio_erased", "audio_partially_retained",
  ];
  const said = codes.map((c) => degradedCopy(classifyClipError(gone(c)), "uk"));
  assert.equal(new Set(said).size, codes.length, "four codes, four distinct messages");
  for (const s of said) assert.ok(s.length > 10);
});

test("retention expiry says retention; erasure says deletion", () => {
  const retained = degradedCopy(classifyClipError(gone("audio_not_retained")), "uk");
  assert.match(retained, /термін зберігання/);
  const erased = degradedCopy(classifyClipError(gone("audio_erased")), "uk");
  assert.match(erased, /видалено/);
});

test("truncated sessions admit which part survived", () => {
  const c = classifyClipError(gone("audio_partially_retained"));
  assert.equal(c.kind, "gone");
  assert.match(degradedCopy(c, "en"), /only a later part/i);
});

test("an unknown 410 code degrades to the erasure wording, still 'gone'", () => {
  const c = classifyClipError(gone("something_new"));
  assert.deepEqual(c, { kind: "gone", code: "audio_erased" });
});

test("429 is a limit, not a loss — and repeats the server's Retry-After", () => {
  const c = classifyClipError(new ApiError(429, { detail: "clip rate limit reached", retry_after: 900 }));
  assert.equal(c.kind, "rate_limited");
  assert.equal(c.retryAfterSec, 900);
  assert.match(degradedCopy(c, "uk"), /15 хв/);
  assert.match(degradedCopy({ kind: "rate_limited" }, "uk"), /на цю годину/);
});

test("an expired LINK is recoverable and says so; a 410 clip_expired is the same case", () => {
  const link = classifyClipError(new ApiError(403, { code: "clip_link_expired" }));
  assert.equal(link.kind, "expired");
  assert.match(degradedCopy(link, "uk"), /ще раз/);
  assert.equal(classifyClipError(gone("clip_expired")).kind, "expired");
});

test("422 is the 60-second cap, phrased as the product's own rule", () => {
  const c = classifyClipError(new ApiError(422, { detail: "span exceeds 60000 ms" }));
  assert.equal(c.kind, "too_long");
  assert.match(degradedCopy(c, "en"), /review, not export/);
});

test("a plain 403 is an access answer, not an audio answer", () => {
  const c = classifyClipError(new ApiError(403, { detail: "forbidden" }));
  assert.equal(c.kind, "forbidden");
  assert.match(degradedCopy(c, "uk"), /доступу/);
});

test("anything unrecognised still says something true and short", () => {
  const c = classifyClipError(new ApiError(500, { detail: "boom" }));
  assert.equal(c.kind, "other");
  assert.match(degradedCopy(c, "en"), /could not be played/);
});
