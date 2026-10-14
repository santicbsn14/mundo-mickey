import { useParams } from 'react-router-dom'

export default function PagoResultado() {
  const { resultado } = useParams()
  return (
    <section className="contenedor placeholder">
      <h1>Resultado del pago</h1>
      <p>Resultado: {resultado}</p>
    </section>
  )
}
