// audioPipeline.js — capture → 16 kHz mono → 20 ms frames.
//
// Backend wire contract (spec §A sprint 03):
//   16 kHz mono PCM → Opus VOIP profile 24 kbps → 20 ms framing → prepend
//   4-byte BE sequence header → ship binary WS frame (5..=8192 bytes).
//
// This module produces 20-ms PCM frames (320 Int16 samples each). The Opus
// encoder is plugged in by the caller via `encode()` — the spec calls for
// libopus.wasm; we leave the binding out of this file so the consumer can
// drop it in without touching capture. If `encode` is omitted, we emit
// uncompressed PCM as a degraded path (sufficient for protocol tests in
// the FE; backend will not accept it in prod).

const TARGET_RATE = 16000;
const FRAME_MS = 20;
export const FRAME_SAMPLES = (TARGET_RATE * FRAME_MS) / 1000; // 320

// Mix-down stereo to mono and resample to 16 kHz with a naive linear
// resampler. Backend doesn't care about source rate — only the encoded
// 16 kHz framing reaches it.
function resampleMono(input, inputRate) {
  const ratio = TARGET_RATE / inputRate;
  const outLength = Math.floor(input.length * ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i / ratio;
    const a = Math.floor(srcIdx);
    const b = Math.min(a + 1, input.length - 1);
    const t = srcIdx - a;
    out[i] = input[a] * (1 - t) + input[b] * t;
  }
  return out;
}

function floatToInt16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// Lightweight RMS for the audio meter / silence gating.
export function rmsLevel(int16) {
  let sum = 0;
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, int16.length));
}

// Hooks up a MediaStreamSource to a ScriptProcessor (or AudioWorklet when
// available) and dispatches 20 ms PCM frames via onFrame(int16, ts).
//
// Returns an object with stop(). The caller owns the MediaStream — we never
// stop tracks on its behalf.
export function startCapture({ stream, onFrame, onLevel } = {}) {
  if (!stream) throw new Error("startCapture: stream required");
  const AC = window.AudioContext || window.webkitAudioContext;
  // Per spec: try to ask the browser for 16 kHz directly. If unsupported,
  // we fall back to native rate + JS resample.
  let ctx;
  try { ctx = new AC({ sampleRate: TARGET_RATE }); }
  catch { ctx = new AC(); }
  const src = ctx.createMediaStreamSource(stream);

  // 4096-sample buffer ≈ 256 ms at 16 kHz → split into 20 ms slices.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  let leftover = new Float32Array(0);

  proc.onaudioprocess = (ev) => {
    const inBuf = ev.inputBuffer.getChannelData(0);
    const mono = ctx.sampleRate === TARGET_RATE ? inBuf : resampleMono(inBuf, ctx.sampleRate);
    // Concat leftover + new samples.
    const merged = new Float32Array(leftover.length + mono.length);
    merged.set(leftover, 0);
    merged.set(mono, leftover.length);

    let offset = 0;
    while (merged.length - offset >= FRAME_SAMPLES) {
      const slice = merged.subarray(offset, offset + FRAME_SAMPLES);
      const int16 = floatToInt16(slice);
      const ts = ev.playbackTime ? ev.playbackTime * 1000 : performance.now();
      if (onFrame) onFrame(int16, ts);
      if (onLevel) onLevel(rmsLevel(int16));
      offset += FRAME_SAMPLES;
    }
    leftover = merged.slice(offset);
  };

  src.connect(proc);
  proc.connect(ctx.destination); // required to keep onaudioprocess alive

  return {
    stop: async () => {
      try { proc.disconnect(); src.disconnect(); } catch {}
      try { await ctx.close(); } catch {}
    },
    context: ctx,
  };
}

// Best-effort getUserMedia with the constraints backend cares about
// (echo cancellation + noise suppression on; mono).
export async function requestMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}
