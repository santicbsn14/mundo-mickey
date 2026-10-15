import { sanityEscritura } from '../lib/sanity.js'
import { TIPOS_IMAGEN } from '../middlewares/subida.js'

/** POST /api/admin/imagenes (multipart, campo `imagen`): sube la foto a Sanity → `{ _id, url }`. */
export async function subirImagen(req, res) {
  const { buffer, mimetype } = req.file
  const asset = await sanityEscritura().assets.upload('image', buffer, {
    filename: `producto-${Date.now()}.${TIPOS_IMAGEN[mimetype]}`,
    contentType: mimetype,
  })
  res.status(201).json({ _id: asset._id, url: asset.url })
}
