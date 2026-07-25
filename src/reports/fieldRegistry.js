// fieldRegistry.js — Sprint 13: field_type → renderer dispatch.
//
// Typed sections render an interactive field widget ABOVE their prose block
// (mounted by FieldWidgetsLayer); free_text sections render exactly as they
// always have — no widget, no wrapper, nothing. That regression guarantee is
// enforced here, not by convention: `free_text` is unregisterable, and
// lookups for it always return null.
//
// Steps 03–05 register the concrete renderers (choice/multi_choice chips,
// numeric+unit, date, ICD-10 diagnosis picker) at module init. Until a type
// is registered, its sections keep the plain prose rendering — templates
// with typed sections stay fully editable either way.

import { FIELD_TYPES } from "./fieldContract.js";

const renderers = new Map();

export function registerFieldRenderer(fieldType, component) {
  if (fieldType === "free_text") {
    throw new Error("free_text sections are plain prose by contract — a renderer for them is a bug");
  }
  if (!FIELD_TYPES.includes(fieldType)) {
    throw new Error(`unknown field_type ${JSON.stringify(fieldType)}`);
  }
  if (typeof component !== "function") {
    throw new Error(`renderer for ${fieldType} must be a component function`);
  }
  renderers.set(fieldType, component);
}

export function getFieldRenderer(fieldType) {
  if (fieldType === "free_text") return null;
  return renderers.get(fieldType) || null;
}

export function hasFieldRenderer(fieldType) {
  return getFieldRenderer(fieldType) != null;
}

// Test seam: reset between unit tests. App code never calls this.
export function _resetFieldRenderers() {
  renderers.clear();
}
