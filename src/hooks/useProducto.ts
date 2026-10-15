import { useCallback, useEffect, useState } from 'react'
import { obtenerProductoPorSlug } from '../lib/queries.ts'
import type { Producto } from '../types/producto.ts'

type Estado =
  | { estado: 'cargando'; producto: null }
  | { estado: 'error'; producto: null }
  | { estado: 'no-encontrado'; producto: null }
  | { estado: 'ok'; producto: Producto }

const CARGANDO: Estado = { estado: 'cargando', producto: null }

/**
 * Un producto activo por su slug. Si cambia el slug (la página no se desmonta al pasar de un
 * producto a otro), vuelve a `cargando` y busca el nuevo; las respuestas viejas se ignoran.
 */
export function useProducto(slug: string) {
  const [intento, setIntento] = useState(0)
  // El resultado queda marcado con el slug y el intento que lo pidieron. Si no coincide con los
  // actuales, es de una búsqueda anterior y se muestra `cargando`.
  const [resultado, setResultado] = useState<{ clave: string; valor: Estado } | null>(null)
  const clave = `${slug}\n${intento}`

  useEffect(() => {
    let vigente = true
    // Promise.resolve().then(): si sanity() tira al crearse el cliente, llega como rechazo
    Promise.resolve()
      .then(() => obtenerProductoPorSlug(slug))
      .then((producto) => {
        if (!vigente) return
        setResultado({
          clave,
          valor: producto ? { estado: 'ok', producto } : { estado: 'no-encontrado', producto: null },
        })
      })
      .catch((err: unknown) => {
        if (!vigente) return
        console.error(`No se pudo cargar el producto "${slug}":`, err)
        setResultado({ clave, valor: { estado: 'error', producto: null } })
      })
    return () => {
      vigente = false
    }
  }, [slug, clave])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  const actual = resultado?.clave === clave ? resultado.valor : CARGANDO
  return { ...actual, reintentar }
}
