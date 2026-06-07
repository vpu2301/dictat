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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RootGate>
        <App />
      </RootGate>
    </AuthProvider>
  </React.StrictMode>,
)
