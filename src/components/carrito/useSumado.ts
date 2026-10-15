import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuánto dura el "¡Sumado!" del botón después de agregar (como la maqueta). */
const DURACION = 900

/** Estado temporal "¡Sumado!" de un botón de agregar. `marcar()` lo prende y se apaga solo. */
export function useSumado(): [boolean, () => void] {
  const [sumado, setSumado] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const marcar = useCallback(() => {
    window.clearTimeout(timer.current)
    setSumado(true)
    timer.current = window.setTimeout(() => setSumado(false), DURACION)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return [sumado, marcar]
}
