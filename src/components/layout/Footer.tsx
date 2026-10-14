import './Footer.css'

// Datos de ejemplo: en el brief 07 salen de la configuración de Sanity
export default function Footer() {
  return (
    <footer className="footer" id="contacto">
      <div className="contenedor footer__grid">
        <div className="footer__logo">
          <img src="/logo.png" alt="Mundo Mickey" width={117} height={64} loading="lazy" />
        </div>
        <div>
          <h3>Visitanos</h3>
          <p>
            Dirección del local
            <br />
            San Nicolás de los Arroyos
          </p>
        </div>
        <div>
          <h3>Contacto</h3>
          <p>
            WhatsApp 336 000-0000
            <br />
            Instagram <a href="#">@mundomickey</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
