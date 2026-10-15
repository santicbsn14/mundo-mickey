import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Hero from '../components/home/Hero.tsx'
import Marquesina from '../components/home/Marquesina.tsx'
import ComoComprar from '../components/home/ComoComprar.tsx'
import Grilla from '../components/catalogo/Grilla.tsx'

export default function Home() {
  const { hash } = useLocation()

  // Los links del header son /#productos, /#como-comprar y /#contacto. Cuando se llega desde otra
  // página, la sección todavía no existe en el momento en que el navegador busca el ancla, así que
  // se baja acá. El scroll-padding-top de base.css evita que la tape el header sticky.
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const bajar = () => document.getElementById(id)?.scrollIntoView()
    bajar()

    // Lo que carga después (la marquesina, los productos en lugar de los esqueletos) empuja la
    // sección hacia abajo. Se la vuelve a ubicar mientras la página se acomoda, hasta que el
    // usuario scrollea por su cuenta o pasan 3 segundos.
    const observador = new ResizeObserver(bajar)
    observador.observe(document.body)
    const eventos = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    const cortar = () => {
      observador.disconnect()
      eventos.forEach((e) => removeEventListener(e, cortar))
    }
    eventos.forEach((e) => addEventListener(e, cortar, { passive: true }))
    const limite = setTimeout(cortar, 3000)
    return () => {
      clearTimeout(limite)
      cortar()
    }
  }, [hash])

  return (
    <>
      <Hero />
      <Marquesina />
      <Grilla />
      <ComoComprar />
    </>
  )
}
