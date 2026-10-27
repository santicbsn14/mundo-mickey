import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { ItemCarrito, ProblemaStock } from '../../context/CarritoContext.tsx'
import { ErrorApi, apiPost } from '../../lib/api.ts'
import { costoEnvio, pesos } from '../../lib/formato.ts'
import { PROVINCIAS } from '../../lib/provincias.ts'
import type { Configuracion } from '../../types/configuracion.ts'
import './FormCheckout.css'

export type TipoEntrega = 'retiro' | 'envio_local' | 'envio_nacional'

interface Valores {
  nombre: string
  apellido: string
  dni: string
  celular: string
  email: string
  tipo: TipoEntrega
  calle: string
  numero: string
  pisoDepto: string
  codigoPostal: string
  localidad: string
  provincia: string
  notas: string
}

const VACIOS: Valores = {
  nombre: '',
  apellido: '',
  dni: '',
  celular: '',
  email: '',
  tipo: 'retiro',
  calle: '',
  numero: '',
  pisoDepto: '',
  codigoPostal: '',
  localidad: '',
  provincia: '',
  notas: '',
}

// Lo escrito queda en sessionStorage (no en localStorage): sobrevive a recargar y a volver de Mercado Pago,
// pero no queda en el navegador después de cerrar la pestaña
const CLAVE_DATOS = 'mundo-mickey:checkout'
const CLAVE_ULTIMO_PEDIDO = 'mundo-mickey:ultimo-pedido'
const TIPOS: TipoEntrega[] = ['retiro', 'envio_local', 'envio_nacional']

function leerGuardado(): Valores {
  try {
    const crudo = sessionStorage.getItem(CLAVE_DATOS)
    if (!crudo) return VACIOS
    const guardado: unknown = JSON.parse(crudo)
    if (typeof guardado !== 'object' || guardado === null) return VACIOS
    const g = guardado as Record<string, unknown>
    const valores = { ...VACIOS }
    for (const clave of Object.keys(VACIOS) as (keyof Valores)[]) {
      if (typeof g[clave] === 'string') (valores as Record<string, string>)[clave] = g[clave]
    }
    if (!TIPOS.includes(valores.tipo)) valores.tipo = 'retiro'
    return valores
  } catch {
    return VACIOS
  }
}

function guardar(valores: Valores) {
  try {
    sessionStorage.setItem(CLAVE_DATOS, JSON.stringify(valores))
  } catch {
    // Sin sessionStorage: el formulario anda igual, solo no se recuerda
  }
}

/**
 * Los dígitos de después del +54 9, con la misma regla que el WhatsApp del panel: si pegaron el número
 * completo (con 54, 549 o el 0 del código de área), se los saca.
 */
function digitosCelular(texto: string): string {
  let d = texto.replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  return d.replace(/^0+/, '')
}

interface Campo {
  valor: keyof Valores
  /** La clave de los errores de la API. */
  api: string
  vacio: string
  /** Solo con estos tipos de entrega (si no, siempre). */
  con?: TipoEntrega[]
  opcional?: boolean
}

const CON_ENVIO: TipoEntrega[] = ['envio_local', 'envio_nacional']

// En el orden en que aparecen: el foco va al primero con error
const CAMPOS: Campo[] = [
  { valor: 'nombre', api: 'cliente.nombre', vacio: 'Completá tu nombre.' },
  { valor: 'apellido', api: 'cliente.apellido', vacio: 'Completá tu apellido.' },
  { valor: 'dni', api: 'cliente.dni', vacio: 'Completá tu DNI.' },
  { valor: 'celular', api: 'cliente.celular', vacio: 'Completá tu celular.' },
  { valor: 'email', api: 'cliente.email', vacio: 'Completá tu email.' },
  { valor: 'tipo', api: 'entrega.tipo', vacio: 'Elegí cómo querés recibir el pedido.' },
  { valor: 'calle', api: 'entrega.direccion.calle', vacio: 'Completá la calle.', con: CON_ENVIO },
  { valor: 'numero', api: 'entrega.direccion.numero', vacio: 'Completá el número.', con: CON_ENVIO },
  { valor: 'pisoDepto', api: 'entrega.direccion.pisoDepto', vacio: '', con: CON_ENVIO, opcional: true },
  { valor: 'localidad', api: 'entrega.direccion.localidad', vacio: 'Completá la localidad.', con: ['envio_nacional'] },
  { valor: 'provincia', api: 'entrega.direccion.provincia', vacio: 'Elegí la provincia.', con: ['envio_nacional'] },
  { valor: 'codigoPostal', api: 'entrega.direccion.codigoPostal', vacio: 'Completá el código postal.', con: CON_ENVIO },
  { valor: 'notas', api: 'entrega.notas', vacio: '', opcional: true },
]

const idCampo = (api: string) => `ck-${api.replaceAll('.', '-')}`
const idError = (api: string) => `${idCampo(api)}-error`
const idAyuda = (api: string) => `${idCampo(api)}-ayuda`

/** Lo que recibe `POST /api/pagos/checkout`: sin precios. */
function cuerpo(v: Valores, tipo: TipoEntrega, items: ItemCarrito[]) {
  const conEnvio = tipo !== 'retiro'
  return {
    items: items.map((i) => ({ id: i.productoId, cantidad: i.cantidad })),
    cliente: { nombre: v.nombre, apellido: v.apellido, dni: v.dni, celular: digitosCelular(v.celular), email: v.email },
    entrega: {
      tipo,
      ...(conEnvio && {
        direccion: {
          calle: v.calle,
          numero: v.numero,
          pisoDepto: v.pisoDepto,
          codigoPostal: v.codigoPostal,
          ...(tipo === 'envio_nacional' && { localidad: v.localidad, provincia: v.provincia }),
        },
      }),
      notas: v.notas,
    },
  }
}

interface RespuestaCheckout {
  pedidoId: string
  numero: number
  initPoint: string
}

interface Props {
  items: ItemCarrito[]
  configuracion: Configuracion | null
  cargandoConfiguracion: boolean
  total: number
  /** El tipo de entrega elegido (ya acotado a los habilitados), para el resumen. */
  onTipo: (tipo: TipoEntrega) => void
  /** 409: algunos productos cambiaron. */
  onConflicto: (problemas: ProblemaStock[]) => void
}

export default function FormCheckout({ items, configuracion, cargandoConfiguracion, total, onTipo, onConflicto }: Props) {
  const [v, setV] = useState<Valores>(leerGuardado)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const alerta = useRef<HTMLDivElement>(null)

  useEffect(() => guardar(v), [v])

  // Volver de Mercado Pago con "atrás" puede restaurar la página tal cual (bfcache), con el botón deshabilitado
  useEffect(() => {
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) setEnviando(false)
    }
    window.addEventListener('pageshow', alMostrar)
    return () => window.removeEventListener('pageshow', alMostrar)
  }, [])

  const local = configuracion?.envioLocal
  const nacional = configuracion?.envioNacional
  const disponibles: TipoEntrega[] = [
    'retiro',
    ...(local?.habilitado ? (['envio_local'] as const) : []),
    ...(nacional?.habilitado ? (['envio_nacional'] as const) : []),
  ]
  // Mientras carga la configuración se respeta lo guardado; después, si ya no está habilitado, retiro
  const tipo: TipoEntrega = cargandoConfiguracion || disponibles.includes(v.tipo) ? v.tipo : 'retiro'

  useEffect(() => onTipo(tipo), [tipo, onTipo])

  function cambiar(campo: keyof Valores, valor: string, api: string) {
    setV((a) => ({ ...a, [campo]: valor }))
    if (errores[api]) setErrores(({ [api]: _, ...resto }) => resto)
  }

  /** Muestra los errores y lleva el foco al primer campo con error (o al recuadro de error). */
  function mostrarErrores(campos: Record<string, string>, general: string | null) {
    flushSync(() => {
      setErrores(campos)
      setErrorGeneral(general)
    })
    const primero = CAMPOS.find((c) => campos[c.api])
    const destino = (primero && document.getElementById(idCampo(primero.api))) || alerta.current
    destino?.focus()
    destino?.scrollIntoView({ block: 'center' })
  }

  async function pagar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando || items.length === 0) return

    // Mínimo en el front: que no falte nada. El resto lo valida la API
    const vacios: Record<string, string> = {}
    for (const c of CAMPOS) {
      if (c.opcional || (c.con && !c.con.includes(tipo))) continue
      if (!String(v[c.valor]).trim()) vacios[c.api] = c.vacio
    }
    if (Object.keys(vacios).length) return mostrarErrores(vacios, 'Faltan algunos datos. Revisá los campos marcados.')

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const r = await apiPost<RespuestaCheckout>('/pagos/checkout', cuerpo(v, tipo, items))
      try {
        sessionStorage.setItem(CLAVE_ULTIMO_PEDIDO, JSON.stringify({ pedidoId: r.pedidoId, numero: r.numero }))
      } catch {
        // sin sessionStorage: /pago/:resultado usa el ?pedido= de la URL
      }
      // El carrito no se vacía acá: se vacía cuando /pago/exito confirma el pago (brief 09)
      window.location.assign(r.initPoint)
    } catch (err) {
      setEnviando(false)
      if (!(err instanceof ErrorApi)) return mostrarErrores({}, 'Algo salió mal. Probá de nuevo.')

      if (err.status === 409) {
        const problemas = (err.datos as { items?: unknown } | null)?.items
        setErrores({})
        onConflicto(Array.isArray(problemas) ? (problemas as ProblemaStock[]) : [])
        return
      }
      if (err.status === 400) {
        // Un error sin campo en pantalla (por ejemplo, de los ítems) va en el recuadro
        const sinCampo = Object.entries(err.campos)
          .filter(([clave]) => !CAMPOS.some((c) => c.api === clave))
          .map(([, mensaje]) => mensaje)
        return mostrarErrores(err.campos, [err.message, ...sinCampo].join(' '))
      }
      mostrarErrores({}, err.message)
    }
  }

  // ---------- Campos ----------

  const props = (api: string, ayuda = false) => {
    const describe = [ayuda && idAyuda(api), errores[api] && idError(api)].filter(Boolean).join(' ')
    return {
      id: idCampo(api),
      'aria-invalid': errores[api] ? true : undefined,
      'aria-describedby': describe || undefined,
    }
  }
  const error = (api: string) =>
    errores[api] && (
      <p id={idError(api)} className="ck-campo__error">
        {errores[api]}
      </p>
    )

  function campoTexto(c: { valor: keyof Valores; api: string; etiqueta: ReactNode; ayuda?: string; opcional?: boolean } & Record<string, unknown>) {
    const { valor, api, etiqueta, ayuda, opcional, ...resto } = c
    return (
      <div className="ck-campo">
        <label className="ck-campo__label" htmlFor={idCampo(api)}>
          {etiqueta}
          {opcional && <span className="ck-campo__opcional"> (opcional)</span>}
        </label>
        <input
          {...props(api, Boolean(ayuda))}
          className="ck-campo__input"
          type="text"
          value={v[valor]}
          onChange={(e) => cambiar(valor, e.target.value, api)}
          {...resto}
        />
        {ayuda && (
          <p className="ck-campo__ayuda" id={idAyuda(api)}>
            {ayuda}
          </p>
        )}
        {error(api)}
      </div>
    )
  }

  const direccion = configuracion?.direccion?.trim()
  const horarios = configuracion?.horarios?.trim()

  const opciones: { tipo: TipoEntrega; titulo: string; costo: string; textos: string[] }[] = [
    { tipo: 'retiro', titulo: 'Retiro en el local', costo: 'Gratis', textos: [direccion, horarios].filter((t): t is string => Boolean(t)) },
    ...(local?.habilitado
      ? [{ tipo: 'envio_local' as const, titulo: 'Envío en San Nicolás', costo: costoEnvio(local.costo ?? 0), textos: [local.texto?.trim()].filter((t): t is string => Boolean(t)) }]
      : []),
    ...(nacional?.habilitado
      ? [{ tipo: 'envio_nacional' as const, titulo: 'Envío a todo el país', costo: 'A coordinar', textos: [nacional.texto?.trim()].filter((t): t is string => Boolean(t)) }]
      : []),
  ]

  return (
    <form className="ck-form" onSubmit={pagar} noValidate>
      {/* ---------- 1. Tus datos ---------- */}
      <section className="ck-bloque" aria-labelledby="ck-datos-titulo">
        <h2 className="ck-bloque__titulo" id="ck-datos-titulo">
          <span className="ck-bloque__numero" aria-hidden="true">1</span> Tus datos
        </h2>
        <div className="ck-fila">
          {campoTexto({ valor: 'nombre', api: 'cliente.nombre', etiqueta: 'Nombre', autoComplete: 'given-name', maxLength: 60 })}
          {campoTexto({ valor: 'apellido', api: 'cliente.apellido', etiqueta: 'Apellido', autoComplete: 'family-name', maxLength: 60 })}
        </div>
        {campoTexto({
          valor: 'dni',
          api: 'cliente.dni',
          etiqueta: 'DNI',
          ayuda: 'Lo piden los correos para enviar.',
          inputMode: 'numeric',
          maxLength: 12,
          onChange: (e: ChangeEvent<HTMLInputElement>) => cambiar('dni', e.target.value.replace(/[^\d.\s]/g, ''), 'cliente.dni'),
        })}

        <div className="ck-campo">
          <label className="ck-campo__label" htmlFor={idCampo('cliente.celular')}>
            Celular<span className="ck-oculto">, después del +54 9</span>
          </label>
          <div className="ck-prefijado">
            <span className="ck-prefijado__prefijo" aria-hidden="true">
              +54 9
            </span>
            <input
              {...props('cliente.celular', true)}
              className="ck-campo__input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={20}
              value={v.celular}
              onChange={(e) => cambiar('celular', e.target.value.replace(/[^\d\s()+-]/g, ''), 'cliente.celular')}
              onBlur={() =>
                setV((a) => {
                  // Si pegaron el número completo, queda solo lo de después del +54 9
                  const d = digitosCelular(a.celular)
                  return d === a.celular.replace(/\D/g, '') ? a : { ...a, celular: d }
                })
              }
            />
          </div>
          <p className="ck-campo__ayuda" id={idAyuda('cliente.celular')}>
            Código de área sin 0 y número sin 15. Ej.: 336 412 3456
          </p>
          {error('cliente.celular')}
        </div>

        {campoTexto({ valor: 'email', api: 'cliente.email', etiqueta: 'Email', type: 'email', autoComplete: 'email', maxLength: 120 })}
      </section>

      {/* ---------- 2. Entrega ---------- */}
      <section className="ck-bloque" aria-labelledby="ck-entrega-titulo">
        <h2 className="ck-bloque__titulo" id="ck-entrega-titulo">
          <span className="ck-bloque__numero" aria-hidden="true">2</span> Entrega
        </h2>

        <fieldset className="ck-entrega" aria-describedby={errores['entrega.tipo'] ? idError('entrega.tipo') : undefined}>
          <legend className="ck-campo__label">¿Cómo lo querés recibir?</legend>
          {opciones.map((o, i) => (
            <label key={o.tipo} className="ck-entrega__opcion">
              <input
                type="radio"
                name="entrega"
                value={o.tipo}
                id={i === 0 ? idCampo('entrega.tipo') : undefined}
                aria-invalid={errores['entrega.tipo'] ? true : undefined}
                checked={tipo === o.tipo}
                onChange={() => cambiar('tipo', o.tipo, 'entrega.tipo')}
              />
              <span className="ck-entrega__cabecera">
                <span className="ck-entrega__titulo">{o.titulo}</span>
                <span className="ck-entrega__costo">{o.costo}</span>
              </span>
              {o.textos.map((t) => (
                <span key={t} className="ck-entrega__texto">
                  {t}
                </span>
              ))}
            </label>
          ))}
          {cargandoConfiguracion && <p className="ck-campo__ayuda">Cargando las formas de envío…</p>}
          {error('entrega.tipo')}
        </fieldset>

        {tipo !== 'retiro' && (
          <div className="ck-direccion">
            <p className="ck-direccion__titulo">{tipo === 'envio_local' ? 'Dirección en San Nicolás' : 'Dirección de envío'}</p>
            <div className="ck-fila ck-fila--calle">
              {campoTexto({ valor: 'calle', api: 'entrega.direccion.calle', etiqueta: 'Calle', autoComplete: 'address-line1', maxLength: 80 })}
              {campoTexto({ valor: 'numero', api: 'entrega.direccion.numero', etiqueta: 'Número', maxLength: 10 })}
            </div>
            <div className="ck-fila">
              {campoTexto({ valor: 'pisoDepto', api: 'entrega.direccion.pisoDepto', etiqueta: 'Piso / depto', opcional: true, autoComplete: 'address-line2', maxLength: 20 })}
              {campoTexto({ valor: 'codigoPostal', api: 'entrega.direccion.codigoPostal', etiqueta: 'Código postal', autoComplete: 'postal-code', maxLength: 8 })}
            </div>
            {tipo === 'envio_nacional' && (
              <div className="ck-fila">
                {campoTexto({ valor: 'localidad', api: 'entrega.direccion.localidad', etiqueta: 'Localidad', autoComplete: 'address-level2', maxLength: 80 })}
                <div className="ck-campo">
                  <label className="ck-campo__label" htmlFor={idCampo('entrega.direccion.provincia')}>
                    Provincia
                  </label>
                  <select
                    {...props('entrega.direccion.provincia')}
                    className="ck-campo__input ck-campo__select"
                    autoComplete="address-level1"
                    value={v.provincia}
                    onChange={(e) => cambiar('provincia', e.target.value, 'entrega.direccion.provincia')}
                  >
                    <option value="">Elegí una</option>
                    {PROVINCIAS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {error('entrega.direccion.provincia')}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="ck-campo">
          <label className="ck-campo__label" htmlFor={idCampo('entrega.notas')}>
            Notas<span className="ck-campo__opcional"> (opcional)</span>
          </label>
          <textarea
            {...props('entrega.notas', true)}
            className="ck-campo__input ck-campo__textarea"
            rows={3}
            maxLength={300}
            value={v.notas}
            onChange={(e) => cambiar('notas', e.target.value, 'entrega.notas')}
          />
          <p className="ck-campo__ayuda" id={idAyuda('entrega.notas')}>
            ¿Algo que tengamos que saber? (horario para recibir, referencias)
          </p>
          {error('entrega.notas')}
        </div>
      </section>

      {/* ---------- 3. Pago ---------- */}
      <section className="ck-bloque" aria-labelledby="ck-pago-titulo">
        <h2 className="ck-bloque__titulo" id="ck-pago-titulo">
          <span className="ck-bloque__numero" aria-hidden="true">3</span> Pago
        </h2>
        <div className="ck-total">
          <span>Total</span>
          <strong>{pesos(total)}</strong>
        </div>
        {tipo === 'envio_nacional' && <p className="ck-campo__ayuda">El envío no está incluido: lo coordinamos por WhatsApp.</p>}

        <div ref={alerta} tabIndex={-1} className="ck-alerta" role="alert" hidden={!errorGeneral}>
          {errorGeneral}
        </div>

        <button type="submit" className="ck-pagar" disabled={enviando}>
          {enviando ? 'Te estamos llevando a Mercado Pago…' : 'Pagar con Mercado Pago'}
        </button>
        <p className="ck-nota">Te llevamos a Mercado Pago para pagar de forma segura.</p>
        <p className="ck-privacidad">Usamos tus datos solo para preparar y entregar tu pedido.</p>
      </section>
    </form>
  )
}
