import { conectarDB } from '../config/db.js'
import { anotar } from '../lib/pagos.js'
import { sanityEscritura } from '../lib/sanity.js'
import Pedido, { ESTADOS } from '../models/Pedido.js'

const NO_ENCONTRADO = { error: 'Este pedido no existe.' }
const POR_PAGINA = 20
const MAX_BUSQUEDA = 100
const MAX_NOTA = 2000
const MAX_CODIGO = 40
export const EMPRESAS = ['Correo Argentino', 'Andreani', 'OCA', 'Vía Cargo', 'Otra']

const NOMBRES_ESTADO = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'A preparar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
}

/**
 * Cambios de estado que se pueden hacer desde el panel. Entre pagado, enviado y entregado, en cualquier
 * dirección (para corregir un toque de más). **Nunca a `pagado` desde un pedido sin cobrar:** eso lo decide
 * solo Mercado Pago. Volver a `pagado` se permite solo desde enviado o entregado, que ya están cobrados.
 */
const PERMITIDOS = {
  pendiente_pago: ['cancelado'],
  pagado: ['enviado', 'entregado', 'cancelado'],
  enviado: ['pagado', 'entregado'],
  entregado: ['pagado', 'enviado'],
  rechazado: [],
  cancelado: [],
}

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const esIdValido = (id) => /^[0-9a-f]{24}$/i.test(id)
const nro = (n) => `#${String(n).padStart(4, '0')}`
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const revisar = (nota) => /revisar|sobreventa/i.test(nota ?? '')

// Cada letra sin tilde busca también sus variantes: "nunez" encuentra "Núñez"
const VARIANTES = { a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', n: 'nñ', c: 'cç' }
const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')

function regexSinTildes(palabra) {
  const patron = [...sinTildes(palabra).toLowerCase()]
    .map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}${VARIANTES[ch].toUpperCase()}]` : escaparRegex(ch)))
    .join('')
  return new RegExp(patron, 'i')
}

/**
 * Filtro de la búsqueda `q`: número (`7`, `0007` o `#0007`), nombre o apellido (cada palabra en uno de
 * los dos, sin importar mayúsculas ni tildes), email, DNI o celular (por dígitos).
 */
function filtroBusqueda(q) {
  const texto = typeof q === 'string' ? q.trim().slice(0, MAX_BUSQUEDA) : ''
  if (!texto) return {}

  const o = []
  const numero = texto.match(/^#\s*(\d{1,7})$/) ?? texto.match(/^(\d{1,7})$/)
  if (numero) o.push({ numero: Number(numero[1]) })

  // Solo dígitos y separadores de teléfono: DNI o celular (desde 4 dígitos, para no traer todo con un "7")
  const digitos = texto.replace(/\D/g, '')
  if (!texto.startsWith('#') && /^[\d\s().+-]+$/.test(texto) && digitos.length >= 4) {
    o.push({ 'cliente.dni': { $regex: digitos } }, { 'cliente.celular': { $regex: digitos } })
  }

  if (/[a-zñ]/i.test(sinTildes(texto))) {
    o.push({ 'cliente.email': { $regex: escaparRegex(texto.toLowerCase()), $options: 'i' } })
    const palabras = texto.split(/\s+/).filter(Boolean)
    o.push({
      $and: palabras.map((p) => {
        const re = regexSinTildes(p)
        return { $or: [{ 'cliente.nombre': re }, { 'cliente.apellido': re }] }
      }),
    })
  }

  // Nada que buscar (por ejemplo, "#abc"): no trae ningún pedido
  return o.length ? { $or: o } : { _id: null }
}

/** `estado` del listado: uno del modelo, varios separados por coma (`cancelado,rechazado`) o `todos`. */
function filtroEstado(estado) {
  if (estado === undefined || estado === '') return { filtro: { estado: 'pagado' } }
  if (estado === 'todos') return { filtro: {} }
  const lista = typeof estado === 'string' ? estado.split(',') : []
  if (!lista.length || !lista.every((e) => ESTADOS.includes(e))) return { error: `El estado tiene que ser uno de: ${ESTADOS.join(', ')} o todos.` }
  return { filtro: { estado: lista.length === 1 ? lista[0] : { $in: lista } } }
}

/** Lo que muestra cada tarjeta del listado. */
const resumen = (p) => ({
  _id: p._id,
  numero: p.numero,
  fecha: p.createdAt,
  nombre: p.cliente.nombre,
  apellido: p.cliente.apellido,
  total: p.total,
  tipoEntrega: p.entrega.tipo,
  estado: p.estado,
  cantidad: p.items.reduce((s, i) => s + i.cantidad, 0),
  revisar: revisar(p.notaInterna),
})

/** GET /api/admin/pedidos?estado=&q=&pagina= */
export async function listar(req, res) {
  const { filtro: porEstado, error } = filtroEstado(req.query.estado)
  if (error) return res.status(400).json({ error, campos: { estado: error } })

  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1)
  const busqueda = filtroBusqueda(req.query.q)
  const filtro = { ...busqueda, ...porEstado }

  await conectarDB()
  const [pedidos, total, porEstados] = await Promise.all([
    Pedido.find(filtro, 'numero createdAt cliente.nombre cliente.apellido total entrega.tipo estado items.cantidad notaInterna')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .lean(),
    Pedido.countDocuments(filtro),
    // Los chips: por estado, con la búsqueda pero sin el filtro de estado
    Pedido.aggregate([{ $match: busqueda }, { $group: { _id: '$estado', n: { $sum: 1 } } }]),
  ])

  const conteos = Object.fromEntries(ESTADOS.map((e) => [e, 0]))
  for (const { _id, n } of porEstados) if (_id in conteos) conteos[_id] = n

  res.json({ pedidos: pedidos.map(resumen), total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), conteos })
}

const buscar = (id) => Pedido.findById(id).select('-__v').lean()

/** GET /api/admin/pedidos/:id: el pedido completo. */
export async function ver(req, res) {
  if (!esIdValido(req.params.id)) return res.status(404).json(NO_ENCONTRADO)
  await conectarDB()
  const pedido = await buscar(req.params.id)
  if (!pedido) return res.status(404).json(NO_ENCONTRADO)
  res.json(pedido)
}

/** Valida el cuerpo del PATCH. Devuelve `{ cambios }` (solo lo que vino) o `{ campos }` con los errores. */
function validarCambios(b) {
  const campos = {}
  const cambios = {}

  if (b.estado !== undefined) {
    if (typeof b.estado !== 'string' || !ESTADOS.includes(b.estado)) campos.estado = 'Ese estado no existe.'
    else cambios.estado = b.estado
  }

  if (b.seguimiento !== undefined) {
    if (b.seguimiento === null) {
      cambios.seguimiento = null
    } else if (!esObjeto(b.seguimiento)) {
      campos.seguimiento = 'El seguimiento tiene que traer empresa y código.'
    } else {
      const { empresa = '', codigo = '' } = b.seguimiento
      const e = typeof empresa === 'string' ? empresa.trim() : null
      const c = typeof codigo === 'string' ? codigo.trim() : null
      if (e === null || (e && !EMPRESAS.includes(e))) campos['seguimiento.empresa'] = `Elegí una empresa: ${EMPRESAS.join(', ')}.`
      if (c === null) campos['seguimiento.codigo'] = 'El código tiene que ser un texto.'
      else if (c.length > MAX_CODIGO) campos['seguimiento.codigo'] = `El código puede tener hasta ${MAX_CODIGO} caracteres.`
      else if (c && e === '') campos['seguimiento.empresa'] = 'Elegí la empresa del envío.'
      if (!campos['seguimiento.empresa'] && !campos['seguimiento.codigo']) cambios.seguimiento = e || c ? { empresa: e, codigo: c } : null
    }
  }

  if (b.notaInterna !== undefined) {
    if (b.notaInterna !== null && typeof b.notaInterna !== 'string') {
      campos.notaInterna = 'La nota tiene que ser un texto.'
    } else {
      const nota = (b.notaInterna ?? '').replace(/\r\n/g, '\n').trim()
      if (nota.length > MAX_NOTA) campos.notaInterna = `La nota puede tener hasta ${MAX_NOTA} caracteres.`
      else cambios.notaInterna = nota
    }
  }

  if (b.reponerStock !== undefined) {
    if (typeof b.reponerStock !== 'boolean') campos.reponerStock = 'Tiene que ser sí o no.'
    else cambios.reponerStock = b.reponerStock
  }

  return Object.keys(campos).length ? { campos } : { cambios }
}

const esTransaccionRepetida = (err) => err?.statusCode === 409 && /already exists/i.test(err?.message ?? '')

/**
 * Devuelve al stock de Sanity las cantidades del pedido, en **una sola transacción** con `inc` por ítem y
 * `transactionId` fijo (`reposicion-stock-<pedidoId>`): Sanity rechaza uno repetido, así que se devuelve
 * una sola vez aunque se intente dos veces. Si un producto ya no existe, se anota y se sigue.
 * Devuelve `{ aplicado, devueltos, eliminados }`; `aplicado: false` si ya se había hecho antes.
 */
async function reponerStock(pedido) {
  const cliente = sanityEscritura()
  const porProducto = new Map()
  for (const i of pedido.items) {
    const previo = porProducto.get(i.productoId)
    porProducto.set(i.productoId, { nombre: i.nombre, cantidad: (previo?.cantidad ?? 0) + i.cantidad })
  }

  const existentes = new Set(await cliente.fetch('*[_type == "producto" && _id in $ids]._id', { ids: [...porProducto.keys()] }))
  const devueltos = []
  const eliminados = []
  const tx = cliente.transaction()
  for (const [id, { nombre, cantidad }] of porProducto) {
    if (!existentes.has(id)) {
      eliminados.push(nombre)
      continue
    }
    tx.patch(id, (p) => p.setIfMissing({ stock: 0 }).inc({ stock: cantidad }))
    devueltos.push(`${nombre} +${cantidad}`)
  }

  if (!devueltos.length) return { aplicado: true, devueltos, eliminados }
  try {
    await tx.commit({ transactionId: `reposicion-stock-${pedido._id}`, visibility: 'sync' })
    return { aplicado: true, devueltos, eliminados }
  } catch (err) {
    if (esTransaccionRepetida(err)) return { aplicado: false, devueltos: [], eliminados: [] }
    throw err
  }
}

/** PATCH /api/admin/pedidos/:id con `{ estado?, seguimiento?, notaInterna?, reponerStock? }`. */
export async function editar(req, res) {
  const { id } = req.params
  if (!esIdValido(id)) return res.status(404).json(NO_ENCONTRADO)
  if (!esObjeto(req.body)) return res.status(400).json({ error: 'Mandá los cambios del pedido.', campos: {} })

  const { cambios, campos } = validarCambios(req.body)
  if (campos) return res.status(400).json({ error: 'Revisá los datos del pedido.', campos })

  await conectarDB()
  const actual = await Pedido.findById(id).lean()
  if (!actual) return res.status(404).json(NO_ENCONTRADO)

  const nuevoEstado = cambios.estado !== undefined && cambios.estado !== actual.estado ? cambios.estado : null
  if (nuevoEstado && !PERMITIDOS[actual.estado].includes(nuevoEstado)) {
    const error = nuevoEstado === 'pagado'
      ? 'Un pedido pasa a «A preparar» (pagado) solo cuando Mercado Pago aprueba el pago.'
      : `No se puede pasar un pedido de «${NOMBRES_ESTADO[actual.estado]}» a «${NOMBRES_ESTADO[nuevoEstado]}».`
    return res.status(400).json({ error, campos: { estado: error } })
  }

  const estadoFinal = nuevoEstado ?? actual.estado
  if (cambios.reponerStock && estadoFinal !== 'cancelado') {
    const error = 'El stock se devuelve solo al cancelar el pedido.'
    return res.status(400).json({ error, campos: { reponerStock: error } })
  }

  const set = {}
  const unset = {}
  if (nuevoEstado) set.estado = nuevoEstado
  if (cambios.seguimiento !== undefined) {
    if (cambios.seguimiento) set.seguimiento = cambios.seguimiento
    else unset.seguimiento = 1
  }
  if (cambios.notaInterna !== undefined) {
    if (cambios.notaInterna) set.notaInterna = cambios.notaInterna
    else unset.notaInterna = 1
  }

  const update = {}
  if (Object.keys(set).length) update.$set = set
  if (Object.keys(unset).length) update.$unset = unset
  if (nuevoEstado) update.$push = { historial: { estado: nuevoEstado, fecha: new Date() } }

  if (Object.keys(update).length) {
    // Solo si el estado sigue siendo el que se leyó: dos cambios a la vez no se pisan
    const r = await Pedido.updateOne({ _id: id, estado: actual.estado }, update)
    if (r.matchedCount === 0) {
      return res.status(409).json({ error: 'El pedido cambió mientras lo mirabas. Recargá la página y probá de nuevo.' })
    }
  }

  // Devolver el stock: solo si se descontó y todavía no se devolvió. También sirve para reintentar
  // sobre un pedido ya cancelado, si la primera vez falló Sanity.
  if (cambios.reponerStock && actual.stockDescontado && !actual.stockRepuesto) {
    const n = nro(actual.numero)
    try {
      const { aplicado, devueltos, eliminados } = await reponerStock(actual)
      for (const nombre of eliminados) await anotar(id, `Producto eliminado: ${nombre} (pedido ${n}). No se devolvió su stock.`)
      if (aplicado && devueltos.length) await anotar(id, `Cancelado desde el panel: se devolvió el stock (${devueltos.join(', ')}).`)
      await Pedido.updateOne({ _id: id }, { $set: { stockRepuesto: true } })
    } catch (err) {
      console.error(`Pedido ${n}: no se pudo devolver el stock:`, err?.message ?? err)
      await anotar(id, 'Revisar: no se pudo devolver el stock al cancelar. Probá de nuevo desde el panel.')
      return res.status(502).json({
        error: 'El pedido se canceló, pero no se pudo devolver el stock. Probá de nuevo en un rato.',
        pedido: await buscar(id),
      })
    }
  } else if (nuevoEstado === 'cancelado') {
    await anotar(id, actual.stockDescontado && !actual.stockRepuesto ? 'Cancelado desde el panel, sin devolver el stock.' : 'Cancelado desde el panel.')
  }

  res.json(await buscar(id))
}
