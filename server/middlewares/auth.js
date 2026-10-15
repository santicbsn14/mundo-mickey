import jwt from 'jsonwebtoken'
import { requerirEnv } from '../config/env.js'

/**
 * Exige un JWT válido del admin en `Authorization: Bearer <token>`.
 * Sin token, inválido o vencido → 401. Deja `req.admin = { usuario, expira }`.
 */
export function requiereAdmin(req, res, next) {
  // Si falta JWT_SECRET, requerirEnv tira un Error y el manejador de errores responde 500 con el motivo
  const secreto = requerirEnv('JWT_SECRET')

  const [esquema, token] = (req.get('authorization') ?? '').split(' ')
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Tenés que iniciar sesión.' })
  }

  let datos
  try {
    datos = jwt.verify(token, secreto, { algorithms: ['HS256'] })
  } catch (err) {
    const vencido = err instanceof jwt.TokenExpiredError
    return res.status(401).json({ error: vencido ? 'La sesión venció. Volvé a ingresar.' : 'La sesión no es válida. Volvé a ingresar.' })
  }

  // Un token de otro usuario (por ejemplo, si cambió ADMIN_USER) deja de servir
  if (typeof datos.sub !== 'string' || datos.sub !== process.env.ADMIN_USER) {
    return res.status(401).json({ error: 'La sesión no es válida. Volvé a ingresar.' })
  }

  req.admin = { usuario: datos.sub, expira: new Date(datos.exp * 1000).toISOString() }
  next()
}
