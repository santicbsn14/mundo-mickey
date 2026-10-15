import multer from 'multer'

const MAXIMO_MB = 4

/** Tipos aceptados → extensión del archivo en Sanity. */
export const TIPOS_IMAGEN = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
}

const MENSAJE_TIPO = 'Solo se aceptan imágenes JPG, WebP o PNG.'

const subir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAXIMO_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (file.mimetype in TIPOS_IMAGEN) return cb(null, true)
    cb(Object.assign(new Error(MENSAJE_TIPO), { status: 400 }))
  },
}).single('imagen')

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: `La imagen pesa más de ${MAXIMO_MB} MB.`,
  LIMIT_FILE_COUNT: 'Subí una sola imagen por vez.',
  LIMIT_UNEXPECTED_FILE: 'La imagen tiene que venir en el campo "imagen", una sola por vez.',
}

/** El tipo real según los primeros bytes, para no confiar solo en el Content-Type que manda el cliente. */
function tipoPorContenido(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/**
 * Un solo archivo en el campo `imagen`, en memoria, hasta 4 MB y solo JPEG, WebP o PNG.
 * Cualquier problema con el archivo es un 400 con un mensaje claro. Deja en `req.file.mimetype` el tipo real.
 */
export function subidaImagen(req, res, next) {
  subir(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: MENSAJES_MULTER[err.code] ?? `No se pudo leer la imagen (${err.message}).` })
    }
    if (err?.status === 400) return res.status(400).json({ error: err.message })
    if (err) return next(err)

    if (!req.file) return res.status(400).json({ error: 'Falta la imagen (campo "imagen").' })

    const tipo = tipoPorContenido(req.file.buffer)
    if (!tipo) return res.status(400).json({ error: `El archivo no es una imagen válida. ${MENSAJE_TIPO}` })
    req.file.mimetype = tipo
    next()
  })
}
