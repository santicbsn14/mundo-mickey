import { useEffect, useRef, type ReactNode } from 'react'
import './ResultadoPago.css'

export type IconoResultado = 'esperando' | 'listo' | 'aviso' | 'error'

interface Props {
  icono: IconoResultado
  titulo: ReactNode
  children?: ReactNode
  acciones?: ReactNode
}

function Icono({ tipo }: { tipo: IconoResultado }) {
  if (tipo === 'esperando') return <span className="resultado-pago__indicador" />
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      {tipo === 'listo' && (
        <path d="M13 25l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {tipo === 'aviso' && (
        <path d="M24 13v12l7 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {tipo === 'error' && <path d="M16 16l16 16M32 16L16 32" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  )
}

/** La tarjeta de las páginas de resultado del pago: ícono, título, texto y botones. */
export default function ResultadoPago({ icono, titulo, children, acciones }: Props) {
  // Cuando cambia el mensaje (por ejemplo, de "confirmando" a "¡Listo!"), el foco va al título
  // para que un lector de pantalla lo anuncie
  const h1 = useRef<HTMLHeadingElement>(null)
  const primero = useRef(true)
  useEffect(() => {
    if (primero.current) {
      primero.current = false
      return
    }
    h1.current?.focus()
  }, [icono])

  return (
    <section className="contenedor resultado-pago">
      <div className={`resultado-pago__tarjeta resultado-pago__tarjeta--${icono}`}>
        <div className="resultado-pago__icono" aria-hidden="true">
          <Icono tipo={icono} />
        </div>
        <h1 ref={h1} tabIndex={-1} className="resultado-pago__titulo">
          {titulo}
        </h1>
        {children && <div className="resultado-pago__texto">{children}</div>}
        {acciones && <div className="resultado-pago__acciones">{acciones}</div>}
      </div>
    </section>
  )
}
