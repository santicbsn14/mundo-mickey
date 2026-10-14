const formatoPesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** 34900 → "$34.900" */
export function pesos(n: number): string {
  return `$${formatoPesos.format(n)}`
}
