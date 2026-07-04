// check-prod-bundle.mjs — sprint 09 VERIFY, revised for the S09 follow-up.
//
// POLICY CHANGE: the account-password signing path (wire provider
// "dev_password", src/components/signing/AccountPasswordSign.jsx) is now a
// first-class option that intentionally ships in ALL builds — it is offered
// whenever the backend advertises the provider on /readyz, and its artifacts
// always render the non-qualified badge.
//
// What this check still guards: the old DEV-BUILD-ONLY scaffold
// (DevPasswordSign.jsx and its "DEV signing" copy) must not be reintroduced —
// if a password path exists it must be the honest first-class one, not a
// dev scaffold leaking into production.
//
// Run after `vite build` (npm run verify:prod-bundle).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = new URL('../dist', import.meta.url).pathname

// Markers that lived ONLY in the retired dev-only scaffold.
const FORBIDDEN = [
  'DevPasswordSign',     // retired module / component name
  'DEV signing',         // retired dev-scaffold notice copy
  'dev-password-sign',   // retired test ids
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`✗ dist/ not found — run \`npm run build\` first (or use npm run verify:prod-bundle)`)
  process.exit(2)
}

const violations = []
for (const file of files) {
  const content = readFileSync(file, 'latin1') // byte-safe for all asset types
  for (const marker of FORBIDDEN) {
    if (content.includes(marker)) violations.push({ file: file.slice(DIST.length + 1), marker })
  }
}

// A DevPasswordSign chunk must not even be emitted as a file.
for (const file of files) {
  if (/DevPasswordSign/i.test(file)) violations.push({ file: file.slice(DIST.length + 1), marker: '(chunk emitted)' })
}

if (violations.length) {
  console.error('✗ the retired dev-password scaffold leaked into the production bundle:')
  for (const v of violations) console.error(`  ${v.file}: contains ${JSON.stringify(v.marker)}`)
  process.exit(1)
}

console.log(`✓ production bundle clean: ${files.length} asset(s) scanned, no retired dev-scaffold markers`)
console.log(`  checked: ${FORBIDDEN.join(', ')}`)
console.log(`  note: the account-password path (provider "dev_password") ships intentionally`)
