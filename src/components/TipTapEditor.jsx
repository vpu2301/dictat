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
import { SectionExtension } from '../extensions/SectionExtension.js'
import { LowConfidenceMark } from '../extensions/LowConfidenceMark.js'
import { sanitizePastedHTML } from '../paste/sanitizingPaste.js'
import { Icon } from './UI.jsx'
import { useI18n } from '../i18n.js'

// ── Convert body object ↔ TipTap JSON doc ─────────────────────────────────

export function bodyToDoc(template, body) {
  return {
    type: 'doc',
    content: template.sections.map(s => ({
      type: 'section',
      attrs: { id: s.id, title: s.name?.en || s.id, kind: 'free_text', required: !!s.required },
      content: [{
        type: 'paragraph',
        content: body[s.id]
          ? [{ type: 'text', text: body[s.id] }]
          : [],
      }],
    })),
  }
}

export function docToBody(doc) {
  const body = {}
  doc.forEach(node => {
    if (node.type.name === 'section') {
      body[node.attrs.id] = node.textContent
    }
  })
  return body
}

// ── Paste sanitizer extension ─────────────────────────────────────────────

const SanitizingPaste = Extension.create({
  name: 'sanitizingPaste',
  addProseMirrorPlugins() {
    return []
  },
  // Hook into the editor's event handling
  onCreate() {
    const { view } = this.editor
    const handler = (ev) => {
      const html = ev.clipboardData?.getData('text/html')
      if (!html) return // let plain-text paste through normally

      ev.preventDefault()
      const clean = sanitizePastedHTML(html)
      const div = document.createElement('div')
      div.innerHTML = clean
      const text = div.textContent || div.innerText || ''
      if (text) {
        this.editor.chain().focus().insertContent(text).run()
      }
    }
    view.dom.addEventListener('paste', handler)
    this._pasteHandler = handler
  },
  onDestroy() {
    if (this._pasteHandler && this.editor.view?.dom) {
      this.editor.view.dom.removeEventListener('paste', this._pasteHandler)
    }
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
  readOnly,
  lang,
  autocompleteGhost,      // Sprint 10 ghost text string | null
  onAutocompleteAccept,   // Sprint 10 callback
  onAutocompleteDismiss,  // Sprint 10 callback
  patientRef,             // optional patient identifier shown in the report meta
}) {
  const { t } = useI18n()
  const [showFR,  setShowFR]  = useState(false)
  const bodyRef               = useRef(body)
  const templateRef           = useRef(template)

  bodyRef.current     = body
  templateRef.current = template

  const editor = useEditor({
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
    content: bodyToDoc(template, body),
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      const next = docToBody(e.state.doc)
      onBodyChange?.(next)
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { $anchor } = e.state.selection
      // Walk up to find closest section node
      for (let d = $anchor.depth; d >= 0; d--) {
        const n = $anchor.node(d)
        if (n?.type.name === 'section') {
          onActiveSectionChange?.(n.attrs.id)
          break
        }
      }
    },
  })

  // Keyboard shortcuts: Ctrl+F for find
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowFR(s => !s)
      }
      // Sprint 10: Tab accepts ghost, Esc dismisses
      if (autocompleteGhost && e.key === 'Tab') {
        e.preventDefault()
        onAutocompleteAccept?.()
      }
      if (autocompleteGhost && e.key === 'Escape') {
        onAutocompleteDismiss?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [autocompleteGhost, onAutocompleteAccept, onAutocompleteDismiss])

  // Navigate to active section when activeId changes externally
  useEffect(() => {
    if (!editor || !activeId) return
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
  // Only trigger on explicit activeId changes from outside (e.g. rail click)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Reset editor content when template changes
  useEffect(() => {
    if (!editor) return
    const newDoc = bodyToDoc(template, body)
    editor.commands.setContent(newDoc, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id])

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
    <div className="tiptap-wrapper">
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

          {/* Ghost text overlay for autocomplete (Layer A) */}
          {autocompleteGhost && (
            <div className="autocomplete-ghost-hint" aria-live="polite">
              <span className="autocomplete-ghost-text">{autocompleteGhost}</span>
              <span className="autocomplete-ghost-key">Tab</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
