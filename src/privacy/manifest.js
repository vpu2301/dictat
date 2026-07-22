// manifest.js — pure helpers for the DSAR manifest summary and the download
// error surface. Kept out of the page so they can be unit-tested.
//
// As-built contract (core-service, GET /privacy-requests/{id}):
//   manifest_summary = {
//     engine_version: "dsar-engine/1",
//     item_count: <int>,                       // files in the package
//     excluded: [{ kind, reason }],            // OBJECTS, not strings
//     inventory_counts: { <kind>: <int> },
//     package_sha256: "<hex>", package_bytes: <int>,
//   }
// Older fixtures (and the pilot mocks) sometimes carry `excluded` as a plain
// list of strings, so both shapes are normalised here — rendering the raw
// objects is what produced "виключено: [object Object]".

import { tr } from "../i18n.js";

export function normalizeExcluded(excluded) {
  if (!Array.isArray(excluded)) return [];
  return excluded
    .map((e) => {
      if (e == null) return null;
      if (typeof e === "string") return { kind: e, reason: "" };
      const kind = e.kind ?? e.type ?? "";
      const reason = e.reason ?? e.detail ?? "";
      if (!kind && !reason) return null;
      return { kind: String(kind), reason: String(reason) };
    })
    .filter(Boolean);
}

// Human label for an excluded artefact kind. Unknown kinds fall through to the
// raw value — never invent a category the backend did not report.
const EXCLUDED_KIND = {
  "patient.ipn":       { uk: "ІПН", en: "Tax ID (ІПН)" },
  recording_audio:     { uk: "Аудіозаписи", en: "Raw audio" },
  raw_audio:           { uk: "Аудіозаписи", en: "Raw audio" },
  "audit.other_kinds": { uk: "Службові події аудиту", en: "Operator audit events" },
};
export function excludedKindLabel(kind, lang) {
  const m = EXCLUDED_KIND[kind];
  return m ? tr(lang, m.uk, m.en) : String(kind || "—");
}

export function formatBytes(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// The download endpoint's failure modes, translated. `code` is the RFC 9457
// extension member the backend sets; status alone is not enough to tell
// "link aged out" (403) from "not permitted" (403 without a code).
export function downloadErrorMessage(err, lang) {
  const code = err?.problem?.code;
  if (code === "download_link_expired") {
    return tr(lang,
      "Посилання на завантаження діє 15 хвилин і встигло застаріти. Натисніть «Завантажити пакет» ще раз.",
      "The download link is valid for 15 minutes and expired. Press “Download package” again.");
  }
  if (code === "package_expired" || err?.status === 410) {
    return tr(lang,
      "Пакет видалено після завершення строку зберігання — запросіть експорт повторно з картки пацієнта.",
      "The package was deleted after its retention window — request the export again from the patient record.");
  }
  if (err?.status === 403) {
    return tr(lang,
      "Немає доступу до пакета DSAR (потрібне право patient.dsar).",
      "You are not allowed to download this DSAR package (requires patient.dsar).");
  }
  return err?.problem?.detail || err?.problem?.title || err?.message
    || tr(lang, "Не вдалося завантажити пакет.", "Could not download the package.");
}
