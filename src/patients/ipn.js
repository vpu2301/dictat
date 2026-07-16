// ipn.js — ІПН (РНОКПП) client-side normalization + checksum.
//
// Mirrors the backend's libs/crypto ipn.py exactly (same separators regex,
// same public control-digit weights) so the local check makes the server's
// 422 `ipn_invalid` unreachable in practice — both stay, the server is the
// authority. Test vectors are shared with the backend suite.
//
// The raw ІПН is PII of the highest sensitivity: it may go on the wire only
// as the `ipn` create/update field or an exact-lookup `query=` — never into
// URLs, storage, telemetry, or error messages.

const SEPARATORS = /[\s-]/g;

// Public РНОКПП control-digit weights for digits 1–9; the control digit is
// (Σ wᵢ·dᵢ mod 11) mod 10 and must equal digit 10.
const WEIGHTS = [-1, 5, 7, 9, 4, 6, 10, 5, 7];

// Strip spaces/dashes only — what a receptionist pastes from a document.
export function stripIpnSeparators(raw) {
  return String(raw ?? "").replace(SEPARATORS, "");
}

// Canonicalize + validate. Returns:
//   { ok: true,  ipn }                      — 10 digits, checksum good
//   { ok: false, reason: "shape" }          — not 10 ASCII digits
//   { ok: false, reason: "checksum" }       — right shape, wrong control
//                                             digit (a typo — say so)
export function checkIpn(raw) {
  const candidate = stripIpnSeparators(raw);
  if (!/^\d{10}$/.test(candidate)) return { ok: false, reason: "shape" };
  const digits = candidate.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += WEIGHTS[i] * digits[i];
  // JS % keeps the sign of the dividend; the weights make negative sums
  // possible only for degenerate inputs, but normalize anyway.
  const control = (((sum % 11) + 11) % 11) % 10;
  if (control !== digits[9]) return { ok: false, reason: "checksum" };
  return { ok: true, ipn: candidate };
}
