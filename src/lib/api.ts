/** Error de la API con lo que devolvió el servidor: el mensaje (`error`) y, en las validaciones, `campos`. */
export class ErrorApi extends Error {
  /** Código HTTP; 0 si no hubo respuesta (sin conexión). */
  readonly status: number
  /** Mensajes por campo de los formularios (400 de validación). */
  readonly campos: Record<string, string>

  constructor(mensaje: string, status: number, campos: Record<string, string> = {}) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.campos = campos
  }
}

// La sesión del admin la maneja AuthAdminContext, que solo se carga con el panel:
// acá queda el token para mandarlo y qué hacer si la API lo rechaza.
let tokenAdmin: string | null = null
let alRechazarSesion: (() => void) | null = null

/** Lo llama AuthAdminContext: el token actual (o `null`) y qué hacer si un endpoint del admin responde 401. */
export function configurarSesionAdmin(token: string | null, alRechazar: (() => void) | null = alRechazarSesion) {
  tokenAdmin = token
  alRechazarSesion = alRechazar
}

const esAdmin = (path: string) => path.startsWith('/admin/')

function normalizar(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

async function pedir<T>(metodo: string, path: string, cuerpo?: unknown): Promise<T> {
  const ruta = normalizar(path)
  const headers: Record<string, string> = { Accept: 'application/json' }
  // El token va solo a los endpoints del panel
  if (tokenAdmin && esAdmin(ruta)) headers.Authorization = `Bearer ${tokenAdmin}`

  let body: BodyInit | undefined
  if (cuerpo instanceof FormData) {
    body = cuerpo // el navegador arma el Content-Type multipart con su boundary
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(cuerpo)
  }

  let res: Response
  try {
    res = await fetch(`/api${ruta}`, { method: metodo, headers, body })
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.', 0)
  }

  if (res.status === 204) return undefined as T

  let datos: unknown = null
  try {
    datos = await res.json()
  } catch {
    // sin cuerpo o no era JSON
  }

  if (!res.ok) {
    const { error, campos } = (datos && typeof datos === 'object' ? datos : {}) as { error?: unknown; campos?: unknown }
    const mensaje = typeof error === 'string' ? error : `Algo salió mal (error ${res.status}).`
    const err = new ErrorApi(mensaje, res.status, campos && typeof campos === 'object' ? (campos as Record<string, string>) : {})
    // Sesión vencida o inválida: se cierra y la protección de rutas lleva al login con ?volver=
    if (res.status === 401 && esAdmin(ruta) && ruta !== '/admin/login') alRechazarSesion?.()
    throw err
  }

  return datos as T
}

/** GET a la API del mismo origen. `path` es relativo a /api, por ejemplo `/health`. */
export const apiGet = <T>(path: string) => pedir<T>('GET', path)
export const apiPost = <T>(path: string, cuerpo?: unknown) => pedir<T>('POST', path, cuerpo)
export const apiPut = <T>(path: string, cuerpo?: unknown) => pedir<T>('PUT', path, cuerpo)
export const apiPatch = <T>(path: string, cuerpo?: unknown) => pedir<T>('PATCH', path, cuerpo)
export const apiDelete = <T = void>(path: string) => pedir<T>('DELETE', path)

/** Sube un archivo como multipart (por ejemplo, una foto en el campo `imagen`). */
export function apiSubir<T>(path: string, archivo: Blob, campo = 'imagen', nombre = 'imagen') {
  const datos = new FormData()
  datos.append(campo, archivo, nombre)
  return pedir<T>('POST', path, datos)
}
