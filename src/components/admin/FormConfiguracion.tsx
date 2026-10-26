import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { apiGet, apiPut, ErrorApi } from '../../lib/api.ts'
import { pesos } from '../../lib/formato.ts'
import { AVISO_CDN } from '../../lib/productosAdmin.ts'
import type { Configuracion } from '../../types/configuracion.ts'
import './FormConfiguracion.css'

const MAX_MARQUESINA = 10
const MAX_TEXTO_MARQUESINA = 40
// Prefijo de wa.me para los celulares de Argentina: el dueño escribe el resto
const PREFIJO_WHATSAPP = '549'

/** Fila de la marquesina: `id` solo para React, así no se remontan los inputs al moverlas. */
interface Texto {
  id: number
  texto: string
}

interface Valores {
  /** Sin el 549: código de área y número, como los escribieron. */
  whatsapp: string
  instagram: string
  direccion: string
  horarios: string
  mapaUrl: string
  localHabilitado: boolean
  /** Como lo escribieron: acepta `3000` o `3.000`. */
  localCosto: string
  localTexto: string
  nacionalHabilitado: boolean
  nacionalTexto: string
  marquesina: Texto[]
}

let siguienteId = 0

function valoresDesde(c: Configuracion): Valores {
  const whatsapp = c.whatsapp ?? ''
  return {
    whatsapp: whatsapp.startsWith(PREFIJO_WHATSAPP) ? whatsapp.slice(PREFIJO_WHATSAPP.length) : whatsapp,
    instagram: c.instagram ?? '',
    direccion: c.direccion ?? '',
    horarios: c.horarios ?? '',
    mapaUrl: c.mapaUrl ?? '',
    localHabilitado: c.envioLocal.habilitado,
    localCosto: pesos(c.envioLocal.costo).slice(1), // 3000 → "3.000", como lo escribiría el dueño
    localTexto: c.envioLocal.texto ?? '',
    nacionalHabilitado: c.envioNacional.habilitado,
    nacionalTexto: c.envioNacional.texto ?? '',
    marquesina: (c.marquesina ?? []).map((texto) => ({ id: siguienteId++, texto })),
  }
}

/**
 * Los dígitos de después del +54 9. Si pegaron el número completo (con 54, 549 o el 0 del
 * código de área), se los saca: ningún código de área de Argentina empieza con 5 ni con 0.
 */
function digitosWhatsapp(texto: string): string {
  let d = texto.replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  return d.replace(/^0+/, '')
}

/** El número para `wa.me`: `549` + los dígitos, o vacío. */
function whatsappCompleto(texto: string): string {
  const d = digitosWhatsapp(texto)
  return d ? PREFIJO_WHATSAPP + d : ''
}

// Mismo formato que valida la API: 549 + 9 o 10 dígitos
const whatsappValido = (numero: string) => /^549\d{9,10}$/.test(numero)

/** `@usuario`, `usuario` o un link de instagram.com/usuario/ → `usuario`. */
function usuarioInstagram(texto: string): string {
  let t = texto.trim()
  const usuario = t.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i)?.[1]
  if (usuario) t = usuario
  return t.replace(/^@+/, '')
}

/** `3.000` o `3000` → 3000. Cualquier otra cosa → `null` (la API responde con el error del campo). */
function aEntero(texto: string): number | null {
  const limpio = texto.replace(/[.\s]/g, '')
  return /^\d+$/.test(limpio) ? Number(limpio) : null
}

/** Lo que recibe `PUT /api/admin/configuracion`. Los envíos apagados mandan igual sus valores. */
function cuerpo(v: Valores) {
  return {
    whatsapp: whatsappCompleto(v.whatsapp),
    instagram: usuarioInstagram(v.instagram),
    direccion: v.direccion,
    horarios: v.horarios,
    mapaUrl: v.mapaUrl,
    envioLocal: { habilitado: v.localHabilitado, costo: aEntero(v.localCosto), texto: v.localTexto },
    envioNacional: { habilitado: v.nacionalHabilitado, texto: v.nacionalTexto },
    // Las filas tal cual, también las vacías: la API las descarta y marca los errores por posición
    marquesina: v.marquesina.map((t) => t.texto),
  }
}

// Campos en el orden en que aparecen: el foco va al primero con error. Las claves son las de la API;
// después de estos van los textos de la marquesina (`marquesina.0`, `marquesina.1`…).
const CAMPOS = [
  'whatsapp',
  'instagram',
  'direccion',
  'horarios',
  'mapaUrl',
  'envioLocal.habilitado',
  'envioLocal.costo',
  'envioLocal.texto',
  'envioNacional.habilitado',
  'envioNacional.texto',
  'marquesina',
]
const idCampo = (c: string) => `fc-${c.replace('.', '-')}`
const idError = (c: string) => `${idCampo(c)}-error`
const idAyuda = (c: string) => `${idCampo(c)}-ayuda`

type Carga = { estado: 'cargando' } | { estado: 'listo'; configuracion: Configuracion } | { estado: 'error'; mensaje: string }

/** `/admin/configuracion`: carga la configuración y muestra el formulario. */
export default function FormConfiguracion() {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCarga({ estado: 'cargando' })
    apiGet<Configuracion>('/admin/configuracion')
      .then((configuracion) => vigente && setCarga({ estado: 'listo', configuracion }))
      .catch((err) => vigente && setCarga({ estado: 'error', mensaje: err instanceof ErrorApi ? err.message : 'Algo salió mal.' }))
    return () => {
      vigente = false
    }
  }, [intento])

  if (carga.estado === 'listo') return <Formulario configuracion={carga.configuracion} />

  return (
    <section className="admin-vacia">
      {carga.estado === 'cargando' ? (
        <p className="adm-estado" role="status">
          Cargando configuración…
        </p>
      ) : (
        <>
          <h1>No se pudo cargar la configuración</h1>
          <div className="adm-estado-error">
            <div className="adm-alerta" role="alert">
              {carga.mensaje}
            </div>
            <button type="button" className="adm-btn" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function Formulario({ configuracion }: { configuracion: Configuracion }) {
  // Lo último guardado: contra eso se comparan los cambios
  const [guardada, setGuardada] = useState(configuracion)
  const [v, setV] = useState<Valores>(() => valoresDesde(configuracion))
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const alerta = useRef<HTMLDivElement>(null)
  const refAviso = useRef<HTMLDivElement>(null)
  // Fila recién agregada: recibe el foco al aparecer
  const enfocarFila = useRef<number | null>(null)

  const base = useMemo(() => JSON.stringify(cuerpo(valoresDesde(guardada))), [guardada])
  const cambiado = JSON.stringify(cuerpo(v)) !== base

  useEffect(() => {
    if (!cambiado) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // navegadores viejos
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambiado])

  const quitarError = useCallback((clave: string) => {
    setErrores((anteriores) => {
      if (!anteriores[clave]) return anteriores
      const { [clave]: _, ...resto } = anteriores
      return resto
    })
  }, [])

  function cambiar<K extends keyof Valores>(campo: K, valor: Valores[K], clave: string) {
    setV((anterior) => ({ ...anterior, [campo]: valor }))
    quitarError(clave)
  }

  // ---------- Marquesina ----------

  /** Mover, agregar o quitar filas cambia las posiciones: los errores por fila ya no corresponden. */
  function cambiarFilas(filas: Texto[]) {
    setV((anterior) => ({ ...anterior, marquesina: filas }))
    setErrores((anteriores) => Object.fromEntries(Object.entries(anteriores).filter(([c]) => !c.startsWith('marquesina'))))
  }

  function mover(i: number, delta: number) {
    const filas = [...v.marquesina]
    const [fila] = filas.splice(i, 1)
    if (!fila) return
    filas.splice(i + delta, 0, fila)
    cambiarFilas(filas)
  }

  function agregar() {
    if (v.marquesina.length >= MAX_MARQUESINA) return
    const id = siguienteId++
    enfocarFila.current = id
    cambiarFilas([...v.marquesina, { id, texto: '' }])
  }

  function editarTexto(id: number, clave: string, texto: string) {
    setV((anterior) => ({ ...anterior, marquesina: anterior.marquesina.map((f) => (f.id === id ? { ...f, texto } : f)) }))
    quitarError(clave)
  }

  useEffect(() => {
    if (enfocarFila.current === null) return
    const i = v.marquesina.findIndex((t) => t.id === enfocarFila.current)
    enfocarFila.current = null
    if (i >= 0) document.getElementById(idCampo(`marquesina.${i}`))?.focus()
  }, [v.marquesina])

  // ---------- Guardar ----------

  /** Muestra los errores y lleva el foco al primer campo con error (o a la alerta general). */
  function mostrarErrores(campos: Record<string, string>, general: string | null) {
    flushSync(() => {
      setErrores(campos)
      setErrorGeneral(general)
    })
    const orden = [...CAMPOS, ...v.marquesina.map((_, i) => `marquesina.${i}`)]
    const primero = orden.find((c) => campos[c])
    const destino = (primero && document.getElementById(idCampo(primero))) || alerta.current
    destino?.focus()
    destino?.scrollIntoView({ block: 'center' })
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (guardando) return

    setGuardando(true)
    setErrorGeneral(null)
    setAviso(null)
    try {
      const nueva = await apiPut<Configuracion>('/admin/configuracion', cuerpo(v))
      flushSync(() => {
        setGuardada(nueva)
        setV(valoresDesde(nueva))
        setErrores({})
        setGuardando(false)
        setAviso(`Listo, se guardó la configuración. ${AVISO_CDN}`)
      })
      refAviso.current?.focus()
      refAviso.current?.scrollIntoView({ block: 'center' })
    } catch (err) {
      setGuardando(false)
      if (err instanceof ErrorApi) mostrarErrores(err.campos, err.message)
      else mostrarErrores({}, 'No se pudo guardar. Probá de nuevo.')
    }
  }

  // ---------- Campos ----------

  const props = (c: string) => ({
    id: idCampo(c),
    'aria-invalid': errores[c] ? true : undefined,
    'aria-describedby': errores[c] ? idError(c) : undefined,
  })
  /** Igual que `props`, para un campo con una ayuda debajo. */
  const conAyuda = (c: string) => ({
    ...props(c),
    'aria-describedby': errores[c] ? `${idAyuda(c)} ${idError(c)}` : idAyuda(c),
  })
  const error = (c: string) =>
    errores[c] && (
      <p id={idError(c)} className="adm-error-campo">
        {errores[c]}
      </p>
    )

  const numeroWhatsapp = whatsappCompleto(v.whatsapp)
  const costo = aEntero(v.localCosto)
  const textosMarquesina = v.marquesina.map((t) => t.texto.trim()).filter(Boolean)
  const llenaMarquesina = v.marquesina.length >= MAX_MARQUESINA
  // Un envío apagado oculta sus campos (que conservan sus valores), salvo que alguno tenga un error
  const verLocal = v.localHabilitado || !!errores['envioLocal.costo'] || !!errores['envioLocal.texto']
  const verNacional = v.nacionalHabilitado || !!errores['envioNacional.texto']

  return (
    <div className="fc">
      <h1 className="adm-titulo">Configuración</h1>

      {aviso && (
        <div ref={refAviso} className="adm-aviso fc__aviso" role="status" tabIndex={-1}>
          <p>{aviso}</p>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>
            ✕
          </button>
        </div>
      )}

      <form className="fc__form" onSubmit={guardar} noValidate>
        {/* ---------- Datos del local ---------- */}
        <section className="fc__seccion" aria-labelledby="fc-local">
          <h2 className="fc__subtitulo" id="fc-local">
            Datos del local
          </h2>

          <div className="campo">
            <label className="campo__label" htmlFor={idCampo('whatsapp')}>
              WhatsApp<span className="fc__oculto">, después del +54 9</span>
            </label>
            <div className="fc__prefijado">
              <span className="fc__prefijo" aria-hidden="true">
                +54 9
              </span>
              <input
                {...conAyuda('whatsapp')}
                className="campo__input"
                type="text"
                inputMode="tel"
                autoComplete="off"
                maxLength={24}
                value={v.whatsapp}
                onChange={(e) => cambiar('whatsapp', e.target.value.replace(/[^\d\s()+-]/g, ''), 'whatsapp')}
                onBlur={() =>
                  // Si pegaron el número con 54, 549 o el 0, queda solo lo de después del +54 9
                  setV((a) => {
                    const d = digitosWhatsapp(a.whatsapp)
                    return d === a.whatsapp.replace(/\D/g, '') ? a : { ...a, whatsapp: d }
                  })
                }
              />
            </div>
            <p className="campo__ayuda" id={idAyuda('whatsapp')}>
              Ej.: 336 412-3456 (código de área sin el 0 y número sin el 15)
            </p>
            {whatsappValido(numeroWhatsapp) && (
              <p className="fc__probar">
                <a href={`https://wa.me/${numeroWhatsapp}`} target="_blank" rel="noopener noreferrer">
                  Probar el link ↗
                </a>
              </p>
            )}
            {error('whatsapp')}
          </div>

          <div className="campo">
            <label className="campo__label" htmlFor={idCampo('instagram')}>
              Instagram<span className="fc__oculto">, el usuario sin la @</span>
            </label>
            <div className="fc__prefijado">
              <span className="fc__prefijo" aria-hidden="true">
                @
              </span>
              <input
                {...props('instagram')}
                className="campo__input"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={120}
                value={v.instagram}
                onChange={(e) => cambiar('instagram', e.target.value, 'instagram')}
                onBlur={() => setV((a) => ({ ...a, instagram: usuarioInstagram(a.instagram) }))}
              />
            </div>
            {error('instagram')}
          </div>

          <div className="campo">
            <label className="campo__label" htmlFor={idCampo('direccion')}>
              Dirección
            </label>
            <input
              {...conAyuda('direccion')}
              className="campo__input"
              type="text"
              autoComplete="off"
              maxLength={120}
              value={v.direccion}
              onChange={(e) => cambiar('direccion', e.target.value, 'direccion')}
            />
            <p className="campo__ayuda" id={idAyuda('direccion')}>
              Calle y número. Si no ponés la ciudad, se agrega San Nicolás de los Arroyos.
            </p>
            {error('direccion')}
          </div>

          <div className="campo">
            <div className="campo__fila">
              <label className="campo__label" htmlFor={idCampo('horarios')}>
                Horarios
              </label>
              <span className="campo__contador">{v.horarios.length}/300</span>
            </div>
            <textarea
              {...conAyuda('horarios')}
              className="campo__input campo__textarea"
              rows={3}
              maxLength={300}
              value={v.horarios}
              onChange={(e) => cambiar('horarios', e.target.value, 'horarios')}
            />
            <p className="campo__ayuda" id={idAyuda('horarios')}>
              Podés usar varias líneas. Ej.: Lunes a viernes 9 a 13 y 17 a 21
            </p>
            {error('horarios')}
          </div>

          <div className="campo">
            <label className="campo__label" htmlFor={idCampo('mapaUrl')}>
              Link de Google Maps <span className="campo__opcional">(opcional)</span>
            </label>
            <input
              {...conAyuda('mapaUrl')}
              className="campo__input"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={500}
              placeholder="https://maps.app.goo.gl/…"
              value={v.mapaUrl}
              onChange={(e) => cambiar('mapaUrl', e.target.value, 'mapaUrl')}
            />
            <p className="campo__ayuda" id={idAyuda('mapaUrl')}>
              Abrí el local en Google Maps, tocá «Compartir» y pegá el link acá. Si lo dejás vacío, se busca por la dirección.
            </p>
            {error('mapaUrl')}
          </div>
        </section>

        {/* ---------- Envíos ---------- */}
        <section className="fc__seccion" aria-labelledby="fc-envios">
          <h2 className="fc__subtitulo" id="fc-envios">
            Envíos
          </h2>

          <div className="fc__envio">
            <h3 className="campo__label">Retiro en el local</h3>
            <p className="campo__ayuda">Siempre disponible y gratis.</p>
          </div>

          <div className="fc__envio">
            <div className="campo">
              <label className="interruptor">
                <input
                  {...props('envioLocal.habilitado')}
                  type="checkbox"
                  role="switch"
                  checked={v.localHabilitado}
                  onChange={(e) => cambiar('localHabilitado', e.target.checked, 'envioLocal.habilitado')}
                />
                <span className="interruptor__pista" aria-hidden="true" />
                <span className="interruptor__texto">
                  <span className="campo__label">Envío en San Nicolás</span>
                  <span className="campo__ayuda">Con un costo fijo, que se suma al pago.</span>
                </span>
              </label>
              {error('envioLocal.habilitado')}
            </div>

            {verLocal && (
              <div className="fc__envio-campos">
                <div className="campo">
                  <label className="campo__label" htmlFor={idCampo('envioLocal.costo')}>
                    Costo
                  </label>
                  <div className="campo__precio">
                    <span aria-hidden="true">$</span>
                    <input
                      {...conAyuda('envioLocal.costo')}
                      className="campo__input"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="3.000"
                      value={v.localCosto}
                      onChange={(e) => cambiar('localCosto', e.target.value.replace(/[^\d.]/g, ''), 'envioLocal.costo')}
                    />
                  </div>
                  <p className="campo__ayuda" id={idAyuda('envioLocal.costo')} aria-live="polite">
                    {costo === null
                      ? 'Escribilo sin centavos, por ejemplo 3000 o 3.000.'
                      : `En la tienda: ${costo === 0 ? 'Gratis' : pesos(costo)}`}
                  </p>
                  {error('envioLocal.costo')}
                </div>

                <div className="campo">
                  <label className="campo__label" htmlFor={idCampo('envioLocal.texto')}>
                    Texto <span className="campo__opcional">(opcional)</span>
                  </label>
                  <input
                    {...conAyuda('envioLocal.texto')}
                    className="campo__input"
                    type="text"
                    autoComplete="off"
                    maxLength={120}
                    value={v.localTexto}
                    onChange={(e) => cambiar('localTexto', e.target.value, 'envioLocal.texto')}
                  />
                  <p className="campo__ayuda" id={idAyuda('envioLocal.texto')}>
                    Ej.: Solo San Nicolás
                  </p>
                  {error('envioLocal.texto')}
                </div>
              </div>
            )}
          </div>

          <div className="fc__envio">
            <div className="campo">
              <label className="interruptor">
                <input
                  {...props('envioNacional.habilitado')}
                  type="checkbox"
                  role="switch"
                  checked={v.nacionalHabilitado}
                  onChange={(e) => cambiar('nacionalHabilitado', e.target.checked, 'envioNacional.habilitado')}
                />
                <span className="interruptor__pista" aria-hidden="true" />
                <span className="interruptor__texto">
                  <span className="campo__label">Envío a todo el país</span>
                  <span className="campo__ayuda">Se coordina por WhatsApp y no se cobra en la web.</span>
                </span>
              </label>
              {error('envioNacional.habilitado')}
            </div>

            {verNacional && (
              <div className="fc__envio-campos">
                <div className="campo">
                  <div className="campo__fila">
                    <label className="campo__label" htmlFor={idCampo('envioNacional.texto')}>
                      Texto <span className="campo__opcional">(opcional)</span>
                    </label>
                    <span className="campo__contador">{v.nacionalTexto.length}/200</span>
                  </div>
                  <textarea
                    {...props('envioNacional.texto')}
                    className="campo__input campo__textarea fc__textarea-corto"
                    rows={2}
                    maxLength={200}
                    value={v.nacionalTexto}
                    onChange={(e) => cambiar('nacionalTexto', e.target.value, 'envioNacional.texto')}
                  />
                  {error('envioNacional.texto')}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Marquesina ---------- */}
        <section className="fc__seccion" aria-labelledby="fc-marquesina-titulo">
          <h2 className="fc__subtitulo" id="fc-marquesina-titulo">
            Marquesina
          </h2>
          <p className="campo__ayuda">La banda amarilla con textos que se mueve en el inicio de la tienda.</p>

          {v.marquesina.length > 0 && (
            <ol
              className="fc__textos"
              id={idCampo('marquesina')}
              tabIndex={-1}
              aria-label="Textos de la marquesina"
              aria-describedby={errores.marquesina ? idError('marquesina') : undefined}
            >
              {v.marquesina.map((t, i) => {
                const clave = `marquesina.${i}`
                const n = i + 1
                return (
                  <li key={t.id} className="fc__texto">
                    <div className="campo__fila">
                      <label className="fc__texto-label" htmlFor={idCampo(clave)}>
                        Texto {n}
                      </label>
                      <span className="campo__contador">
                        {t.texto.length}/{MAX_TEXTO_MARQUESINA}
                      </span>
                    </div>
                    <div className="fc__texto-fila">
                      <input
                        {...props(clave)}
                        className="campo__input"
                        type="text"
                        autoComplete="off"
                        maxLength={MAX_TEXTO_MARQUESINA}
                        value={t.texto}
                        onChange={(e) => editarTexto(t.id, clave, e.target.value)}
                      />
                      <div className="fc__texto-botones">
                        <button type="button" className="adm-btn" aria-label={`Subir texto ${n}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                          ▲
                        </button>
                        <button
                          type="button"
                          className="adm-btn"
                          aria-label={`Bajar texto ${n}`}
                          disabled={i === v.marquesina.length - 1}
                          onClick={() => mover(i, 1)}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="adm-btn"
                          aria-label={`Quitar texto ${n}`}
                          onClick={() => cambiarFilas(v.marquesina.filter((f) => f.id !== t.id))}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    {error(clave)}
                  </li>
                )
              })}
            </ol>
          )}
          {error('marquesina')}

          <div className="fc__agregar">
            <button
              type="button"
              className="adm-btn"
              disabled={llenaMarquesina}
              aria-describedby={llenaMarquesina ? 'fc-marquesina-limite' : undefined}
              onClick={agregar}
            >
              + Agregar texto
            </button>
            {llenaMarquesina && (
              <p className="campo__ayuda" id="fc-marquesina-limite">
                Hasta {MAX_MARQUESINA} textos.
              </p>
            )}
          </div>

          <div className="fc__vista">
            <p className="campo__label">Vista previa</p>
            {textosMarquesina.length ? (
              <div className="fc__banda">
                {textosMarquesina.map((texto, i) => (
                  <span key={i}>{texto}</span>
                ))}
              </div>
            ) : (
              <p className="campo__ayuda">Sin textos, la banda no se muestra en la tienda.</p>
            )}
          </div>
        </section>

        {/* Fijo abajo mientras se recorre el formulario */}
        <div className="adm-barra-guardar">
          {errorGeneral && (
            <div ref={alerta} className="adm-alerta" role="alert" tabIndex={-1}>
              {errorGeneral}
            </div>
          )}
          <button type="submit" className="adm-btn adm-btn--primario adm-guardar" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
