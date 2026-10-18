import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mic } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { needsSetup, isDemo } from '../lib/api'

export default function LoginPage() {
  const { login, setup, error, clearError } = useAuth()
  const navigate                     = useNavigate()
  const [password, setPassword]      = useState('')
  const [password2, setPassword2]    = useState('')
  const [shaking, setShaking]        = useState(false)
  const [busy, setBusy]              = useState(false)
  const [hinweis, setHinweis]        = useState<string | null>(null)
  // Beim allerersten Start legt man hier das Admin-Passwort fest
  const ersteinrichtung              = needsSetup()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError(); setHinweis(null)
    if (ersteinrichtung && password !== password2) { setHinweis('Die Passwörter stimmen nicht überein.'); return }
    setBusy(true)
    const ok = ersteinrichtung ? await setup(password) : await login(password)
    setBusy(false)
    if (ok) {
      navigate('/admin', { replace: true })
    } else {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className={`relative z-10 w-full max-w-sm ${shaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">MicBoard</h1>
          <p className="text-white/40 text-sm mt-1">{ersteinrichtung ? 'Ersteinrichtung: Admin-Passwort festlegen' : 'Admin-Zugang'}</p>
          {isDemo() && <p className="text-brand-300 text-sm mt-3">Demo · Passwort: <b>demo</b> · wird jede Nacht zurückgesetzt</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={ersteinrichtung ? 'Neues Passwort (mind. 6 Zeichen)' : 'Passwort'}
              autoFocus
              autoComplete={ersteinrichtung ? 'new-password' : 'current-password'}
              className="w-full bg-surface-700 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-lg"
            />
          </div>

          {ersteinrichtung && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
                className="w-full bg-surface-700 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-lg"
              />
            </div>
          )}

          {(error || hinweis) && (
            <p className="text-red-400 text-sm text-center animate-fade-in">{error ?? hinweis}</p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '…' : ersteinrichtung ? 'Passwort festlegen' : 'Einloggen'}
          </button>
        </form>

        <p className="text-center text-white/20 text-xs mt-8">
          MicBoard · Live Mic Display System
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
