import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { requerirEnv } from '../config/env.js'

const DURACION = '12h'
const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos'

// Hash de relleno (de una contraseña al azar que nadie conoce): con un usuario incorrecto
// también se corre bcrypt, así la respuesta tarda lo mismo y no delata cuál de los dos falló.
// Se calcula en el primer login, no al importar, para no sumarle ~250 ms a cada arranque en frío.
let hashRelleno = null
const obtenerHashRelleno = () => (hashRelleno ??= bcrypt.hash(crypto.randomUUID(), 12))

/** POST /api/admin/login con `{ usuario, password }` → `{ token, expira }`. */
export async function login(req, res) {
  const usuarioAdmin = requerirEnv('ADMIN_USER')
  const hashAdmin = requerirEnv('ADMIN_PASSWORD_HASH')
  const secreto = requerirEnv('JWT_SECRET')

  const { usuario, password } = req.body ?? {}
  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario || !password) {
    return res.status(401).json({ error: MENSAJE_CREDENCIALES })
  }

  const usuarioOk = usuario === usuarioAdmin
  const passwordOk = await bcrypt.compare(password, usuarioOk ? hashAdmin : await obtenerHashRelleno())
  if (!usuarioOk || !passwordOk) {
    return res.status(401).json({ error: MENSAJE_CREDENCIALES })
  }

  const token = jwt.sign({}, secreto, { algorithm: 'HS256', expiresIn: DURACION, subject: usuarioAdmin })
  const { exp } = jwt.decode(token)
  res.json({ token, expira: new Date(exp * 1000).toISOString() })
}

/** GET /api/admin/sesion: el front lo usa para validar el token guardado. */
export function sesion(req, res) {
  res.json(req.admin)
}
