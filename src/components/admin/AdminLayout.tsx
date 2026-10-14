import { NavLink, Outlet, useLocation } from 'react-router-dom'
import './AdminLayout.css'

// Sin protección de rutas hasta el brief 06 (login con JWT)
export default function AdminLayout() {
  const { pathname } = useLocation()
  // "Pedidos" vive en /admin, pero su detalle está en /admin/pedidos/:id
  const enPedidos = pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/pedidos')

  return (
    <>
      <header className="admin-barra fondo-oscuro">
        <div className="contenedor admin-barra__fila">
          <span className="admin-barra__titulo">Panel · Mundo Mickey</span>
          <nav className="admin-barra__nav" aria-label="Secciones del panel">
            <NavLink
              to="/admin"
              className={enPedidos ? 'active' : undefined}
              aria-current={enPedidos ? 'page' : undefined}
            >
              Pedidos
            </NavLink>
            <NavLink to="/admin/productos">Productos</NavLink>
            <NavLink to="/admin/configuracion">Configuración</NavLink>
          </nav>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </>
  )
}
