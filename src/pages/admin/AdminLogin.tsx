import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthAdmin } from '../../context/AuthAdminContext.tsx'
import { ErrorApi } from '../../lib/api.ts'
import CargandoPanel from '../../components/admin/CargandoPanel.tsx'
import './AdminLogin.css'

/** A dónde ir después de entrar: `volver` solo si es una ruta del panel (y no el login). */
function destinoSeguro(volver: string | null): string {
  if (!volver || !/^\/admin(\/|\?|#|$)/.test(volver) || volver.startsWith('/admin/login')) return '/admin'
  return volver
}

export default function AdminLogin() {
  const { estado, login } = useAuthAdmin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const destino = destinoSeguro(params.get('volver'))

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (estado === 'verificando') return <CargandoPanel />
  if (estado === 'logueado' && !enviando) return <Navigate to={destino} replace />

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await login(usuario.trim(), password)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo ingresar. Probá de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <div className="login__caja">
        <img className="login__logo" src="/logo.png" alt="" width="64" height="64" />
        <h1 className="login__titulo">Ingresar al panel</h1>

        <form className="login__form" onSubmit={enviar}>
          {error && (
            <div className="login__error" role="alert">
              {error}
            </div>
          )}

          <label className="login__campo">
            <span>Usuario</span>
            <input
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </label>

          <div className="login__campo">
            <label htmlFor="login-password">Contraseña</label>
            <div className="login__password">
              <input
                id="login-password"
                name="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login__ver"
                aria-controls="login-password"
                aria-pressed={verPassword}
                onClick={() => setVerPassword((v) => !v)}
              >
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <button type="submit" className="login__enviar" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}
