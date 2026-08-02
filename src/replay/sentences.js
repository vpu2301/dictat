// sentences.js — the alignment between what a report SAYS and what was HEARD
// (sprint 15, ADR-0037). Pure functions: this is the part that must be right,
// and it is the part a unit test can actually pin down.
//
// The backend hands back segment timings for a section (`start_ms`, `end_ms`,
// `speaker`), never transcript text — the text is already in the report the
// clinician just read. So the FE owns the mapping from sentence to moment, and
// it owes the reader the truth about how confident that mapping is:
//
//   exact  — the section carries `transcript_segment_ids` and the counts line
//            up 1:1 (sprint-14 conversation drafts). Sentence i IS segment i.
//   approx — anything older: the listing fell back to the WHOLE session
//            transcript, so we align by TIMING — a sentence's share of the
//            section text maps to the same share of the recorded span. The UI
//            says so; it does not pretend otherwise.
//
// Nothing here invents audio. No segments ⇒ no affordance.

const TERMINAL = /[.!?…]/;
const CLOSER = /[»"'’”)\]]/;

// Split section text into sentences, keeping character offsets. The pieces
// must concatenate back into the ORIGINAL string byte for byte — the review
// screen renders them in sequence, so a dropped newline is a report that
// silently loses its line-per-finding layout.
//
// Terminal punctuation stays with its sentence, together with any run of marks
// and closers after it ("…у нормі?!»" is one sentence, not three). A newline
// always ends one. Whitespace-only pieces are never their own tap target —
// they are folded into the neighbouring sentence.
export function splitSentences(text) {
  const src = String(text ?? "");
  const raw = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] === "\n") {
      raw.push([start, i + 1]);
      start = i + 1;
      i += 1;
      continue;
    }
    if (TERMINAL.test(src[i])) {
      let j = i + 1;
      while (j < src.length && (TERMINAL.test(src[j]) || CLOSER.test(src[j]))) j++;
      raw.push([start, j]);
      start = j;
      i = j;
      continue;
    }
    i += 1;
  }
  if (start < src.length) raw.push([start, src.length]);

  const out = [];
  let pendingStart = null; // leading whitespace with no sentence to attach to yet
  for (const [s, e] of raw) {
    if (src.slice(s, e).trim().length === 0) {
      if (out.length) {
        const last = out[out.length - 1];
        last.end = e;
        last.text = src.slice(last.start, e);
      } else if (pendingStart === null) {
        pendingStart = s;
      }
      continue;
    }
    const from = pendingStart === null ? s : pendingStart;
    pendingStart = null;
    out.push({ start: from, end: e, text: src.slice(from, e) });
  }
  return out;
}

// Diarisation ids as the backend emits them (`SPEAKER_00`…) → the vocabulary
// sprint 14's copy module speaks (`S1`/`S2`). An unrecognised id stays as-is
// so speakerLabel falls through to its honest "Resolving…" case.
export function normalizeSpeaker(speaker) {
  if (!speaker) return null;
  const m = /^SPEAKER_?(\d+)$/i.exec(String(speaker));
  if (!m) return String(speaker);
  const n = Number(m[1]);
  return n === 0 ? "S1" : n === 1 ? "S2" : `S${n + 1}`;
}

// Clip spans get a floor: a 40 ms sentence produces an unhearable click, and
// the backend's ±300 ms pad is about edges, not about making a clip audible.
export const MIN_SPAN_MS = 700;

// → one entry per sentence: { startMs, endMs, exact, speaker, speakerRole } or
// null when there is nothing to play.
export function alignSentencesToSegments(sentences, segments) {
  const segs = (segments || [])
    .filter((s) => Number.isFinite(s?.start_ms) && Number.isFinite(s?.end_ms) && s.end_ms > s.start_ms)
    .slice()
    .sort((a, b) => a.start_ms - b.start_ms);
  if (!sentences.length || !segs.length) return sentences.map(() => null);

  // 1:1 — the conversation case. Sentence i IS segment i; nothing is guessed.
  if (segs.length === sentences.length) {
    return sentences.map((_, i) => ({
      startMs: segs[i].start_ms,
      endMs: Math.max(segs[i].end_ms, segs[i].start_ms + MIN_SPAN_MS),
      exact: true,
      speaker: normalizeSpeaker(segs[i].speaker),
      speakerRole: segs[i].speaker_role || null,
    }));
  }

  // Fallback: align by timing. The section's characters are laid over the
  // recorded span proportionally — the only honest mapping available when the
  // listing is the whole session transcript.
  const totalChars = sentences[sentences.length - 1].end - sentences[0].start;
  const t0 = segs[0].start_ms;
  const t1 = segs[segs.length - 1].end_ms;
  const span = t1 - t0;
  if (totalChars <= 0 || span <= 0) return sentences.map(() => null);

  const base = sentences[0].start;
  return sentences.map((s) => {
    const from = t0 + ((s.start - base) / totalChars) * span;
    const to = t0 + ((s.end - base) / totalChars) * span;
    const startMs = Math.max(0, Math.round(from));
    const endMs = Math.max(Math.round(to), startMs + MIN_SPAN_MS);
    const mid = (startMs + endMs) / 2;
    const hit = segs.find((g) => mid >= g.start_ms && mid < g.end_ms) || null;
    return {
      startMs,
      endMs,
      exact: false,
      speaker: hit ? normalizeSpeaker(hit.speaker) : null,
      speakerRole: hit?.speaker_role || null,
    };
  });
}
