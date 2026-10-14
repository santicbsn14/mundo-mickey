/**
 * Devuelve el valor de una variable de entorno o tira un Error si falta.
 * No usa process.exit: en serverless eso mata la función entera.
 */
export function requerirEnv(nombre) {
  const valor = process.env[nombre]
  if (valor === undefined || valor.trim() === '') {
    throw new Error(`Falta la variable de entorno ${nombre}`)
  }
  return valor
}
