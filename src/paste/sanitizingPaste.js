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
