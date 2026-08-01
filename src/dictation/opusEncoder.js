// opusEncoder.js — pluggable Opus encoder facade.
//
// The spec (sprint 03 §A) requires Opus VOIP profile @ 24 kbps over 20 ms
// frames. The FE owns picking a Wasm port; we keep the interface here so
// the caller can swap implementations without rewriting wsClient.js.
//
// Two encoders are exposed:
//   - `PassThroughEncoder`: returns the Int16 PCM bytes as-is. Use only in
//     unit/integration tests; backend will not accept this on a real stream.
//   - `OpusEncoder`: lazy-loads a Wasm opus encoder (e.g. opus-recorder /
//     libopus.wasm). Implement `load()` to point at your bundled wasm.
//
// Both expose `encode(int16) -> Uint8Array` synchronously after `await ready()`.

const FRAME_BYTES_MAX_PCM = 320 * 2; // 20 ms @ 16 kHz Int16 = 640 bytes

export class PassThroughEncoder {
  constructor() { this.bitrate = 0; }
  async ready() { return true; }
  encode(int16) {
    // View Int16Array's underlying bytes without copying.
    return new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  }
  destroy() {}
}

// ── WebCodecs Opus encoder (sprint 14) ────────────────────────────────
//
// The real encoder the backend's opuslib decoder needs, with no Wasm and no new
// dependency: the browser's own AudioEncoder, configured exactly to the wire
// contract (Opus, VOIP profile, 16 kHz mono, 24 kbps, 20 ms packets). One
// EncodedAudioChunk out per 20 ms AudioData in, which is one wire frame.
//
// It is ASYNCHRONOUS by nature (packets arrive on the `output` callback), so
// unlike PassThroughEncoder it cannot satisfy the synchronous `encode()`
// contract. Callers push frames with `push(int16, tsMicros)` and receive
// packets through the `onPacket` callback → DictationWsClient.sendEncoded.
//
// Availability is a hard capability check, never a silent downgrade: without
// AudioEncoder there is no way to produce a frame this backend accepts, and
// shipping PCM would be decoded as garbage rather than refused.
export function isOpusEncodingSupported() {
  return typeof globalThis !== "undefined" && typeof globalThis.AudioEncoder === "function";
}

export const OPUS_CONFIG = {
  codec: "opus",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitrate: 24000,
  opus: { application: "voip", frameDuration: 20000, complexity: 5 },
};

export class WebCodecsOpusEncoder {
  // onPacket(Uint8Array) — one encoded 20 ms Opus packet, in capture order.
  // onError(Error)       — the encoder died; the caller must stop the session
  //                        (a half-encoding stream is a corrupt transcript).
  constructor({ onPacket, onError } = {}) {
    this.bitrate = OPUS_CONFIG.bitrate;
    this.onPacket = onPacket || (() => {});
    this.onError = onError || (() => {});
    this._enc = null;
    this._ts = 0;            // presentation timestamp, microseconds
    this._closed = false;
  }

  async ready() {
    if (this._enc) return true;
    if (!isOpusEncodingSupported()) return false;
    const AE = globalThis.AudioEncoder;
    // `isConfigSupported` is the spec's own probe — a browser with AudioEncoder
    // but no Opus support says so here rather than throwing at configure().
    if (typeof AE.isConfigSupported === "function") {
      try {
        const probe = await AE.isConfigSupported(OPUS_CONFIG);
        if (probe && probe.supported === false) return false;
      } catch { return false; }
    }
    const enc = new AE({
      output: (chunk) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        this.onPacket(buf);
      },
      error: (e) => { this._closed = true; this.onError(e); },
    });
    enc.configure(OPUS_CONFIG);
    this._enc = enc;
    this._ts = 0;
    this._closed = false;
    return true;
  }

  // Feed one 20 ms mono frame (320 Int16 samples at 16 kHz). AudioData wants
  // f32-planar; the conversion is the inverse of audioPipeline's floatToInt16.
  push(int16) {
    if (!this._enc || this._closed) return false;
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    const data = new globalThis.AudioData({
      format: "f32-planar",
      sampleRate: OPUS_CONFIG.sampleRate,
      numberOfFrames: f32.length,
      numberOfChannels: 1,
      timestamp: this._ts,
      data: f32,
    });
    this._ts += Math.round((f32.length / OPUS_CONFIG.sampleRate) * 1e6);
    try {
      this._enc.encode(data);
    } finally {
      data.close();
    }
    return true;
  }

  // Drain packets still inside the encoder before the socket closes — the tail
  // of the consultation is exactly the part a clinician would notice missing.
  async flush() {
    if (!this._enc || this._closed) return;
    try { await this._enc.flush(); } catch {}
  }

  encode() {
    throw new Error("WebCodecsOpusEncoder is asynchronous — use push() + onPacket");
  }

  destroy() {
    this._closed = true;
    if (this._enc) { try { this._enc.close(); } catch {} }
    this._enc = null;
  }
}

// Legacy Wasm facade — implementation is bring-your-own. Plug the Wasm
// initializer into `load()` and the per-frame call into `encode()`.
export class OpusEncoder {
  constructor({ bitrate = 24000 } = {}) {
    this.bitrate = bitrate;
    this._enc = null;
  }
  async ready() {
    if (this._enc) return true;
    // Intentionally not bundling libopus here — frontend should add it as
    // a build-time dep. Until then, callers receive `null` and should fall
    // back to PassThroughEncoder for protocol smoke tests.
    return false;
  }
  encode(_int16) {
    if (!this._enc) throw new Error("OpusEncoder not initialised — call ready() and bundle libopus.wasm");
    return this._enc.encode(_int16);
  }
  destroy() {
    if (this._enc && typeof this._enc.destroy === "function") this._enc.destroy();
    this._enc = null;
  }
}

export const FRAME_PCM_BYTES = FRAME_BYTES_MAX_PCM;
