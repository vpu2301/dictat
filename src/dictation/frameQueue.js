// frameQueue.js — IndexedDB-backed ring buffer for outgoing Opus frames.
//
// Purpose: resilience against network drops during a live session. Backend
// supports `retransmit_range {from_seq, to_seq}` to recover gaps; the ring
// must be deep enough to satisfy the largest gap the backend will tolerate.
//
// Capacity policy (spec §D sprint 03): ~3 minutes at 20 ms framing = 9000
// frames. Backend's session hard-cap is 60 minutes; do NOT size the ring to
// match the session — only to network-drop survival.
//
// Ack semantics (spec §B sprint 03): backend acks are *implicit* via Partial/
// Final messages reaching ever-later end_ms. The FE's WS client computes the
// highest-seq known-delivered and calls evictThrough(seq). The ring drops
// frames at or below that watermark.

const DB_NAME = "mdx-dictation";
const STORE_NAME = "frames";
const DB_VERSION = 1;

// 20 ms × 9000 ≈ 3 min.
const DEFAULT_CAPACITY = 9000;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "seq" });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export class FrameQueue {
  constructor({ capacity = DEFAULT_CAPACITY, sessionId } = {}) {
    this.capacity = capacity;
    this.sessionId = sessionId || null;
    this.db = null;
    // Local memory cache so we don't hit IDB on the hot path.
    this.memory = new Map(); // seq -> { seq, sessionId, frame: Uint8Array, ts }
    this.lowest = null;
    this.highest = null;
    this.lastAcked = -1;
  }

  async init() {
    if (typeof indexedDB === "undefined") return; // SSR / unsupported
    try { this.db = await openDb(); } catch { this.db = null; }
  }

  async _persist(record) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch { /* IDB quota / no-op */ }
  }

  async _deleteRange(fromSeq, toSeq) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound(fromSeq, toSeq);
      await new Promise((res, rej) => {
        const r = store.delete(range);
        r.onsuccess = res; r.onerror = () => rej(r.error);
      });
    } catch {}
  }

  // Push a wire-ready frame (already includes the 4-byte BE header).
  async push(seq, frame) {
    const record = { seq, sessionId: this.sessionId, frame, ts: Date.now() };
    this.memory.set(seq, record);
    if (this.lowest == null || seq < this.lowest) this.lowest = seq;
    if (this.highest == null || seq > this.highest) this.highest = seq;
    await this._persist(record);
    // Evict from the head if we exceeded capacity.
    while (this.memory.size > this.capacity) {
      const oldest = this.memory.keys().next().value;
      this.memory.delete(oldest);
      this._deleteRange(oldest, oldest);
      if (oldest === this.lowest) this.lowest = oldest + 1;
    }
  }

  // Drop everything up to and including `seq` — backend's implicit ack.
  async evictThrough(seq) {
    if (seq <= this.lastAcked) return;
    this.lastAcked = seq;
    for (const k of Array.from(this.memory.keys())) {
      if (k <= seq) this.memory.delete(k);
    }
    if (this.lowest != null && this.lowest <= seq) this.lowest = seq + 1;
    await this._deleteRange(0, seq);
  }

  // Pull frames for retransmit_range. Returns frames in seq order, only those
  // still in the ring. Frames evicted past lastAcked are unrecoverable; caller
  // should treat that as a hard session-loss event.
  async range(fromSeq, toSeq) {
    const out = [];
    for (let s = fromSeq; s <= toSeq; s++) {
      const rec = this.memory.get(s);
      if (rec) out.push(rec);
    }
    return out;
  }

  size() { return this.memory.size; }
  bounds() { return { lowest: this.lowest, highest: this.highest, lastAcked: this.lastAcked }; }

  async clear() {
    this.memory.clear();
    this.lowest = null; this.highest = null; this.lastAcked = -1;
    if (this.db) {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    }
  }
}
