import './ComoComprar.css'

const PASOS = [
  { titulo: 'Elegí tus juguetes', texto: 'Sumalos al carrito y elegí si lo retirás o te lo enviamos.' },
  { titulo: 'Pagá con Mercado Pago', texto: 'Con tarjeta, débito o dinero en cuenta, en la página segura de Mercado Pago.' },
  { titulo: 'Listo, es tuyo', texto: 'Te avisamos cuando está preparado para retirar o salir a entregarse.' },
]

export default function ComoComprar() {
  return (
    <section className="como fondo-oscuro" id="como-comprar">
      <div className="contenedor">
        <h2 className="como__titulo">Cómo comprar</h2>
        <ol className="como__pasos">
          {PASOS.map((paso) => (
            <li key={paso.titulo}>
              <h3>{paso.titulo}</h3>
              <p>{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
