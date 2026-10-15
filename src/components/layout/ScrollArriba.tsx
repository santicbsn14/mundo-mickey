import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * react-router no vuelve arriba al cambiar de página: sin esto, entrar a un producto desde el final
 * del home deja el detalle scrolleado. Con hash (/#productos) no hace nada: de eso se ocupa el Home.
 */
export default function ScrollArriba() {
  const { pathname, hash } = useLocation()

  // Layout effect: sube antes de pintar, así no se ve la página nueva scrolleada un instante
  useLayoutEffect(() => {
    if (hash) return
    // 'instant' y no el default: el `scroll-behavior: smooth` de base.css lo animaría
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    // Solo el cambio de pathname dispara: si cambia nada más el hash, no se sube
  }, [pathname])

  return null
}
