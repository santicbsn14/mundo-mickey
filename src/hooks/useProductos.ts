import { useCallback, useEffect, useState } from 'react'
import { obtenerProductos } from '../lib/queries.ts'
import type { Producto } from '../types/producto.ts'

type Estado =
  | { estado: 'cargando'; productos: Producto[]; error: null }
  | { estado: 'error'; productos: Producto[]; error: Error }
  | { estado: 'ok'; productos: Producto[]; error: null }

const CARGANDO: Estado = { estado: 'cargando', productos: [], error: null }

/** Productos visibles de la tienda, con estado de carga y reintento. */
export function useProductos() {
  const [resultado, setResultado] = useState<Estado>(CARGANDO)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    // Promise.resolve().then(): si sanity() tira al crearse el cliente, llega como rechazo
    Promise.resolve()
      .then(() => obtenerProductos())
      .then((productos) => {
        if (vigente) setResultado({ estado: 'ok', productos, error: null })
      })
      .catch((err: unknown) => {
        if (!vigente) return
        console.error('No se pudieron cargar los productos:', err)
        setResultado({ estado: 'error', productos: [], error: err instanceof Error ? err : new Error(String(err)) })
      })
    return () => {
      vigente = false
    }
  }, [intento])

  const reintentar = useCallback(() => {
    setResultado(CARGANDO)
    setIntento((n) => n + 1)
  }, [])

  return { ...resultado, reintentar }
}
