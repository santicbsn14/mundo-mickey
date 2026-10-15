import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthAdminProvider } from '../../context/AuthAdminContext.tsx'
import CargandoPanel from './CargandoPanel.tsx'

// Todo /admin (login incluido) comparte la sesión. Se carga con lazy desde App.tsx, así que el
// contexto de la sesión no viaja en el chunk de la tienda.
export default function AdminRaiz() {
  return (
    <AuthAdminProvider>
      <Suspense fallback={<CargandoPanel />}>
        <Outlet />
      </Suspense>
    </AuthAdminProvider>
  )
}
