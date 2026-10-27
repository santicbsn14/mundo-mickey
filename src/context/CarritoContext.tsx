import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cargarProductos, recargarProductos } from '../hooks/useProductos.ts'
import type { ImagenSanity, Producto } from '../types/producto.ts'

/** Un producto en el carrito, con los datos que hacen falta para mostrarlo sin volver a pedirlo. */
export interface ItemCarrito {
  productoId: string
  slug: string
  nombre: string
  precio: number
  stock: number
  /** La primera imagen del producto (la portada), o `null` si no tiene. */
  imagen: ImagenSanity | null
  cantidad: number
}

/** Lo que devuelve el 409 del checkout por cada ítem que cambió. */
export interface ProblemaStock {
  id: string
  motivo: 'no_disponible' | 'sin_stock'
  stockDisponible: number
}

interface ValorCarrito {
  items: ItemCarrito[]
  /** Suma de las cantidades (lo que muestra el header). */
  cantidadTotal: number
  subtotal: number
  agregar: (producto: Producto) => void
  /** Acota entre 1 y el stock; con 0 o menos, quita el ítem. */
  cambiarCantidad: (productoId: string, cantidad: number) => void
  quitar: (productoId: string) => void
  vaciar: () => void
  cantidadDe: (productoId: string) => number
  abierto: boolean
  abrir: () => void
  cerrar: () => void
  /** La sincronización con Sanity quitó o acotó algún ítem. Se borra al cerrar el drawer. */
  actualizado: boolean
  /**
   * Después de un 409 del checkout: aplica lo que respondió la API (quita o acota) y vuelve a
   * sincronizar con los productos pedidos de nuevo.
   */
  ajustarStock: (problemas: ProblemaStock[]) => void
}

const CLAVE = 'mundo-mickey:carrito'
const VERSION = 1

const CarritoContext = createContext<ValorCarrito | null>(null)

function datosDe(producto: Producto): Omit<ItemCarrito, 'cantidad'> {
  return {
    productoId: producto._id,
    slug: producto.slug,
    nombre: producto.nombre,
    precio: producto.precio,
    stock: producto.stock,
    imagen: producto.imagenes?.[0] ?? null,
  }
}

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const esEntero = (v: unknown, minimo: number): v is number => Number.isInteger(v) && (v as number) >= minimo

function esImagen(v: unknown): v is ImagenSanity | null {
  if (v === null) return true
  if (typeof v !== 'object') return false
  const asset = (v as { asset?: unknown }).asset
  return typeof asset === 'object' && asset !== null && esTexto((asset as { _ref?: unknown })._ref)
}

function esItem(v: unknown): v is ItemCarrito {
  if (typeof v !== 'object' || v === null) return false
  const i = v as Record<string, unknown>
  return (
    esTexto(i.productoId) &&
    esTexto(i.slug) &&
    esTexto(i.nombre) &&
    esEntero(i.precio, 0) &&
    esEntero(i.stock, 0) &&
    esEntero(i.cantidad, 1) &&
    esImagen(i.imagen)
  )
}

/** Lo guardado en el navegador. Si no está, no se puede leer o no tiene la forma esperada: vacío. */
function leerGuardado(): ItemCarrito[] {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return []
    const guardado: unknown = JSON.parse(crudo)
    if (typeof guardado !== 'object' || guardado === null) return []
    const { version, items } = guardado as { version?: unknown; items?: unknown }
    if (version !== VERSION || !Array.isArray(items) || !items.every(esItem)) return []
    // Por las dudas: sin repetidos y sin pasar el stock guardado
    const vistos = new Set<string>()
    return items
      .filter((i) => i.stock > 0 && !vistos.has(i.productoId) && vistos.add(i.productoId))
      .map((i) => ({ ...i, cantidad: Math.min(i.cantidad, i.stock) }))
  } catch {
    return []
  }
}

function guardar(items: ItemCarrito[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, items }))
  } catch {
    // Sin localStorage (modo privado, cuota llena): el carrito sigue andando en memoria
  }
}

/**
 * Actualiza los ítems con los datos actuales de Sanity. Quita los que ya no están o no tienen stock
 * y acota las cantidades al stock nuevo. `cambio` avisa si pasó alguna de las dos cosas.
 */
function sincronizar(items: ItemCarrito[], productos: Producto[]): { items: ItemCarrito[]; cambio: boolean } {
  const porId = new Map(productos.map((p) => [p._id, p]))
  let cambio = false
  const nuevos: ItemCarrito[] = []
  for (const item of items) {
    const producto = porId.get(item.productoId)
    if (!producto || producto.stock <= 0) {
      cambio = true
      continue
    }
    const cantidad = Math.min(item.cantidad, producto.stock)
    if (cantidad !== item.cantidad) cambio = true
    nuevos.push({ ...datosDe(producto), cantidad })
  }
  return { items: nuevos, cambio }
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(leerGuardado)
  const [abierto, setAbierto] = useState(false)
  const [actualizado, setActualizado] = useState(false)

  // Los ítems actuales, para la sincronización (que termina después del primer render)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
    guardar(items)
  }, [items])

  // Al iniciar, si hay algo guardado, se pone al día con Sanity. La validación definitiva de precio y
  // stock la hace la API en el checkout: esto es para no mostrar datos viejos.
  useEffect(() => {
    if (itemsRef.current.length === 0) return
    let vigente = true
    cargarProductos()
      .then((productos) => {
        if (!vigente) return
        const resultado = sincronizar(itemsRef.current, productos)
        setItems(resultado.items)
        if (resultado.cambio) setActualizado(true)
      })
      .catch(() => {
        // Sin productos (error de red o de Sanity): el carrito queda como estaba
      })
    return () => {
      vigente = false
    }
  }, [])

  const agregar = useCallback((producto: Producto) => {
    if (producto.stock <= 0) return
    setItems((prev) => {
      const existente = prev.find((i) => i.productoId === producto._id)
      if (!existente) return [...prev, { ...datosDe(producto), cantidad: 1 }]
      if (existente.cantidad >= producto.stock) return prev
      return prev.map((i) => (i === existente ? { ...datosDe(producto), cantidad: i.cantidad + 1 } : i))
    })
  }, [])

  const quitar = useCallback((productoId: string) => {
    setItems((prev) => prev.filter((i) => i.productoId !== productoId))
  }, [])

  const cambiarCantidad = useCallback((productoId: string, cantidad: number) => {
    setItems((prev) =>
      cantidad <= 0
        ? prev.filter((i) => i.productoId !== productoId)
        : prev.map((i) =>
            i.productoId === productoId ? { ...i, cantidad: Math.max(1, Math.min(Math.floor(cantidad), i.stock)) } : i,
          ),
    )
  }, [])

  const ajustarStock = useCallback((problemas: ProblemaStock[]) => {
    const porId = new Map(problemas.map((p) => [p.id, p]))
    // Primero lo que dijo la API, que leyó sin CDN: el CDN puede tardar en mostrar el cambio
    setItems((prev) =>
      prev.flatMap((i) => {
        const p = porId.get(i.productoId)
        if (!p) return [i]
        const stock = p.motivo === 'no_disponible' ? 0 : Math.max(0, p.stockDisponible)
        return stock > 0 ? [{ ...i, stock, cantidad: Math.min(i.cantidad, stock) }] : []
      }),
    )
    // Después, los datos nuevos del resto. `sincronizar` solo quita o acota: un CDN atrasado no devuelve lo quitado
    recargarProductos()
      .then((productos) =>
        setItems((prev) =>
          sincronizar(prev, productos).items.map((i) => {
            // Un CDN atrasado puede traer más stock del que informó la API: queda el menor
            const p = porId.get(i.productoId)
            return p ? { ...i, stock: Math.min(i.stock, p.stockDisponible) } : i
          }),
        ),
      )
      .catch(() => {
        // Sin productos: queda lo que dijo la API
      })
  }, [])

  const vaciar = useCallback(() => setItems([]), [])
  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])

  // El aviso de la sincronización se va recién cuando se cierra un drawer que estaba abierto
  // (si se cerró por un cambio de ruta sin haberlo abierto, el aviso sigue esperando)
  const estabaAbierto = useRef(false)
  useEffect(() => {
    if (estabaAbierto.current && !abierto) setActualizado(false)
    estabaAbierto.current = abierto
  }, [abierto])

  const valor = useMemo<ValorCarrito>(() => {
    const porId = new Map(items.map((i) => [i.productoId, i.cantidad]))
    return {
      items,
      cantidadTotal: items.reduce((suma, i) => suma + i.cantidad, 0),
      subtotal: items.reduce((suma, i) => suma + i.cantidad * i.precio, 0),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      cantidadDe: (productoId) => porId.get(productoId) ?? 0,
      abierto,
      abrir,
      cerrar,
      actualizado,
      ajustarStock,
    }
  }, [items, abierto, actualizado, agregar, cambiarCantidad, quitar, vaciar, abrir, cerrar, ajustarStock])

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>
}

export function useCarrito(): ValorCarrito {
  const valor = useContext(CarritoContext)
  if (!valor) throw new Error('useCarrito se usa dentro de <CarritoProvider> (el Layout de la tienda)')
  return valor
}
