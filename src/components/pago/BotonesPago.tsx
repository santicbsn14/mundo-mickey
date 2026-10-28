import { Link } from 'react-router-dom'
import './BotonesPago.css'

interface Props {
  /** WhatsApp del local en formato wa.me (solo dígitos). Sin él, no aparece el botón. */
  whatsapp?: string
  /** El mensaje armado para el chat. */
  mensaje: string
  /** "Volver a intentar" (a /checkout) en vez de "Volver a la tienda". */
  reintentar?: boolean
}

export default function BotonesPago({ whatsapp, mensaje, reintentar = false }: Props) {
  return (
    <div className="botones-pago">
      {reintentar && (
        <Link className="botones-pago__btn botones-pago__btn--negro" to="/checkout">
          Volver a intentar
        </Link>
      )}
      {whatsapp && (
        <a
          className={`botones-pago__btn ${reintentar ? 'botones-pago__btn--borde' : 'botones-pago__btn--negro'}`}
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escribinos por WhatsApp
        </a>
      )}
      {!reintentar && (
        <Link className="botones-pago__btn botones-pago__btn--borde" to="/">
          Volver a la tienda
        </Link>
      )}
    </div>
  )
}
