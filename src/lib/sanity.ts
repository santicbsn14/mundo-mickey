import { createClient } from '@sanity/client'
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'

const projectId: string | undefined = import.meta.env.VITE_SANITY_PROJECT_ID
const dataset: string | undefined = import.meta.env.VITE_SANITY_DATASET

if (!projectId || !dataset) {
  throw new Error(
    'Faltan VITE_SANITY_PROJECT_ID o VITE_SANITY_DATASET. Cargalas en .env (ver .env.example) y reiniciá Vite.',
  )
}

/** Cliente de solo lectura contra el dataset público, vía CDN. Sin token. */
export const sanity = createClient({
  projectId,
  dataset,
  apiVersion: '2026-10-01',
  useCdn: true,
})

const builder = createImageUrlBuilder(sanity)

/** URL de una imagen de Sanity con el ancho pedido, formato automático y calidad 75. */
export function urlImagen(fuente: SanityImageSource, ancho: number): string {
  return builder.image(fuente).width(ancho).auto('format').quality(75).url()
}
