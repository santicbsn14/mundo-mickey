import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout.tsx'
import AdminLayout from './components/admin/AdminLayout.tsx'
import Home from './pages/Home.tsx'
import Producto from './pages/Producto.tsx'
import Checkout from './pages/Checkout.tsx'
import PagoResultado from './pages/PagoResultado.tsx'
import NotFound from './pages/NotFound.tsx'
import AdminLogin from './pages/admin/AdminLogin.tsx'
import AdminPedidos from './pages/admin/AdminPedidos.tsx'
import AdminPedidoDetalle from './pages/admin/AdminPedidoDetalle.tsx'
import AdminProductos from './pages/admin/AdminProductos.tsx'
import AdminProductoForm from './pages/admin/AdminProductoForm.tsx'
import AdminConfiguracion from './pages/admin/AdminConfiguracion.tsx'

export default function App() {
  return (
    <Routes>
      {/* Panel: sin el layout de la tienda */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPedidos />} />
        <Route path="pedidos/:id" element={<AdminPedidoDetalle />} />
        <Route path="productos" element={<AdminProductos />} />
        <Route path="productos/nuevo" element={<AdminProductoForm />} />
        <Route path="productos/:id" element={<AdminProductoForm />} />
        <Route path="configuracion" element={<AdminConfiguracion />} />
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
