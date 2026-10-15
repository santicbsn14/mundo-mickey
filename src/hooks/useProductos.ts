import { useCallback, useEffect, useState } from 'react'
import { obtenerProductos } from '../lib/queries.ts'
import type { Producto } from '../types/producto.ts'

type Estado =
  | { estado: 'cargando'; productos: Producto[]; error: null }
  | { estado: 'error'; productos: Producto[]; error: Error }
  | { estado: 'ok'; productos: Producto[]; error: null }

const CARGANDO: Estado = { estado: 'cargando', productos: [], error: null }

// Un solo request por carga de la página: el home, "Otros juguetes" y el carrito comparten la promesa.
let promesa: Promise<Producto[]> | undefined
// Valor ya resuelto, para que la grilla aparezca directo (sin esqueletos) al volver al home.
let resueltos: Producto[] | undefined

/**
 * Productos visibles de la tienda, compartidos por toda la página. Si el request falla, la promesa
 * se descarta: quien llame después vuelve a pedir.
 */
export function cargarProductos(): Promise<Producto[]> {
  if (promesa) return promesa
  // Promise.resolve().then(): si sanity() tira al crearse el cliente, llega como rechazo
  const actual = Promise.resolve()
    .then(() => obtenerProductos())
    .then(
      (productos) => {
        resueltos = productos
        return productos
      },
      (err: unknown) => {
        if (promesa === actual) promesa = undefined
        throw err
      },
    )
  promesa = actual
  return actual
}

/** Productos visibles de la tienda, con estado de carga y reintento. */
export function useProductos() {
  const [resultado, setResultado] = useState<Estado>(() =>
    resueltos ? { estado: 'ok', productos: resueltos, error: null } : CARGANDO,
  )
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    cargarProductos()
      .then((productos) => {
        if (!vigente) return
        // Si ya estaban (volver al home), no se renderiza de nuevo
        setResultado((r) => (r.estado === 'ok' && r.productos === productos ? r : { estado: 'ok', productos, error: null }))
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
    promesa = undefined
    resueltos = undefined
    setResultado(CARGANDO)
    setIntento((n) => n + 1)
  }, [])

  return { ...resultado, reintentar }
}
