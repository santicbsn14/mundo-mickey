import { useParams } from 'react-router-dom'

export default function Producto() {
  const { slug } = useParams()
  return (
    <section className="contenedor placeholder">
      <h1>Producto</h1>
      <p>Slug: {slug}</p>
    </section>
  )
}
