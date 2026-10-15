import type { CSSProperties } from 'react'
import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import './Marquesina.css'

/** Mínimo de textos por vuelta, para que el loop no deje huecos en pantallas anchas. */
const MINIMO = 8
/** Segundos por texto: la maqueta recorre 5 textos en 26 s. */
const SEGUNDOS_POR_TEXTO = 5.2

export default function Marquesina() {
  const { configuracion } = useConfiguracion()
  const textos = (configuracion?.marquesina ?? []).map((t) => t.trim()).filter(Boolean)
  if (textos.length === 0) return null

  // Se repite la lista hasta tener al menos MINIMO textos, y ese bloque se duplica:
  // la animación mueve la pista -50%, así el final empalma con el principio.
  const bloque: string[] = []
  while (bloque.length < MINIMO) bloque.push(...textos)
  const pista = [...bloque, ...bloque]
  const estilo = { '--marquesina-duracion': `${bloque.length * SEGUNDOS_POR_TEXTO}s` } as CSSProperties

  return (
    <div className="marquesina" aria-hidden="true">
      <div className="marquesina__pista" style={estilo}>
        {pista.map((texto, i) => (
          <span key={i}>{texto}</span>
        ))}
      </div>
    </div>
  )
}
