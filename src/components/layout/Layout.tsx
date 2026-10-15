import { Outlet } from 'react-router-dom'
import Header from './Header.tsx'
import Footer from './Footer.tsx'
import ScrollArriba from './ScrollArriba.tsx'

export default function Layout() {
  return (
    <>
      <ScrollArriba />
      <Header />
      <main id="inicio">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
