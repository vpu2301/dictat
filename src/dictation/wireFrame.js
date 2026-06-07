// wireFrame.js — encode/decode the binary WS frame the backend expects.
//
// Wire shape: [4-byte BE sequence number][Opus bytes], total 5..=8192 bytes.
// Backend closes WS with code "bad_message" if either bound is violated, so
// every helper here validates before returning.

export const HEADER_BYTES = 4;
export const MIN_FRAME_BYTES = 5;     // header + at least 1 Opus byte
export const MAX_FRAME_BYTES = 8192;
export const MAX_PAYLOAD_BYTES = MAX_FRAME_BYTES - HEADER_BYTES; // 8188

// Backend's sequence-gap policy (spec §B sprint 03):
//   seq < expected   → silently dropped as duplicate
//   gap ≤ 50 frames  → backend pads with silence and accepts
//   gap > 50 frames  → backend emits Error{code: gap_detected}, awaits retransmit_range
export const GAP_PAD_THRESHOLD = 50;

export function writeUint32BE(seq) {
  const buf = new Uint8Array(4);
  buf[0] = (seq >>> 24) & 0xff;
  buf[1] = (seq >>> 16) & 0xff;
  buf[2] = (seq >>> 8) & 0xff;
  buf[3] = seq & 0xff;
  return buf;
}

export function readUint32BE(bytes) {
  return (
    ((bytes[0] << 24) >>> 0) |
    (bytes[1] << 16) |
    (bytes[2] << 8) |
    bytes[3]
  ) >>> 0;
}

// Wrap a raw Opus payload as the WS binary frame.
// Throws if the resulting frame would be rejected by the backend.
export function encodeFrame(seq, opusBytes) {
  if (!Number.isInteger(seq) || seq < 0 || seq > 0xffffffff) {
    throw new RangeError(`seq out of range: ${seq}`);
  }
  if (!opusBytes || opusBytes.length < 1) {
    throw new RangeError("opus payload empty");
  }
  if (opusBytes.length > MAX_PAYLOAD_BYTES) {
    throw new RangeError(`opus payload too large: ${opusBytes.length} > ${MAX_PAYLOAD_BYTES}`);
  }
  const out = new Uint8Array(HEADER_BYTES + opusBytes.length);
  out.set(writeUint32BE(seq), 0);
  out.set(opusBytes, HEADER_BYTES);
  return out;
}

export function decodeFrame(bytes) {
  if (!bytes || bytes.length < MIN_FRAME_BYTES) throw new RangeError("frame too small");
  if (bytes.length > MAX_FRAME_BYTES) throw new RangeError("frame too large");
  return { seq: readUint32BE(bytes), payload: bytes.subarray(HEADER_BYTES) };
}
