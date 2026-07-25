// Sprint 13 step 01 — renderer dispatch: free_text is unregisterable (the
// pixel-stability guard is enforced, not conventional), unknown types are
// rejected, and unregistered types dispatch to null (→ plain prose).
//
//   npm run test:unit
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  registerFieldRenderer,
  getFieldRenderer,
  hasFieldRenderer,
  _resetFieldRenderers,
} from "./fieldRegistry.js";

beforeEach(() => _resetFieldRenderers());

test("free_text can never have a renderer", () => {
  assert.throws(() => registerFieldRenderer("free_text", () => null), /free_text/);
  assert.equal(getFieldRenderer("free_text"), null);
});

test("unknown field types are rejected at registration and dispatch to null", () => {
  assert.throws(() => registerFieldRenderer("hologram", () => null), /unknown field_type/);
  assert.equal(getFieldRenderer("hologram"), null);
});

test("a registered renderer dispatches; unregistered types stay null", () => {
  const Chips = () => null;
  registerFieldRenderer("choice", Chips);
  assert.equal(getFieldRenderer("choice"), Chips);
  assert.equal(hasFieldRenderer("choice"), true);
  // Not yet registered (steps 03–05) → prose fallback.
  assert.equal(getFieldRenderer("structured_diagnosis"), null);
  assert.equal(hasFieldRenderer("multi_choice"), false);
});

test("non-function renderers are rejected", () => {
  assert.throws(() => registerFieldRenderer("choice", {}), /component function/);
});
