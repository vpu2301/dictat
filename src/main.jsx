import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RootGate } from './auth/RootGate.jsx'
import './styles.css'
// @tiptap/core's base stylesheet, which we ship instead of letting it inject a
// <style> element at runtime (see TipTapEditor.jsx `injectCSS: false`).
import './prosemirror.css'
import './scribe.css'
import './app-extra.css'
import './sprints-06-10.css'
import './sprints-11-15.css'
import './sprints-16.css'
import './sprints-17.css'
import './sprints-18.css'
import './admin/admin-templates.css'
import './admin/admin-content.css'
import './dashboard.css'
import './studio/studio.css'
import './company/company.css'
// Public-site motion. Last, so its `.lp`-scoped rules win by source order over
// the static marketing styles in app-extra.css.
import './marketing-motion.css'

// Path → hash bridge. The SPA is hash-routed, but the owner console is shared
// as a plain URL (localhost:5173/company). Vite's SPA fallback serves index.html
// for that path, which would otherwise boot at the empty hash and land on "/".
// Rewrite it to the hash form before React mounts. Deliberately narrow — only
// /company and its sub-tabs — so no other path's behaviour changes.
if (typeof location !== 'undefined' && !location.hash && /^\/company(\/.*)?\/?$/.test(location.pathname)) {
  const target = location.pathname.replace(/\/$/, '') + location.search
  history.replaceState(null, '', '/')
  location.hash = target
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RootGate>
        <App />
      </RootGate>
    </AuthProvider>
  </React.StrictMode>,
)
