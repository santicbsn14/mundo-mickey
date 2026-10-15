import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout.tsx'
import CargandoPanel from './components/admin/CargandoPanel.tsx'
import Home from './pages/Home.tsx'
import Producto from './pages/Producto.tsx'
import Checkout from './pages/Checkout.tsx'
import PagoResultado from './pages/PagoResultado.tsx'
import NotFound from './pages/NotFound.tsx'

// El panel se carga aparte (lazy): no suma peso a la tienda
const AdminRaiz = lazy(() => import('./components/admin/AdminRaiz.tsx'))
const AdminLayout = lazy(() => import('./components/admin/AdminLayout.tsx'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.tsx'))
const AdminPedidos = lazy(() => import('./pages/admin/AdminPedidos.tsx'))
const AdminPedidoDetalle = lazy(() => import('./pages/admin/AdminPedidoDetalle.tsx'))
const AdminProductos = lazy(() => import('./pages/admin/AdminProductos.tsx'))
const AdminProductoForm = lazy(() => import('./pages/admin/AdminProductoForm.tsx'))
const AdminConfiguracion = lazy(() => import('./pages/admin/AdminConfiguracion.tsx'))
const AdminNoEncontrada = lazy(() => import('./pages/admin/AdminNoEncontrada.tsx'))

export default function App() {
  return (
    <Routes>
      {/* Panel: sin el layout de la tienda. AdminRaiz tiene la sesión; AdminLayout exige estar logueado */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<CargandoPanel />}>
            <AdminRaiz />
          </Suspense>
        }
      >
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminPedidos />} />
          <Route path="pedidos/:id" element={<AdminPedidoDetalle />} />
          <Route path="productos" element={<AdminProductos />} />
          <Route path="productos/nuevo" element={<AdminProductoForm />} />
          <Route path="productos/:id" element={<AdminProductoForm />} />
          <Route path="configuracion" element={<AdminConfiguracion />} />
          <Route path="*" element={<AdminNoEncontrada />} />
        </Route>
      </Route>

      {/* Tienda */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/producto/:slug" element={<Producto />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pago/:resultado" element={<PagoResultado />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
