import { Outlet } from 'react-router-dom'
import Header from './Header.tsx'
import Footer from './Footer.tsx'

export default function Layout() {
  return (
    <>
      <Header />
      <main id="inicio">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
