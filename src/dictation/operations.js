// operations.js — Final.operations[] → editor mutation registry.
//
// Backend (spec §A sprint 05) computes a FE-actionable `operations` array
// inside every `final` message. Detection is server-side; the FE never sees
// raw command tokens. The registry below maps each `op` to a pure function
// that the editor invokes.
//
// IMPORTANT (spec §C.6 sprint 05): if NLP times out at 200 ms on the
// dictation-service, `final.operations` is OMITTED. Treat missing as
// "NLP downgraded — render raw text only, skip ops."

// The editor surface we operate on. The dictation studio is expected to
// supply this adapter object; we keep the surface narrow so any editor
// implementation (TipTap, plain contenteditable, textarea) can satisfy it.
//
//   ctx = {
//     insertText(text),                  // at cursor
//     insertParagraphBreak(),
//     insertLineBreak(),
//     navigateToSection(sectionId),
//     openTemplatePicker(),
//     saveDraft(),
//     undoLastSentence(),
//     stopDictation(),
//     openQuote() / closeQuote(),
//     warn(message),
//   }
export function applyOperations(operations, ctx, options = {}) {
  if (!Array.isArray(operations) || !ctx) return { applied: 0, skipped: 0 };
  const { onAudit } = options;
  let applied = 0, skipped = 0;
  for (const op of operations) {
    try {
      switch (op.op) {
        case "insert_paragraph_break":
          ctx.insertParagraphBreak && ctx.insertParagraphBreak();
          break;
        case "insert_line_break":
          ctx.insertLineBreak && ctx.insertLineBreak();
          break;
        case "insert_punctuation":
          ctx.insertText && ctx.insertText(op.arg && op.arg.value ? op.arg.value : "");
          break;
        case "navigate_section":
          ctx.navigateToSection && ctx.navigateToSection(op.arg && op.arg.section_id);
          break;
        case "insert_template":
          // Sprint 06 wires the template id; for now open the picker.
          ctx.openTemplatePicker && ctx.openTemplatePicker();
          break;
        case "save_draft":
          ctx.saveDraft && ctx.saveDraft();
          break;
        case "undo_last":
          ctx.undoLastSentence && ctx.undoLastSentence();
          break;
        case "stop_dictation":
          ctx.stopDictation && ctx.stopDictation();
          break;
        case "insert_quote_marker": {
          const v = op.arg && op.arg.value;
          if (v === "open")  ctx.openQuote  && ctx.openQuote();
          if (v === "close") ctx.closeQuote && ctx.closeQuote();
          break;
        }
        case "unknown_intent":
          // Backend saw an intent that doesn't map to a known op. Surface
          // softly — common when vocab drifts on the backend side.
          ctx.warn && ctx.warn(`Unknown voice intent: ${op.arg && op.arg.intent}`);
          skipped++;
          if (onAudit) onAudit({ kind: "voice_command.unknown", intent: op.arg && op.arg.intent });
          continue;
        default:
          skipped++;
          continue;
      }
      applied++;
      if (onAudit) onAudit({ kind: "voice_command.executed", op: op.op, arg: op.arg });
    } catch {
      skipped++;
    }
  }
  return { applied, skipped };
}

// Confidence thresholds — BACKEND-PINNED (spec §B sprint 05).
//   probability < 0.40  → "high_concern"
//   probability < 0.65  → "moderate"
//   probability ≥ 0.65  → no annotation
// The FE TODO's 0.70 threshold is WRONG and must not be used.
export const CONFIDENCE_HIGH_CONCERN = 0.40;
export const CONFIDENCE_MODERATE     = 0.65;

// Render Final.text + Final.confidence_spans[] into segments suitable for
// JSX. Backend pre-merges adjacent same-level spans, so we trust the order
// of `spans` and never recompute thresholds client-side.
//
// Returns: [{ text, level }] where `level` is one of:
//   undefined            — no annotation
//   "moderate"           — 0.40 ≤ p < 0.65
//   "high_concern"       — p < 0.40
export function buildConfidenceSegments(text, spans) {
  if (!text) return [];
  if (!Array.isArray(spans) || spans.length === 0) {
    return [{ text, level: undefined }];
  }
  // Defensive: clip to text length, drop invalid.
  const clean = spans
    .filter((s) => Number.isInteger(s.start_char) && Number.isInteger(s.end_char))
    .map((s) => ({
      start: Math.max(0, Math.min(text.length, s.start_char)),
      end:   Math.max(0, Math.min(text.length, s.end_char)),
      level: s.level,
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const out = [];
  let cursor = 0;
  for (const s of clean) {
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start), level: undefined });
    out.push({ text: text.slice(s.start, s.end), level: s.level });
    cursor = s.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), level: undefined });
  return out;
}
