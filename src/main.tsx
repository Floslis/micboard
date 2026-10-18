import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { boot } from './lib/api'

const wurzel = createRoot(document.getElementById('root')!)

// Erst den Stand vom Server holen (Ersteinrichtung? Demo?), dann zeichnen
boot().then(() => wurzel.render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)).catch((e) => {
  document.getElementById('root')!.innerHTML =
    '<div style="font:16px system-ui;color:#fff;background:#0f1117;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px">' +
    '<div><p style="font-size:20px;margin:0 0 8px">MicBoard erreicht seinen Server nicht.</p>' +
    '<p style="opacity:.6;margin:0">' + String(e && e.message || e) + '</p></div></div>'
})
