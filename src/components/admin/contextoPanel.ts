import { useOutletContext } from 'react-router-dom'

/** Lo que AdminLayout comparte con las pantallas del panel (por el contexto del `Outlet`). */
export interface ContextoPanel {
  /** El listado ya sabe cuántos pedidos hay a preparar: actualiza el número de la barra sin otro request. */
  setAPreparar: (n: number) => void
  /** Vuelve a pedir el número (después de cambiar el estado de un pedido). */
  refrescarAPreparar: () => void
}

export const useContextoPanel = () => useOutletContext<ContextoPanel>()
