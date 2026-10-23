// Achica las fotos en el navegador antes de subirlas: Vercel corta los requests de más de 4,5 MB.
// Se suben enteras (sin recortar): el cuadrado de la tienda es solo de CSS.

const LADO_MAXIMO = 1600
const CALIDAD = 0.85
const CALIDAD_REINTENTO = 0.7
const PESO_MAXIMO = 3.5 * 1024 * 1024

export const MENSAJE_FOTO_ILEGIBLE = 'No pudimos leer esta foto. Probá con otra o sacale una captura de pantalla.'

interface Decodificada {
  fuente: CanvasImageSource
  ancho: number
  alto: number
  liberar: () => void
}

/** Con `createImageBitmap`, respetando la rotación EXIF de las fotos del celular. */
async function conBitmap(archivo: File): Promise<Decodificada> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, liberar: () => bitmap.close() }
}

/** Con un `<img>` (los navegadores actuales ya lo dibujan con la rotación EXIF aplicada). */
function conImg(archivo: File): Promise<Decodificada> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () =>
      resolve({ fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('no se pudo decodificar'))
    }
    img.src = url
  })
}

async function decodificar(archivo: File): Promise<Decodificada> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await conBitmap(archivo)
    } catch {
      // algunos navegadores leen con <img> formatos que createImageBitmap no acepta: se prueba igual
    }
  }
  return conImg(archivo)
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad))
}

/** WebP si el navegador lo sabe exportar (si no, `toBlob` devuelve PNG o `null`); si no, JPEG. */
async function exportar(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  const webp = await aBlob(canvas, 'image/webp', calidad)
  if (webp && webp.type === 'image/webp') return webp
  return aBlob(canvas, 'image/jpeg', calidad)
}

/**
 * Lleva la foto a 1600px de lado mayor como máximo (sin agrandarla) y la exporta a WebP 0,85
 * (o JPEG 0,85). Si igual pasa los 3,5 MB, reintenta con 0,7. Si no se puede leer, tira un
 * `Error` con un mensaje para mostrar.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  let imagen: Decodificada
  try {
    imagen = await decodificar(archivo)
  } catch {
    throw new Error(MENSAJE_FOTO_ILEGIBLE)
  }

  try {
    if (!imagen.ancho || !imagen.alto) throw new Error(MENSAJE_FOTO_ILEGIBLE)

    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.ancho, imagen.alto))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(imagen.ancho * escala))
    canvas.height = Math.max(1, Math.round(imagen.alto * escala))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(MENSAJE_FOTO_ILEGIBLE)
    // Fondo blanco: un PNG con transparencia que termine en JPEG no queda negro
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imagen.fuente, 0, 0, canvas.width, canvas.height)

    let blob = await exportar(canvas, CALIDAD)
    if (blob && blob.size > PESO_MAXIMO) blob = (await exportar(canvas, CALIDAD_REINTENTO)) ?? blob
    if (!blob) throw new Error(MENSAJE_FOTO_ILEGIBLE)
    return blob
  } finally {
    imagen.liberar()
  }
}
