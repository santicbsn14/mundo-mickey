const formatoPesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** 34900 → "$34.900" */
export function pesos(n: number): string {
  return `$${formatoPesos.format(n)}`
}

/** Costo de un envío: 0 → "Gratis", si no, en pesos. */
export function costoEnvio(n: number): string {
  return n === 0 ? 'Gratis' : pesos(n)
}
