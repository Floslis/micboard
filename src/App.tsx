import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isConfigured } from './lib/config'
import { useAuth } from './hooks/useAuth'
import LoginPage   from './pages/LoginPage'
import AdminPage   from './pages/AdminPage'
import DisplayPage from './pages/DisplayPage'

// ── Protected admin route ────────────────────────────────────

function AdminRoute() {
  const { isAuthenticated } = useAuth()
  if (!isConfigured()) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AdminPage />
}

// ── App root ─────────────────────────────────────────────────
// HashRouter: der Server kennt nur index.html, alles Weitere passiert
// hinter dem #. So läuft die App in jedem Ordner, auf jedem Webspace.

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Setup wizard */}
        <Route path="/setup" element={<LoginPage />} />

        {/* Login page */}
        <Route path="/login" element={<LoginPage />} />

        {/* Display pages – publicly accessible, no auth */}
        <Route path="/display/:displayId" element={<DisplayPage />} />

        {/* Admin panel – protected */}
        <Route path="/admin" element={<AdminRoute />} />

        {/* Default redirect */}
        <Route
          path="/"
          element={
            isConfigured()
              ? <Navigate to="/admin" replace />
              : <Navigate to="/setup" replace />
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
