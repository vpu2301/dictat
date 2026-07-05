// ephemeralSecret.js — request-lifetime holder for signing key material.
//
// The КНЕДП key container and its password must exist in memory only for the
// duration of the /sign request: never persisted, never logged, cleared the
// moment the dialog closes. Components keep credentials in ONE of these
// holders (inside a ref, outside React state) so nothing lands in a store,
// re-renders, or devtools state snapshots — and so tests can assert the
// material is actually gone after close.

export class EphemeralSecret {
  #container = null; // Uint8Array of the key-container bytes
  #password = null;  // string

  setContainer(bytes) {
    this.#container = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }

  setPassword(pw) {
    this.#password = pw == null ? null : String(pw);
  }

  hasContainer() { return this.#container != null && this.#container.length > 0; }
  hasPassword()  { return this.#password != null && this.#password.length > 0; }

  containerByteLength() { return this.#container ? this.#container.length : 0; }

  // Base64 of the container, produced on demand for the request body — the
  // encoded copy is the caller's to drop with the request.
  containerBase64() {
    if (!this.#container) return null;
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < this.#container.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, this.#container.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  password() { return this.#password; }

  // Zero the container bytes in place, then drop every reference. JS strings
  // are immutable so the password can only be dereferenced — but after
  // clear() this holder retains nothing reachable.
  clear() {
    if (this.#container) this.#container.fill(0);
    this.#container = null;
    this.#password = null;
  }

  isCleared() { return this.#container == null && this.#password == null; }
}
