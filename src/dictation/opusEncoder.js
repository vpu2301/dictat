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

// Real Opus encoder — implementation is bring-your-own. Plug the Wasm
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
