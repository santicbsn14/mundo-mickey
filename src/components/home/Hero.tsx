import osito from './osito.svg'
import './Hero.css'

export default function Hero() {
  return (
    <section className="hero fondo-oscuro">
      <div className="contenedor hero__grid">
        <div>
          <h1 className="hero__titulo">
            <span className="hero__linea"><span>Los juguetes</span></span>
            <span className="hero__linea"><span>que todos</span></span>
            <span className="hero__linea"><span>quieren.</span></span>
          </h1>
          <p className="hero__texto">
            Peluches y juguetes de los personajes del momento. Pagás online con Mercado Pago y lo retirás en el
            local o te lo llevamos.
          </p>
          <div className="hero__acciones">
            <a className="hero__btn hero__btn--amarillo" href="#productos">Ver productos</a>
            <a className="hero__btn hero__btn--borde" href="#como-comprar">Cómo comprar</a>
          </div>
        </div>

        {/* Decorativa: el peluche es una ilustración fija de la marca, no un producto */}
        <div className="escena" aria-hidden="true">
          <div className="escena__planeta" />
          <div className="escena__orbita" />
          <img className="escena__peluche" src={osito} alt="" width={200} height={200} />
          <div className="escena__chip">
            Llegaron nuevos<small>Stock limitado</small>
          </div>
        </div>
      </div>
    </section>
  )
}
