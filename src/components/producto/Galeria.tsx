import { useEffect, useRef, useState } from 'react'
import { urlImagen } from '../../lib/sanity.ts'
import type { ImagenSanity } from '../../types/producto.ts'
import './Galeria.css'

interface Props {
  imagenes: ImagenSanity[]
  nombre: string
}

const ANCHOS = [600, 1000, 1400]
const SIZES = '(min-width: 900px) 600px, 100vw'
const ANCHO_MINIATURA = 160

/**
 * Foto principal cuadrada en una pista horizontal con scroll-snap: en el celular se pasa con el
 * dedo y las miniaturas llevan la pista a cada foto. Para volver a la primera al cambiar de
 * producto, quien la usa le pone `key` con el id del producto.
 */
export default function Galeria({ imagenes, nombre }: Props) {
  const pista = useRef<HTMLDivElement>(null)
  // Foto a la que se está yendo por una miniatura: mientras dura el scroll suave, la activa no
  // pasa por las fotos intermedias
  const destino = useRef<number | null>(null)
  const [activa, setActiva] = useState(0)
  const total = imagenes.length

  // La miniatura activa acompaña al deslizar: la foto que ocupa la pista es scrollLeft / ancho
  useEffect(() => {
    const el = pista.current
    if (!el || total < 2) return
    let cuadro = 0
    const alScrollear = () => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const posicion = el.scrollLeft / el.clientWidth
        if (destino.current !== null) {
          if (Math.abs(posicion - destino.current) > 0.01) return
          destino.current = null
        }
        setActiva(Math.min(Math.max(Math.round(posicion), 0), total - 1))
      })
    }
    // Si el usuario toca, scrollea o usa el teclado en medio del scroll suave, manda él
    const soltar = () => {
      destino.current = null
    }
    el.addEventListener('scroll', alScrollear, { passive: true })
    el.addEventListener('pointerdown', soltar, { passive: true })
    el.addEventListener('wheel', soltar, { passive: true })
    el.addEventListener('keydown', soltar)
    return () => {
      el.removeEventListener('scroll', alScrollear)
      el.removeEventListener('pointerdown', soltar)
      el.removeEventListener('wheel', soltar)
      el.removeEventListener('keydown', soltar)
      cancelAnimationFrame(cuadro)
    }
  }, [total])

  const irA = (i: number) => {
    const el = pista.current
    if (!el) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setActiva(i)
    destino.current = Math.round(el.scrollLeft / el.clientWidth) === i ? null : i
    el.scrollTo({ left: i * el.clientWidth, behavior: reducido ? 'auto' : 'smooth' })
  }

  if (total === 0) return <div className="galeria__marco galeria__marco--vacio" />

  return (
    <div className="galeria">
      <div className="galeria__marco">
        {/* Enfocable (Chrome ya lo hace solo con los scrollers): con las flechas se pasan las fotos */}
        <div
          className="galeria__pista"
          ref={pista}
          tabIndex={total > 1 ? 0 : undefined}
          role={total > 1 ? 'region' : undefined}
          aria-label={total > 1 ? `Fotos de ${nombre}` : undefined}
        >
          {imagenes.map((imagen, i) => (
            <div className="galeria__foto" key={imagen._key}>
              <img
                src={urlImagen(imagen, ANCHOS[1]!)}
                srcSet={ANCHOS.map((w) => `${urlImagen(imagen, w)} ${w}w`).join(', ')}
                sizes={SIZES}
                alt={i === 0 ? nombre : `${nombre}, foto ${i + 1}`}
                loading={i === 0 ? undefined : 'lazy'}
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="galeria__miniaturas">
          {imagenes.map((imagen, i) => (
            <button
              key={imagen._key}
              type="button"
              className="galeria__miniatura"
              aria-label={`Ver foto ${i + 1} de ${total}`}
              aria-current={i === activa ? 'true' : undefined}
              onClick={() => irA(i)}
            >
              <img src={urlImagen(imagen, ANCHO_MINIATURA)} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
