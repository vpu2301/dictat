// templatePrefs.js — per-user template stars (favorites) + usage counts.
//
// INTERIM client-side persistence (localStorage) standing in for backend-
// provided, per-user favorites and usage tracking. The API shape here is kept
// deliberately close to the planned backend contract so the swap is mechanical:
//   getStarredIds()  → GET  /templates/favorites           (Set<id>)
//   toggleStar(id)   → PUT/DELETE /templates/{id}/favorite
//   getUsage()       → usage_count returned on the list rows
//   recordUse(id)    → POST /templates/{id}/use            (increment)
// See the backend task at ~/Desktop/dictat-template-favorites-backend-task.md.
//
// Keys are namespaced and versioned so a future migration can detect/upgrade.

const STAR_KEY = "mdx.tpl.stars.v1";
const USAGE_KEY = "mdx.tpl.usage.v1";

function readJSON(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, val) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Stars / favorites ────────────────────────────────────────────────────────

// Returns a Set of starred template ids.
export function getStarredIds() {
  const arr = readJSON(STAR_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

export function isStarred(id) {
  return getStarredIds().has(id);
}

// Toggle a template's starred state. Returns the new boolean.
export function toggleStar(id) {
  if (!id) return false;
  const s = getStarredIds();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  writeJSON(STAR_KEY, [...s]);
  return s.has(id);
}

// ── Usage counts ─────────────────────────────────────────────────────────────

// Returns a plain map { [templateId]: count }.
export function getUsage() {
  const m = readJSON(USAGE_KEY, {});
  return m && typeof m === "object" ? m : {};
}

// Increment the usage counter for a template (called when it is selected/used).
export function recordUse(id) {
  if (!id) return;
  const u = getUsage();
  u[id] = (u[id] || 0) + 1;
  writeJSON(USAGE_KEY, u);
}
