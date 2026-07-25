import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RootGate } from './auth/RootGate.jsx'
import './styles.css'
import './scribe.css'
import './app-extra.css'
import './sprints-06-10.css'
import './sprints-11-15.css'
import './dashboard.css'
import './company/company.css'

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
