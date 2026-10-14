import { createClient } from '@sanity/client'
import { requerirEnv } from '../config/env.js'

const API_VERSION = '2026-10-01'

// Los clientes se crean en el primer uso y no al importar el módulo: si falta
// una variable, falla el request que los necesita y no el arranque de la API.
let lectura = null
let escritura = null

/** Lectura sin CDN: datos frescos para el admin y el checkout. */
export function sanityLectura() {
  lectura ??= createClient({
    projectId: requerirEnv('SANITY_PROJECT_ID'),
    dataset: requerirEnv('SANITY_DATASET'),
    apiVersion: API_VERSION,
    useCdn: false,
  })
  return lectura
}

/** Escritura con el token Editor. Solo del lado del servidor. */
export function sanityEscritura() {
  escritura ??= createClient({
    projectId: requerirEnv('SANITY_PROJECT_ID'),
    dataset: requerirEnv('SANITY_DATASET'),
    apiVersion: API_VERSION,
    token: requerirEnv('SANITY_WRITE_TOKEN'),
    useCdn: false,
  })
  return escritura
}
