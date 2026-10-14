// 404 en JSON para cualquier /api/* que no matcheó una ruta
export function noEncontrado(req, res) {
  res.status(404).json({ error: `No existe ${req.method} ${req.originalUrl}` })
}

// Middleware de errores: Express lo reconoce por tener 4 parámetros
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, req, res, next) {
  console.error(err)
  const status = err.status ?? err.statusCode ?? 500
  const cuerpo = { error: err.message || 'Error interno' }
  if (process.env.VERCEL_ENV !== 'production' && err.stack) {
    cuerpo.stack = err.stack
  }
  res.status(status).json(cuerpo)
}
