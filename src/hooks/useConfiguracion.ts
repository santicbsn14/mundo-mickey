import { useEffect, useState } from 'react'
import { obtenerConfiguracion } from '../lib/queries.ts'
import type { Configuracion } from '../types/configuracion.ts'

// Un solo request por carga de la página: la marquesina y el footer comparten la promesa.
let promesa: Promise<Configuracion | null> | undefined
// Valor ya resuelto, para no volver a mostrar "cargando" si un componente se monta de nuevo.
let resuelta: { valor: Configuracion | null } | undefined

function cargar(): Promise<Configuracion | null> {
  promesa ??= Promise.resolve()
    .then(() => obtenerConfiguracion())
    .catch((err: unknown) => {
      // Sin error en pantalla: quien la usa degrada solo (la marquesina no se muestra, el footer queda sin datos)
      console.error('No se pudo cargar la configuración:', err)
      return null
    })
    .then((valor) => {
      resuelta = { valor }
      return valor
    })
  return promesa
}

/** Configuración del local (documento único de Sanity), o `null` si no está o falló. */
export function useConfiguracion() {
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(resuelta?.valor ?? null)
  const [cargando, setCargando] = useState(!resuelta)

  useEffect(() => {
    if (resuelta) return
    let vigente = true
    cargar().then((valor) => {
      if (!vigente) return
      setConfiguracion(valor)
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [])

  return { configuracion, cargando }
}
