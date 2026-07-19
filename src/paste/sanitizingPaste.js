// Sprint 06 — Paste sanitizer (XSS defense; allowlist-only)
// Never use innerHTML for untrusted input — use DOMPurify.
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'br', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'u', 'span', 'b', 'i']
const ALLOWED_ATTR = ['class', 'data-section-id', 'data-confidence']

export function sanitizePastedHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Explicitly strip these — Word pastes them constantly
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style', 'link', 'meta', 'noscript', 'xml'],
    FORBID_ATTR: ['style', 'class', 'id', 'onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  })
}

// Strip all tags; return plain text only
export function pastedTextOnly(html) {
  const div = document.createElement('div')
  div.innerHTML = sanitizePastedHTML(html)
  return div.textContent || div.innerText || ''
}

export function escapeHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Turn a paste's clipboard flavors into the HTML string we insert into the
// section editor. The report body is plain text in fixed template sections, so
// a paste must only contribute text — never document structure. Crucially we
// prefer the `text/plain` flavor: the `text/html` flavor of an in-editor
// cross-section copy carries the source section wrapper (whose title renders a
// label), and letting that through nests a whole labeled section into the
// target. text/plain is ProseMirror's serialization of node *content* (labels
// are attributes/overlays, never content) — the clean text we want. Only
// external pastes with no plain-text flavor fall back to sanitized-HTML text.
// Newlines become <br> so a report's line-per-finding layout survives the move.
// (The html-fallback branch needs a DOM; the plain-text path is DOM-free.)
export function clipboardToInsertHTML({ plain, html } = {}) {
  let text = plain
  if (!text && html) text = pastedTextOnly(html)
  if (!text) return ''
  const norm = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n')
  return norm.split('\n').map(escapeHTML).join('<br>')
}
