import { useEffect, useState } from 'react'
import { obtenerProductos } from '../lib/queries.ts'
import { urlImagen } from '../lib/sanity.ts'
import { pesos } from '../lib/formato.ts'
import type { Producto } from '../types/producto.ts'

// TEMPORAL (brief 02): lista los productos para verificar la conexión con Sanity.
// El brief 03 reemplaza esta página por el home real.
type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; productos: Producto[] }

export default function Home() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  useEffect(() => {
    let vigente = true
    obtenerProductos()
      .then((productos) => vigente && setEstado({ tipo: 'listo', productos }))
      .catch((err: unknown) => {
        if (!vigente) return
        setEstado({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      vigente = false
    }
  }, [])

  return (
    <section className="contenedor placeholder">
      <h1>Inicio</h1>

      {estado.tipo === 'cargando' && <p>Cargando productos…</p>}

      {estado.tipo === 'error' && <p role="alert">No se pudieron cargar los productos: {estado.mensaje}</p>}

      {estado.tipo === 'listo' &&
        (estado.productos.length === 0 ? (
          <p>No hay productos cargados.</p>
        ) : (
          <ul>
            {estado.productos.map((p) => {
              const portada = p.imagenes?.[0]
              return (
                <li key={p._id}>
                  {portada && <img src={urlImagen(portada, 120)} alt="" width={120} height={120} />}
                  <strong>{p.nombre}</strong> — {pesos(p.precio)}
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
}
