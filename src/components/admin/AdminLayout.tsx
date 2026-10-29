import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthAdmin } from '../../context/AuthAdminContext.tsx'
import { apiGet } from '../../lib/api.ts'
import type { ListadoPedidos } from '../../lib/pedidosAdmin.ts'
import CargandoPanel from './CargandoPanel.tsx'
import type { ContextoPanel } from './contextoPanel.ts'
import './AdminLayout.css'

/** `/admin/login?volver=<ruta>`, con las `/` sin codificar para que se lea. */
function rutaLogin(volver: string) {
  return `/admin/login?volver=${encodeURIComponent(volver).replace(/%2F/gi, '/')}`
}

// Todo lo que está adentro exige estar logueado
export default function AdminLayout() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { estado, logout } = useAuthAdmin()
  // "Salir" va al login sin ?volver=
  const saliendo = useRef(false)

  // Pedidos "A preparar", para el número del link "Pedidos"
  const [aPreparar, setAPreparar] = useState(0)
  const refrescarAPreparar = useCallback(() => {
    apiGet<ListadoPedidos>('/admin/pedidos?estado=pagado')
      .then((r) => setAPreparar(r.conteos.pagado))
      .catch(() => {
        // Sin el número no pasa nada: se vuelve a pedir al entrar al listado
      })
  }, [])
  const logueado = estado === 'logueado'
  useEffect(() => {
    if (logueado) refrescarAPreparar()
  }, [logueado, refrescarAPreparar])
  const contexto = useMemo<ContextoPanel>(() => ({ setAPreparar, refrescarAPreparar }), [refrescarAPreparar])

  if (estado === 'verificando') return <CargandoPanel />
  if (estado === 'deslogueado') {
    return <Navigate to={saliendo.current ? '/admin/login' : rutaLogin(pathname + search)} replace />
  }

  // "Pedidos" vive en /admin, pero su detalle está en /admin/pedidos/:id
  const enPedidos = pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/pedidos')

  function salir() {
    saliendo.current = true
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <>
      <header className="admin-barra fondo-oscuro">
        <div className="contenedor admin-barra__fila">
          <span className="admin-barra__titulo">Panel · Mundo Mickey</span>
          <nav className="admin-barra__nav" aria-label="Secciones del panel">
            <NavLink
              to="/admin"
              end
              className={enPedidos ? 'active' : undefined}
              aria-current={enPedidos ? 'page' : undefined}
            >
              Pedidos
              {aPreparar > 0 && (
                <span className="admin-barra__badge">
                  {aPreparar}
                  <span className="adm-oculto"> a preparar</span>
                </span>
              )}
            </NavLink>
            <NavLink to="/admin/productos">Productos</NavLink>
            <NavLink to="/admin/configuracion">Configuración</NavLink>
          </nav>
          <button type="button" className="admin-barra__salir" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Suspense fallback={<CargandoPanel />}>
          <Outlet context={contexto} />
        </Suspense>
      </main>
    </>
  )
}
