import { useParams } from 'react-router-dom'

export default function AdminProductoForm() {
  const { id } = useParams()
  return (
    <section className="contenedor placeholder">
      <h1>{id ? 'Editar producto' : 'Nuevo producto'}</h1>
      {id && <p>ID: {id}</p>}
    </section>
  )
}
