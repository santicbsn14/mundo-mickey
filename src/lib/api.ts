/** GET a la API del mismo origen. `path` es relativo a /api, por ejemplo `/health`. */
export async function apiGet<T>(path: string): Promise<T> {
  const url = `/api${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })

  if (!res.ok) {
    let detalle = res.statusText
    try {
      const cuerpo: unknown = await res.json()
      if (cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo && typeof cuerpo.error === 'string') {
        detalle = cuerpo.error
      }
    } catch {
      // la respuesta no era JSON: nos quedamos con el statusText
    }
    throw new Error(`GET ${url} falló (${res.status}): ${detalle}`)
  }

  return (await res.json()) as T
}
