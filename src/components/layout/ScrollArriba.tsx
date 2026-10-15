import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const CLAVE = 'mundo-mickey:scroll'

// Posición de cada entrada del historial (`location.key` → scrollY). En sessionStorage para que
// sobreviva a una recarga de la pestaña, como el historial.
let posiciones: Record<string, number> | undefined

function leerPosiciones(): Record<string, number> {
  if (posiciones) return posiciones
  try {
    const guardado: unknown = JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}')
    posiciones = typeof guardado === 'object' && guardado !== null ? (guardado as Record<string, number>) : {}
  } catch {
    posiciones = {}
  }
  return posiciones
}

function guardarPosiciones() {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(leerPosiciones()))
  } catch {
    // Sin sessionStorage: se recuerda solo mientras no se recargue
  }
}

/** Dónde estaba la página de esa entrada del historial, si se guardó. */
export function posicionGuardada(key: string): number | undefined {
  const y = leerPosiciones()[key]
  return typeof y === 'number' && Number.isFinite(y) ? y : undefined
}

/**
 * react-router no maneja el scroll al cambiar de página:
 * - al entrar a una página nueva (sin hash), sube arriba de todo. Con hash (/#productos) no hace
 *   nada: de eso se ocupa el Home;
 * - con "atrás"/"adelante" del navegador (POP), vuelve a donde estaba esa entrada del historial.
 *
 * La restauración nativa del navegador no alcanza: con hash en la URL, Chrome baja al ancla en vez
 * de volver a donde estaba (ver el efecto de abajo).
 */
export default function ScrollArriba() {
  const { pathname, hash, key } = useLocation()
  const tipo = useNavigationType()
  const keyActual = useRef(key)
  const pathnameAnterior = useRef<string | null>(null)

  // Guarda el scroll de la entrada actual mientras se scrollea. La key se lee en el momento del
  // evento: el scroll que provoca el cambio de página ya cuenta para la página nueva.
  useEffect(() => {
    let timer: number | undefined
    const alScrollear = () => {
      leerPosiciones()[keyActual.current] = window.scrollY
      window.clearTimeout(timer)
      timer = window.setTimeout(guardarPosiciones, 150)
    }
    addEventListener('scroll', alScrollear, { passive: true })
    addEventListener('pagehide', guardarPosiciones)
    return () => {
      removeEventListener('scroll', alScrollear)
      removeEventListener('pagehide', guardarPosiciones)
      window.clearTimeout(timer)
      guardarPosiciones()
    }
  }, [])

  // Layout effect: actúa antes de pintar, así no se ve la página nueva en otra posición un instante.
  // 'instant' y no el default: el `scroll-behavior: smooth` de base.css lo animaría.
  useLayoutEffect(() => {
    keyActual.current = key
    const cambioDePagina = pathnameAnterior.current !== pathname
    pathnameAnterior.current = pathname

    if (tipo === 'POP') {
      const y = posicionGuardada(key)
      if (y === undefined) return
      const restaurar = () => window.scrollTo({ top: y, left: 0, behavior: 'instant' })
      restaurar()
      // Si la entrada tiene hash (/#productos), Chrome además hace un scroll suave al ancla un frame
      // después. Repetirlo dos frames más tarde lo cancela.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(restaurar)
      })
      return () => cancelAnimationFrame(frame)
    }
    // Si cambia nada más el hash, no se sube
    if (hash || !cambioDePagina) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [key, pathname, hash, tipo])

  return null
}
