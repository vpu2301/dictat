// Sprint 06 — TipTap-based section-aware editor
// Replaces contenteditable Editor in Studio. Handles:
//   · Section nodes (SectionExtension) — no bare paragraphs at root
//   · LowConfidenceMark — dotted underline on low-conf words
//   · Paste sanitization via DOMPurify
//   · Floating toolbar on text selection
//   · Find & Replace (Ctrl+F)
//   · Partial dictation text appended inline

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { TextSelection, Plugin } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { SectionExtension } from '../extensions/SectionExtension.js'
import { LowConfidenceMark } from '../extensions/LowConfidenceMark.js'
import { AutocompleteGhost, autocompleteGhostKey } from '../extensions/AutocompleteGhost.js'
import { GhostCompletion, ghostCompletionKey, GHOST_ACCEPT_EVENT } from '../extensions/GhostCompletion.js'
import { clipboardToInsertHTML } from '../paste/sanitizingPaste.js'
import { Icon } from './UI.jsx'
import { useI18n } from '../i18n.js'

// ── Convert body object ↔ TipTap JSON doc ─────────────────────────────────
// Extracted to reports/sectionDoc.js (Sprint 13) so it's unit-testable and
// carries the real field_type into the section node's `kind` attribute.
// Re-exported here because Studio and older code import them from this file.

import { bodyToDoc, docToBody } from '../reports/sectionDoc.js'
import { FieldWidgetsLayer } from '../reports/FieldWidgetsLayer.jsx'
import '../reports/renderers/register.js' // side effect: typed field renderers → dispatch
export { bodyToDoc, docToBody }

// ── Paste sanitizer extension ─────────────────────────────────────────────
// The report body is plain text organized into fixed template sections, so a
// paste must only ever contribute *text* — never document structure. This
// matters most for the in-editor "cut from one section, paste into another"
// move: ProseMirror's own HTML clipboard slice carries the source `section`
// wrapper (whose title renders a label), and its native paste would nest that
// whole section — label and all — into the target. We intercept inside
// ProseMirror's pipeline (handlePaste → return true short-circuits the default
// slice insertion, so there is no race with a separate DOM listener) and
// insert clean text: the `text/plain` flavor (ProseMirror's serialization of
// node *content* — labels are attributes/overlays, never content), falling
// back to sanitized-HTML text only for external pastes that carry no plain
// text. Newlines become hard breaks so a report's line-per-finding layout
// survives the move.

const SanitizingPaste = Extension.create({
  name: 'sanitizingPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const cd = event.clipboardData
            if (!cd) return false
            const plain = cd.getData('text/plain')
            const html = cd.getData('text/html')
            if (!plain && !html) return false // nothing we recognize — let PM handle it

            // Swallow the paste (return true) so ProseMirror never inserts its
            // native slice — which for an in-editor copy is the source section
            // wrapper, label and all. Insert only clean text.
            const body = clipboardToInsertHTML({ plain, html })
            if (body) editor.chain().focus().insertContent(body).run()
            return true
          },
        },
      }),
    ]
  },
})

// ── Floating toolbar ──────────────────────────────────────────────────────

function FloatingToolbar({ editor }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const { from, to, empty } = editor.state.selection
      if (empty) { setPos(null); return }

      const view = editor.view
      try {
        const start = view.coordsAtPos(from)
        const end   = view.coordsAtPos(to)
        const editorRect = view.dom.closest('.tiptap-wrapper')?.getBoundingClientRect() || view.dom.getBoundingClientRect()

        const mid  = (start.left + end.left) / 2 - editorRect.left
        const top  = start.top - editorRect.top - 44

        setPos({ left: Math.max(4, mid), top: Math.max(4, top) })
      } catch { setPos(null) }
    }

    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!pos || !editor) return null

  const btn = (action, icon, label, active) => (
    <button
      key={action}
      className={'ft-btn' + (active ? ' on' : '')}
      onMouseDown={e => { e.preventDefault(); editor.chain().focus()[action]().run() }}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon name={icon} size={13} />
    </button>
  )

  return (
    <div
      ref={ref}
      className="floating-toolbar"
      style={{ left: pos.left, top: pos.top }}
      role="toolbar"
      aria-label="Text formatting"
    >
      {btn('toggleBold',      'bold',      'Bold (Ctrl+B)',      editor.isActive('bold'))}
      {btn('toggleItalic',    'italic',    'Italic (Ctrl+I)',    editor.isActive('italic'))}
      {btn('toggleUnderline', 'underline', 'Underline (Ctrl+U)', editor.isActive('underline'))}
      <span className="ft-sep" />
      <button
        className={'ft-btn' + (editor.isActive('heading', { level: 2 }) ? ' on' : '')}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
        title="Heading 2"
      >H2</button>
      <button
        className={'ft-btn' + (editor.isActive('heading', { level: 3 }) ? ' on' : '')}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}
        title="Heading 3"
      >H3</button>
      <span className="ft-sep" />
      {btn('toggleBulletList',  'list',    'Bullet list',  editor.isActive('bulletList'))}
      {btn('toggleOrderedList', 'list',    'Ordered list', editor.isActive('orderedList'))}
    </div>
  )
}

// ── Find & Replace ────────────────────────────────────────────────────────

function FindReplace({ editor, onClose, lang }) {
  const [query,   setQuery]   = useState('')
  const [replace, setReplace] = useState('')
  const [matches, setMatches] = useState([])
  const [cur,     setCur]     = useState(0)

  const uk = lang === 'uk'

  const findAll = useCallback(() => {
    if (!editor || !query) { setMatches([]); return }
    const found = []
    const doc   = editor.state.doc
    const q     = query.toLowerCase()
    doc.descendants((node, pos) => {
      if (!node.isText) return
      const text = node.text.toLowerCase()
      let idx = 0
      while ((idx = text.indexOf(q, idx)) !== -1) {
        found.push({ from: pos + idx, to: pos + idx + query.length })
        idx += query.length
      }
    })
    setMatches(found)
    setCur(0)
    if (found[0]) editor.commands.setTextSelection(found[0])
  }, [editor, query])

  const replaceOne = () => {
    if (!matches[cur]) return
    const { from, to } = matches[cur]
    editor.chain().setTextSelection({ from, to }).insertContent(replace).run()
    findAll()
  }

  const replaceAll = () => {
    if (!matches.length) return
    // replace in reverse to preserve offsets
    const sorted = [...matches].sort((a, b) => b.from - a.from)
    let chain = editor.chain()
    sorted.forEach(({ from, to }) => {
      chain = chain.setTextSelection({ from, to }).insertContent(replace)
    })
    chain.run()
    setMatches([])
  }

  const nav = (dir) => {
    const n = (cur + dir + matches.length) % matches.length
    setCur(n)
    if (matches[n]) editor.commands.setTextSelection(matches[n])
  }

  return (
    <div className="find-replace" role="dialog" aria-label={uk ? 'Пошук і заміна' : 'Find & Replace'}>
      <div className="fr-row">
        <input
          className="ti fr-input"
          placeholder={uk ? 'Пошук…' : 'Find…'}
          value={query}
          onChange={e => { setQuery(e.target.value); setMatches([]) }}
          onKeyDown={e => { if (e.key === 'Enter') findAll() }}
          autoFocus
        />
        <button className="btn ghost sm" onClick={findAll}>{uk ? 'Знайти' : 'Find'}</button>
        <button className="btn ghost sm" onClick={() => nav(-1)} disabled={!matches.length}><Icon name="chevLeft" size={12} /></button>
        <button className="btn ghost sm" onClick={() => nav(1)}  disabled={!matches.length}><Icon name="chevRight" size={12} /></button>
        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {matches.length ? `${cur + 1}/${matches.length}` : '—'}
        </span>
        <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>
      <div className="fr-row">
        <input
          className="ti fr-input"
          placeholder={uk ? 'Замінити на…' : 'Replace with…'}
          value={replace}
          onChange={e => setReplace(e.target.value)}
        />
        <button className="btn ghost sm" onClick={replaceOne} disabled={!matches.length}>
          {uk ? 'Замінити' : 'Replace'}
        </button>
        <button className="btn ghost sm" onClick={replaceAll} disabled={!matches.length}>
          {uk ? 'Замінити все' : 'Replace all'}
        </button>
      </div>
    </div>
  )
}

// Keys that produce no input on their own. A ghost must survive them: pressing
// Shift is step one of typing a capital letter, not a rejection.
const BARE_MODIFIERS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock',
  'AltGraph', 'Fn', 'FnLock', 'Hyper', 'Super', 'Dead',
])

// ── Section header rendered above each section in the editor ──────────────
// (We render them outside the editor content as overlays; actual content goes in editor)

// ── Main TipTapEditor ─────────────────────────────────────────────────────

export function TipTapEditor({
  template,
  body,
  onBodyChange,
  activeId,
  onActiveSectionChange,
  partial,
  dictating,
  readOnly,
  lang,
  // Sprint 10 — autocomplete (single source of truth lives in Studio's
  // useSuggestions hook; the editor renders the ghost, owns the keyboard
  // protocol and performs the accept as ONE ProseMirror transaction).
  acSuggestions,          // suggestions array (may be empty)
  acActiveIndex,          // index the keyboard protocol acts on (default 0)
  acExplicit,             // true once ArrowDown armed explicit-selection mode
  acPrefix,               // the typed prefix the suggestions answer
  onAcAccept,             // (suggestion, index) → telemetry + state clear
  onAcDismiss,            // () → telemetry rejected + backoff
  onAcCycle,              // (nextIndex, explicit) → move activeIndex
  onAcCaretContext,       // (textBeforeCaret|null) → feeds the suggest hook
  acApiRef,               // ref → { accept, caretCoords } for pills (mousedown insert + anchor)
  acShowGhost = true,     // Layer A toggle (keyboard protocol stays active)
  acListboxOpen = false,  // pills popup rendered → manage aria-activedescendant
  // Sprint 15 — Layer C generated ghost text. Armed only while Layer A is
  // silent (Studio gates the hook that way), so the caret never carries two
  // ghosts. Tab is the ONLY keyboard path in; every other key falls through to
  // the document untouched.
  lcGhost,                // { text, requestId } | null
  lcTouch = false,        // render the inline "↹" accept chip (no Tab on touch)
  lcAcceptLabel,          // aria-label for that chip
  onLcAccept,             // (text) → telemetry `accepted` + state clear
  onLcDismiss,            // (reason) → telemetry `rejected` + state clear
  patientRef,             // optional patient identifier shown in the report meta
  // Sprint 13 — typed field widgets. sectionMeta is the Studio's
  // { [section_key]: { icd10?, field_specific_metadata? } } map; changes go
  // back up via onSectionMetaChange (marks the draft dirty → autosave PUT).
  sectionMeta,
  onSectionMetaChange,
}) {
  const { t } = useI18n()
  const [showFR,  setShowFR]  = useState(false)
  const bodyRef               = useRef(body)
  const templateRef           = useRef(template)

  bodyRef.current     = body
  templateRef.current = template

  // Autocomplete state snapshot for editorProps callbacks (they close over
  // the first render otherwise).
  const acRef = useRef({})
  acRef.current = {
    suggestions: acSuggestions || [],
    activeIndex: acActiveIndex || 0,
    explicit: !!acExplicit,
    prefix: acPrefix || '',
    onAccept: onAcAccept,
    onDismiss: onAcDismiss,
    onCycle: onAcCycle,
  }
  // Same snapshot trick for Layer C — editorProps callbacks close over the
  // first render otherwise.
  const lcRef = useRef({})
  lcRef.current = {
    ghost: lcGhost || null,
    onAccept: onLcAccept,
    onDismiss: onLcDismiss,
  }
  const composingRef = useRef(false)
  const caretCbRef = useRef(onAcCaretContext)
  caretCbRef.current = onAcCaretContext
  // Set while we move the caret programmatically (setContent / re-anchor after
  // an external body change, rail-nav). onSelectionUpdate must NOT feed such
  // mechanical caret moves back into `activeId` — otherwise setContent's
  // map-to-doc-end silently retargets dictation to the last section.
  const suppressActiveSyncRef = useRef(false)

  // Report the text between the start of the current block and the caret —
  // the ONLY thing the suggest hook needs. Null when composing, selecting a
  // range, or outside a text block.
  const reportCaretContext = useCallback((e) => {
    const cb = caretCbRef.current
    if (!cb) return
    if (composingRef.current) { cb(null); return }
    try {
      const sel = e.state.selection
      if (!sel.empty || !sel.$anchor.parent.isTextblock) { cb(null); return }
      const $a = sel.$anchor
      cb($a.parent.textBetween(0, $a.parentOffset, '\n', '￼'))
    } catch {
      cb(null)
    }
  }, [])

  // Editor ref for callbacks defined before useEditor returns.
  const editorRef = useRef(null)

  // Accept = ONE ProseMirror transaction (insert + caret) → one undo step.
  // Phrase: insert `completion` at the caret (typed prefix stays).
  // Snippet: replace the typed "/trigger" token with `text`, caret lands at
  // cursor_offset (or the end of the insert).
  const acceptSuggestion = useCallback((s, index) => {
    const e = editorRef.current
    if (!e || !s) return
    const sel = e.state.selection
    if (!sel.empty) return
    const caret = sel.from
    const ac = acRef.current
    e.chain()
      .focus()
      .command(({ tr, state: st }) => {
        // One transaction in its OWN undo group: a single undo reverts the
        // whole accept and nothing else (typing just before would otherwise
        // merge into the same history event within newGroupDelay).
        closeHistory(tr)
        if (s.kind === 'snippet') {
          const trigLen = Math.min(ac.prefix.length, caret - 1)
          const from = Math.max(1, caret - trigLen)
          tr.insertText(s.text, from, caret)
          const target = Math.min(
            from + (s.cursor_offset ?? s.text.length),
            tr.doc.content.size - 1,
          )
          tr.setSelection(TextSelection.create(tr.doc, target))
        } else {
          const completion = s.completion || ''
          if (!completion) return false
          tr.insertText(completion, caret, caret)
        }
        return true
      })
      .run()
    ac.onAccept?.(s, index)
  }, [])

  // Layer C accept — the ONLY way generated text enters the record. One
  // transaction in its own undo group, exactly like a Layer A phrase accept:
  // after the accept it is the clinician's text, so it must behave like text
  // they typed (one undo takes it out, and nothing marks it as machine-made).
  const acceptGhostCompletion = useCallback(() => {
    const e = editorRef.current
    const lc = lcRef.current
    const text = lc.ghost?.text
    if (!e || !text) return
    const sel = e.state.selection
    if (!sel.empty) return
    const caret = sel.from
    e.chain()
      .focus()
      .command(({ tr }) => {
        closeHistory(tr)
        tr.insertText(text, caret, caret)
        return true
      })
      .run()
    lc.onAccept?.(text)
  }, [])

  // Layer C keyboard law. Reached only when Layer A has nothing to say.
  //
  //   Tab            → accept (the single entry point; consumed)
  //   Escape         → dismiss (consumed — Escape means "go away")
  //   bare modifier  → ignored; Shift is how you type a capital letter, and
  //                    killing the ghost on Shift-down would delete it half a
  //                    keystroke before the letter that was going to arrive
  //   anything else  → dismiss AND fall through (return false), so the
  //                    keystroke lands in the document exactly as if no ghost
  //                    had ever been there. Swallowing input to "handle" a
  //                    dismissal is the one bug this feature cannot ship with.
  const handleLcKeyDown = useCallback((event) => {
    const lc = lcRef.current
    if (!lc.ghost) return false
    if (BARE_MODIFIERS.has(event.key)) return false
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      acceptGhostCompletion()
      return true
    }
    if (event.key === 'Escape') {
      lc.onDismiss?.('key')
      return true
    }
    lc.onDismiss?.('input')
    return false
  }, [acceptGhostCompletion])

  // Keyboard protocol (§4.3) — registered at the EDITOR level, consuming a
  // key (return true) ONLY when suggestions are visible and the key acts on
  // them. Tab precedence: suggestions visible → accept; otherwise the
  // editor's default behavior (there is no section-Tab binding — see
  // SectionExtension, which only guards Backspace).
  const handleAcKeyDown = useCallback((view, event) => {
    const ac = acRef.current
    const n = ac.suggestions.length
    if (!n) return handleLcKeyDown(event)
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      acceptSuggestion(ac.suggestions[ac.activeIndex] || ac.suggestions[0], ac.activeIndex)
      return true
    }
    if (event.key === 'Escape') {
      ac.onDismiss?.()
      return true
    }
    if (event.key === 'ArrowDown') {
      ac.onCycle?.((ac.activeIndex + 1) % n, true)
      return true
    }
    if (event.key === 'ArrowUp') {
      if (!ac.explicit) return false // don't hijack caret movement unarmed
      ac.onCycle?.((ac.activeIndex - 1 + n) % n, true)
      return true
    }
    if (event.key === 'Enter') {
      // Enter accepts ONLY in explicit-selection mode (ArrowDown armed it);
      // plain ghost state → Enter stays a newline. Typing flow first.
      if (ac.explicit) {
        acceptSuggestion(ac.suggestions[ac.activeIndex], ac.activeIndex)
        return true
      }
      return false
    }
    if (event.altKey && ['1', '2', '3'].includes(event.key)) {
      const idx = parseInt(event.key, 10) - 1
      if (ac.suggestions[idx]) {
        acceptSuggestion(ac.suggestions[idx], idx)
        return true
      }
    }
    return false
  }, [acceptSuggestion, handleLcKeyDown])

  const editor = useEditor({
    // CSP (sprint 16). @tiptap/core's default is to build a <style> element at
    // runtime and set its innerHTML (utilities/createStyleTag.ts) — an inline
    // stylesheet, and the ONE thing in this app that would have forced
    // `style-src 'unsafe-inline'` into the policy. TipTap offers a nonce
    // instead; a nonce means threading a per-response value from the server
    // into a React component, and the app is served as static files with no
    // server to mint one. The stylesheet is thirty lines of ProseMirror
    // plumbing that never changes, so the honest fix is to ship it as CSS:
    // src/prosemirror.css holds it verbatim, imported by main.jsx.
    //
    // If a TipTap upgrade changes that stylesheet, the editor's caret and
    // whitespace handling break visibly and e2e/typed-fields.spec.js fails —
    // it is not a silent divergence.
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading:    { levels: [2, 3] },
        // Disable extensions we don't need
        blockquote:      false,
        codeBlock:       false,
        horizontalRule:  false,
        strike:          false,
        code:            false,
      }),
      Underline,
      SectionExtension,
      LowConfidenceMark,
      AutocompleteGhost,
      GhostCompletion,
      SanitizingPaste,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'paragraph') {
            return lang === 'uk'
              ? 'Диктуйте або вводьте тут…'
              : 'Dictate or type here…'
          }
          return ''
        },
      }),
    ],
    content: bodyToDoc(template, body, lang),
    editable: !readOnly,
    editorProps: {
      handleKeyDown: (view, event) => handleAcKeyDown(view, event),
    },
    onUpdate: ({ editor: e }) => {
      const next = docToBody(e.state.doc)
      onBodyChange?.(next)
      reportCaretContext(e)
    },
    onSelectionUpdate: ({ editor: e }) => {
      // Only a USER caret move should change which section dictation targets.
      // Programmatic moves (setContent re-anchor, rail-nav) set the guard so
      // they can't retarget `activeId` (e.g. to the doc-end/last section).
      if (!suppressActiveSyncRef.current) {
        const { $anchor } = e.state.selection
        // Walk up to find closest section node
        for (let d = $anchor.depth; d >= 0; d--) {
          const n = $anchor.node(d)
          if (n?.type.name === 'section') {
            onActiveSectionChange?.(n.attrs.id)
            break
          }
        }
      }
      reportCaretContext(e)
    },
    onBlur: () => {
      // Layer C dies on blur with its own reason — losing focus is not the
      // clinician typing through the ghost, and the telemetry must not
      // pretend it was.
      lcRef.current.onDismiss?.('blur')
      caretCbRef.current?.(null)
    },
  })

  editorRef.current = editor

  // Expose the accept mechanic + caret viewport coords to the pills
  // (mousedown accept path; popup anchored under the caret).
  const caretCoords = useCallback(() => {
    const e = editorRef.current
    try {
      if (!e || e.isDestroyed || !e.state.selection.empty) return null
      return e.view.coordsAtPos(e.state.selection.from)
    } catch {
      return null
    }
  }, [])
  useEffect(() => {
    if (acApiRef) acApiRef.current = { accept: acceptSuggestion, caretCoords }
  }, [acApiRef, acceptSuggestion, caretCoords])

  // Arm / clear the inline ghost decoration. The plugin clears itself on
  // ANY doc/selection change (stale ghosts never survive a keystroke);
  // this effect re-arms once the suggestion hook settles. Meta-only
  // transactions: no doc change, no history entry, no onUpdate loop.
  useEffect(() => {
    const e = editorRef.current
    if (!e || e.isDestroyed) return
    const s = acShowGhost && acSuggestions?.length
      ? (acSuggestions[acActiveIndex || 0] || acSuggestions[0])
      : null
    const text = s ? (s.kind === 'snippet' ? s.text : s.completion) : null
    const prev = autocompleteGhostKey.getState(e.state)
    if (!text && !prev) return // feature off / nothing armed → zero work
    if (text && prev && prev.text === text) return
    const tr = e.state.tr.setMeta(autocompleteGhostKey, text ? { text } : null)
    tr.setMeta('addToHistory', false)
    e.view.dispatch(tr)
  }, [acSuggestions, acActiveIndex, acShowGhost, editor])

  // The touch chip lives inside the widget decoration and cannot hold a live
  // callback (decorations are rebuilt on every transaction, so a captured
  // handler would accept the wrong text). It dispatches a bubbling custom
  // event instead; this is where it lands.
  useEffect(() => {
    const dom = editor?.view?.dom
    if (!dom) return undefined
    const onAccept = () => acceptGhostCompletion()
    dom.addEventListener(GHOST_ACCEPT_EVENT, onAccept)
    return () => dom.removeEventListener(GHOST_ACCEPT_EVENT, onAccept)
  }, [editor, acceptGhostCompletion])

  // Arm / clear the Layer C ghost. Same meta protocol and same zero-work
  // guard as Layer A: when nothing is armed and nothing was armed, this
  // effect dispatches nothing at all.
  useEffect(() => {
    const e = editorRef.current
    if (!e || e.isDestroyed) return
    const text = lcGhost?.text || null
    const prev = ghostCompletionKey.getState(e.state)
    if (!text && !prev) return
    if (text && prev && prev.text === text && prev.touch === lcTouch) return
    const tr = e.state.tr.setMeta(
      ghostCompletionKey,
      text ? { text, touch: !!lcTouch, acceptLabel: lcAcceptLabel } : null,
    )
    tr.setMeta('addToHistory', false)
    e.view.dispatch(tr)
  }, [lcGhost, lcTouch, lcAcceptLabel, editor])

  // §7 accessibility: the ghost is aria-hidden; screen readers follow the
  // popup listbox via aria-activedescendant on the editor's element.
  useEffect(() => {
    const dom = editor?.view?.dom
    if (!dom) return
    if (acListboxOpen) {
      dom.setAttribute('aria-controls', 'autocomplete-listbox')
      dom.setAttribute('aria-activedescendant', `autocomplete-option-${acActiveIndex || 0}`)
    } else {
      dom.removeAttribute('aria-controls')
      dom.removeAttribute('aria-activedescendant')
    }
  }, [editor, acListboxOpen, acActiveIndex])

  // IME composition guard: never query mid-composition (uk keyboards are
  // fine, but dead-key/IME input must not see half-composed tokens).
  useEffect(() => {
    const dom = editor?.view?.dom
    if (!dom) return
    const start = () => { composingRef.current = true; caretCbRef.current?.(null) }
    const end = () => {
      composingRef.current = false
      if (editorRef.current) reportCaretContext(editorRef.current)
    }
    dom.addEventListener('compositionstart', start)
    dom.addEventListener('compositionend', end)
    return () => {
      dom.removeEventListener('compositionstart', start)
      dom.removeEventListener('compositionend', end)
    }
  }, [editor, reportCaretContext])

  // Keyboard shortcuts: Ctrl+F for find. (Autocomplete keys are handled at
  // the editor level in handleAcKeyDown — never globally.)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowFR(s => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Navigate to active section when activeId changes externally
  useEffect(() => {
    if (!editor || !activeId) return
    suppressActiveSyncRef.current = true
    try {
      editor.state.doc.forEach((node, pos) => {
        if (node.type.name === 'section' && node.attrs.id === activeId) {
          const firstChild = node.firstChild
          if (firstChild) {
            const targetPos = pos + 1 // inside the section node
            try {
              editor.chain().setTextSelection(targetPos).scrollIntoView().run()
            } catch {}
          }
        }
      })
    } finally {
      suppressActiveSyncRef.current = false
    }
  // Only trigger on explicit activeId changes from outside (e.g. rail click)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Reset editor content when template changes
  useEffect(() => {
    if (!editor) return
    const newDoc = bodyToDoc(template, body, lang)
    editor.commands.setContent(newDoc, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id])

  // Mark the active section in the DOM so the user always sees which section
  // dictation lands in — independent of editor focus (the mic may have focus).
  useEffect(() => {
    if (!editor?.view?.dom) return
    const nodes = editor.view.dom.querySelectorAll('section.tiptap-section')
    nodes.forEach(el => {
      el.classList.toggle('is-active', el.getAttribute('data-section-id') === activeId)
    })
  }, [editor, activeId, body, template])

  // Sync external `body` mutations (e.g. dictation appends) into the editor.
  // Without this, the ProseMirror document only ever reflected its own edits,
  // so dictated text never appeared on screen even though `body` (and the word
  // count derived from it) updated. Guard against the onUpdate round-trip by
  // comparing the editor's current serialized body to the incoming body and
  // only re-rendering on a real divergence — otherwise this loops.
  useEffect(() => {
    if (!editor) return
    const tmpl = templateRef.current
    if (!tmpl?.sections) return
    const editorBody = docToBody(editor.state.doc)
    const same = tmpl.sections.every(
      s => (editorBody[s.id] || '') === (body[s.id] || '')
    )
    if (same) return
    // Only EXTERNAL body changes reach here — the editor's own edits are caught
    // by `same` above. An external change is a dictation append / voice op /
    // draft hydration, and its insertion point is always the END of the ACTIVE
    // section (voice always appends to body[activeId]). Re-anchor there and
    // NEVER fall back to the doc end: setContent maps the old selection to the
    // last section, and clamping to size-1 lands there too — either way the
    // selection→activeId feedback would retarget dictation to the last section.
    suppressActiveSyncRef.current = true
    try {
      const prevTo = editor.state.selection.to
      const newDoc = bodyToDoc(tmpl, body, lang)
      editor.commands.setContent(newDoc, false) // false = don't re-emit onUpdate
      let target = null
      if (activeId) {
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name === 'section' && node.attrs.id === activeId) {
            target = pos + node.nodeSize - 2 // end of the section's last block
          }
        })
      }
      const size = editor.state.doc.content.size
      // Prefer the active section's end; only if it can't be located, keep the
      // caret roughly where it was (still clamped INTO the doc, not at its end).
      const pos = target != null ? target : prevTo
      editor.chain().setTextSelection(Math.max(1, Math.min(pos, size - 1)))
        .scrollIntoView().run()
    } catch {}
    finally {
      suppressActiveSyncRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, editor, activeId])

  // Navigate to a section by title (voice nav)
  const navigateToSection = useCallback((titleQuery) => {
    if (!editor || !titleQuery) return false
    const q = titleQuery.toLowerCase()
    let matches = []
    editor.state.doc.forEach((node, pos) => {
      if (node.type.name === 'section') {
        const t = (node.attrs.title || '').toLowerCase()
        if (t.includes(q)) matches.push({ pos, title: node.attrs.title, id: node.attrs.id })
      }
    })
    if (matches.length === 1) {
      editor.chain().setTextSelection(matches[0].pos + 1).scrollIntoView().focus().run()
      onActiveSectionChange?.(matches[0].id)
      return true
    }
    return matches // return array for quick-pick
  }, [editor, onActiveSectionChange])

  // Expose navigateToSection via ref so parent (Studio) can call it
  useEffect(() => {
    if (editor) editor._navigateToSection = navigateToSection
  }, [editor, navigateToSection])

  const sectionHeaders = template?.sections || []

  return (
    <div className={"tiptap-wrapper" + (dictating ? " dictating" : "")}>
      {showFR && (
        <FindReplace editor={editor} onClose={() => setShowFR(false)} lang={lang} />
      )}
      <FloatingToolbar editor={editor} />
      <div className="editor-scroll">
        <div className="editor tiptap-doc">
          <h1 className="report-title">{template?.name?.[lang] || template?.name?.en || ''}</h1>
          <div className="report-meta">
            <span>{template?.code}</span>
            {patientRef && <><span>·</span><span className="mono">{patientRef}</span></>}
          </div>

          {/* Section headings rendered as overlays in the editor scroll */}
          <div className="tiptap-sections-labels">
            {sectionHeaders.map(s => (
              <div key={s.id} className="tiptap-sec-label" data-section-id={s.id}>
                <span>{s.name?.[lang] || s.name?.en}</span>
                {s.required && <span className="req-tag">{lang === 'uk' ? 'Обов\'язково' : 'Required'}</span>}
              </div>
            ))}
          </div>

          <EditorContent editor={editor} className="tiptap-content" />
          {/* Sprint 13 — typed field widgets, portaled into their section's
              DOM. free_text sections are untouched by construction. */}
          <FieldWidgetsLayer
            editor={editor}
            template={template}
            sectionMeta={sectionMeta}
            onSectionMetaChange={onSectionMetaChange}
            lang={lang}
            readOnly={readOnly}
          />
          {/* Ghost text (Layer A) renders INSIDE the document as a widget
              decoration at the caret — see extensions/AutocompleteGhost.js. */}
        </div>
      </div>
    </div>
  )
}
