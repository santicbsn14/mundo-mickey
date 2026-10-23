import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import './Footer.css'

export default function Footer() {
  const { configuracion } = useConfiguracion()

  const direccion = configuracion?.direccion?.trim()
  const horarios = configuracion?.horarios?.trim()
  const whatsapp = configuracion?.whatsapp?.replace(/\D/g, '')
  const instagram = configuracion?.instagram?.trim().replace(/^@/, '')

  return (
    <footer className="footer">
      <div className="contenedor footer__grid">
        <div className="footer__logo">
          <img src="/logo.png" alt="Mundo Mickey" width={117} height={64} loading="lazy" />
        </div>
        <div>
          <h3>Visitanos</h3>
          {direccion && <p>{direccion}</p>}
          {horarios && <p>{horarios}</p>}
        </div>
        <div>
          <h3>Contacto</h3>
          {whatsapp && (
            <p>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                Escribinos por WhatsApp
              </a>
            </p>
          )}
          {instagram && (
            <p>
              Instagram{' '}
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer">
                @{instagram}
              </a>
            </p>
          )}
        </div>
      </div>
      <div className="contenedor footer__credito">
        <p>© {new Date().getFullYear()} Mundo Mickey</p>
        <p>
          Desarrollado por{' '}
          {/* Sin noreferrer: así el sitio ve que la visita vino de acá */}
          <a href="https://vialesistemas.com.ar" target="_blank" rel="noopener">
            Santiago Viale Sistemas
          </a>
        </p>
      </div>
    </footer>
  )
}
