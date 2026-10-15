import { createClient, type SanityClient } from '@sanity/client'
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'

let cliente: SanityClient | undefined
let builder: ReturnType<typeof createImageUrlBuilder> | undefined

/**
 * Cliente de solo lectura contra el dataset público, vía CDN. Sin token.
 * Se crea en el primer uso: si faltan las variables, el error lo recibe quien llama
 * (las queries) y el resto de la app sigue andando.
 */
export function sanity(): SanityClient {
  if (cliente) return cliente

  const projectId: string | undefined = import.meta.env.VITE_SANITY_PROJECT_ID
  const dataset: string | undefined = import.meta.env.VITE_SANITY_DATASET
  if (!projectId || !dataset) {
    throw new Error(
      'Faltan VITE_SANITY_PROJECT_ID o VITE_SANITY_DATASET. Cargalas en .env (ver .env.example) y reiniciá Vite.',
    )
  }

  cliente = createClient({
    projectId,
    dataset,
    apiVersion: '2026-10-01',
    useCdn: true,
  })
  return cliente
}

/** URL de una imagen de Sanity con el ancho pedido, formato automático y calidad 75. */
export function urlImagen(fuente: SanityImageSource, ancho: number): string {
  builder ??= createImageUrlBuilder(sanity())
  return builder.image(fuente).width(ancho).auto('format').quality(75).url()
}
