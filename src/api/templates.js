// templates.js — structured report templates (sprint 06). Each template names
// a specialty, an icon/code, and an ordered list of sections (with required
// flags and dictation anchors). Drives the Studio section scaffold and the
// Templates admin page.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

export async function listTemplates() {
  return a(`/templates`, { method: "GET" });
}

export async function getTemplate(id) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createTemplate(body) {
  return a(`/templates`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateTemplate(id, patch) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) });
}

export async function deleteTemplate(id) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
