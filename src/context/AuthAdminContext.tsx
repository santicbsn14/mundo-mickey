import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiGet, apiPost, configurarSesionAdmin, ErrorApi } from '../lib/api.ts'

type EstadoSesion = 'verificando' | 'logueado' | 'deslogueado'

interface ValorAuthAdmin {
  estado: EstadoSesion
  usuario: string | null
  /** Tira un `ErrorApi` con el mensaje de la API si no entra (credenciales o demasiados intentos). */
  login: (usuario: string, password: string) => Promise<void>
  logout: () => void
}

/** Lo que queda en el navegador. `expira` en milisegundos. */
interface SesionGuardada {
  token: string
  expira: number
  usuario: string
}

const CLAVE = 'mundo-mickey:admin'

const AuthAdminContext = createContext<ValorAuthAdmin | null>(null)

function borrarGuardada() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // sin localStorage: no hay nada que borrar
  }
}

/** La sesión guardada, si tiene la forma esperada y no venció. Si no, la borra. */
function leerGuardada(): SesionGuardada | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const s: unknown = JSON.parse(crudo)
    if (
      typeof s === 'object' && s !== null &&
      typeof (s as SesionGuardada).token === 'string' &&
      typeof (s as SesionGuardada).usuario === 'string' &&
      Number.isFinite((s as SesionGuardada).expira) &&
      (s as SesionGuardada).expira > Date.now()
    ) {
      return s as SesionGuardada
    }
  } catch {
    // JSON roto o sin acceso a localStorage
  }
  borrarGuardada()
  return null
}

export function AuthAdminProvider({ children }: { children: ReactNode }) {
  // Se lee una sola vez, al montar el panel
  const [sesion, setSesion] = useState<SesionGuardada | null>(() => {
    const guardada = leerGuardada()
    configurarSesionAdmin(guardada?.token ?? null)
    return guardada
  })
  const [verificada, setVerificada] = useState(false)

  const logout = useCallback(() => {
    borrarGuardada()
    configurarSesionAdmin(null)
    setSesion(null)
  }, [])

  // Si un endpoint del admin responde 401, la sesión se cierra
  useEffect(() => {
    configurarSesionAdmin(sesion?.token ?? null, logout)
  }, [sesion, logout])

  // Al iniciar, el token guardado se valida con la API. Un 401 lo borra (lo hace el manejador de arriba);
  // si la API no responde, se confía en el vencimiento guardado: cualquier pedido posterior lo vuelve a validar.
  useEffect(() => {
    if (!sesion || verificada) return
    let vigente = true
    apiGet<{ usuario: string; expira: string }>('/admin/sesion')
      .catch((err: unknown) => {
        if (err instanceof ErrorApi && err.status === 401) logout()
      })
      .finally(() => {
        if (vigente) setVerificada(true)
      })
    return () => {
      vigente = false
    }
  }, [sesion, verificada, logout])

  // Al vencer el token, la sesión se cierra sola
  useEffect(() => {
    if (!sesion) return
    const id = window.setTimeout(logout, Math.max(0, sesion.expira - Date.now()))
    return () => window.clearTimeout(id)
  }, [sesion, logout])

  const login = useCallback(async (usuario: string, password: string) => {
    const { token, expira } = await apiPost<{ token: string; expira: string }>('/admin/login', { usuario, password })
    const nueva: SesionGuardada = { token, expira: Date.parse(expira), usuario }
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nueva))
    } catch {
      // Sin localStorage la sesión dura hasta recargar
    }
    configurarSesionAdmin(token)
    setVerificada(true)
    setSesion(nueva)
  }, [])

  const valor = useMemo<ValorAuthAdmin>(
    () => ({
      estado: !sesion ? 'deslogueado' : verificada ? 'logueado' : 'verificando',
      usuario: sesion?.usuario ?? null,
      login,
      logout,
    }),
    [sesion, verificada, login, logout],
  )

  return <AuthAdminContext.Provider value={valor}>{children}</AuthAdminContext.Provider>
}

export function useAuthAdmin(): ValorAuthAdmin {
  const valor = useContext(AuthAdminContext)
  if (!valor) throw new Error('useAuthAdmin se usa dentro de <AuthAdminProvider> (las rutas de /admin)')
  return valor
}
