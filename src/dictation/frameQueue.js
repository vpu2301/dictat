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
//
// ── Sprint 16: the ring has to survive the session, not just the socket ──
//
// Two things were true of the v1 store, and neither mattered until session
// revocation (ADR-0040) made "your session ends mid-consultation" a designed
// event rather than an accident:
//
//  1. FRAMES WERE KEYED BY `seq` ALONE. Sequence numbers restart at 0 for
//     every session, so the first frame of the next recording silently
//     overwrote the first frame of the last one. A ring that another
//     recording can erase is not a guarantee. Keyed by [sessionId, seq] now.
//  2. `range()` READ ONLY THE IN-MEMORY MAP. Everything was written to
//     IndexedDB and nothing ever read it back, so the persisted copy could not
//     survive a reload — which is exactly the case it existed for. `load()`
//     hydrates it.
//
// The upgrade recreates the store, discarding whatever was in v1. That is the
// right trade: those frames belong to a session that no longer exists on the
// server, so they were never resumable; keeping them would only mean shipping
// a migration for data nobody can use.

const DB_NAME = "mdx-dictation";
const STORE_NAME = "frames";
export const DB_VERSION = 2;

// 20 ms × 9000 ≈ 3 min.
const DEFAULT_CAPACITY = 9000;

// A record needs a session before it can be keyed by one. `push()` should
// never run before start_session resolves (useConversationSession sets
// `ring.sessionId` between connect and capture), but a compound key with a
// null part is a thrown transaction rather than a lost frame, so there is a
// placeholder — and a way to re-file the frames once the real id lands.
const ORPHAN = "__pending__";

export function openDictationDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // v1 keyed frames by seq alone. There is no in-place keyPath change in
      // IndexedDB, so the store is replaced.
      if (ev.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ["sessionId", "seq"] });
        // Counting and deleting a whole session's frames without walking the
        // entire ring.
        store.createIndex("by_session", "sessionId", { unique: false });
      }
      // The recovery manifests (src/dictation/recovery.js) live in the same
      // database so that "the audio" and "what the audio was" cannot get out
      // of step — one upgrade, one transaction boundary, one delete.
      if (!db.objectStoreNames.contains("recordings")) {
        db.createObjectStore("recordings", { keyPath: "sessionId" });
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
    try { this.db = await openDictationDb(); } catch { this.db = null; }
  }

  _key() { return this.sessionId || ORPHAN; }

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
      const sid = this._key();
      const range = IDBKeyRange.bound([sid, fromSeq], [sid, toSeq]);
      await new Promise((res, rej) => {
        const r = store.delete(range);
        r.onsuccess = res; r.onerror = () => rej(r.error);
      });
    } catch {}
  }

  /**
   * Adopt the real session id once start_session answers, re-filing anything
   * that was written under the placeholder. Without this a frame pushed in the
   * window before the id arrives would be stranded under a key nothing reads.
   */
  async adoptSession(sessionId) {
    const previous = this._key();
    this.sessionId = sessionId;
    if (!this.db || previous === sessionId) return;
    try {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const rec of this.memory.values()) {
        store.delete([previous, rec.seq]);
        rec.sessionId = sessionId;
        store.put(rec);
      }
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch {}
  }

  // Push a wire-ready frame (already includes the 4-byte BE header).
  async push(seq, frame) {
    const record = { seq, sessionId: this._key(), frame, ts: Date.now() };
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

  /**
   * Hydrate the in-memory ring from IndexedDB for `sessionId` (sprint 16).
   *
   * This is what makes recovery-after-a-reload possible at all. Everything
   * else in this class writes to IDB and reads from memory, which is right on
   * the hot path and useless the moment the tab is gone — and a revoked
   * session takes the tab's state with it.
   *
   * Returns the number of frames loaded.
   */
  async load(sessionId) {
    if (!this.db) return 0;
    this.sessionId = sessionId;
    const records = await this._readSession(sessionId);
    this.memory.clear();
    this.lowest = null;
    this.highest = null;
    for (const rec of records) {
      this.memory.set(rec.seq, rec);
      if (this.lowest == null || rec.seq < this.lowest) this.lowest = rec.seq;
      if (this.highest == null || rec.seq > this.highest) this.highest = rec.seq;
    }
    // Everything on disk is by definition NOT yet acknowledged — acked frames
    // are deleted on the way past. So the watermark restarts below the floor.
    this.lastAcked = this.lowest == null ? -1 : this.lowest - 1;
    return this.memory.size;
  }

  async _readSession(sessionId) {
    if (!this.db) return [];
    try {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const idx = tx.objectStore(STORE_NAME).index("by_session");
      const out = await new Promise((res, rej) => {
        const r = idx.getAll(IDBKeyRange.only(sessionId));
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
      return out.sort((a, b) => a.seq - b.seq);
    } catch {
      return [];
    }
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
    if (this.db) await dropSessionFrames(this.db, this._key());
  }
}

/**
 * How many frames of `sessionId` are still on disk. The recovery surface uses
 * this to answer the only question that matters before offering to restore
 * something: is the audio actually still there?
 */
export async function countSessionFrames(db, sessionId) {
  if (!db) return 0;
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const idx = tx.objectStore(STORE_NAME).index("by_session");
    return await new Promise((res, rej) => {
      const r = idx.count(IDBKeyRange.only(sessionId));
      r.onsuccess = () => res(r.result || 0);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return 0;
  }
}

/** Delete every frame belonging to one session. */
export async function dropSessionFrames(db, sessionId) {
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("by_session");
    await new Promise((res, rej) => {
      const r = idx.openKeyCursor(IDBKeyRange.only(sessionId));
      r.onsuccess = () => {
        const cur = r.result;
        if (!cur) { res(); return; }
        store.delete(cur.primaryKey);
        cur.continue();
      };
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch {}
}
