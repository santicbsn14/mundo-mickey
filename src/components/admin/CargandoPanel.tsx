// Pantalla mínima mientras carga un chunk del panel o se verifica la sesión.
// Estilos en línea: App.tsx la usa antes de que llegue el CSS del panel.
export default function CargandoPanel() {
  return (
    <p role="status" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--suave)', fontWeight: 600 }}>
      Cargando…
    </p>
  )
}
