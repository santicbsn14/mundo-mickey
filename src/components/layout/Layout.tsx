import { Outlet } from 'react-router-dom'
import { CarritoProvider } from '../../context/CarritoContext.tsx'
import CarritoDrawer from '../carrito/CarritoDrawer.tsx'
import Header from './Header.tsx'
import Footer from './Footer.tsx'
import ScrollArriba from './ScrollArriba.tsx'

// El carrito vive solo en la tienda: el panel (/admin) no lo monta
export default function Layout() {
  return (
    <CarritoProvider>
      <ScrollArriba />
      <Header />
      <main id="inicio">
        <Outlet />
      </main>
      <Footer />
      <CarritoDrawer />
    </CarritoProvider>
  )
}
