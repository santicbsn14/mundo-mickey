import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import './Visitanos.css'

const CIUDAD = 'San Nicolás de los Arroyos'
const MENSAJE_WHATSAPP = 'Hola! Quiero hacer una consulta.'

/** Si la dirección ya nombra la ciudad, sin importar mayúsculas ni tildes. */
function incluyeCiudad(direccion: string): boolean {
  const normalizada = direccion.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return normalizada.includes('san nicolas')
}

/** Búsqueda de Google Maps para la dirección: la usan el mapa y "Cómo llegar". */
function consultaMapa(direccion: string): string {
  return incluyeCiudad(direccion) ? direccion : `${direccion}, ${CIUDAD}, Buenos Aires`
}

export default function Visitanos() {
  const { configuracion, cargando } = useConfiguracion()

  const direccion = configuracion?.direccion?.trim()
  const horarios = configuracion?.horarios?.trim()
  const whatsapp = configuracion?.whatsapp?.replace(/\D/g, '')
  const instagram = configuracion?.instagram?.trim().replace(/^@/, '')
  const consulta = direccion ? encodeURIComponent(consultaMapa(direccion)) : undefined
  // El link de Maps del local marca el lugar exacto; sin él, la búsqueda por la dirección.
  // El mapa embebido siempre usa la búsqueda: los links compartidos de Maps no se pueden embeber.
  const mapaUrl = configuracion?.mapaUrl?.trim()
  const comoLlegar = mapaUrl?.startsWith('https://')
    ? mapaUrl
    : consulta && `https://www.google.com/maps/search/?api=1&query=${consulta}`
  // Sin mapa, una sola columna (en desktop no queda la derecha vacía)
  const conMapa = cargando || !!consulta

  return (
    <section className="visitanos" id="contacto" aria-labelledby="visitanos-titulo">
      <div className={`contenedor visitanos__grid${conMapa ? '' : ' visitanos__grid--sin-mapa'}`}>
        <div className="visitanos__info">
          <h2 className="visitanos__titulo" id="visitanos-titulo">Visitanos</h2>
          <p className="visitanos__bajada">Retirá tu compra en el local o pasá a conocer los juguetes.</p>

          {cargando ? (
            // Mientras llega la configuración: el lugar de los datos y los botones, invisible. Los
            // botones llevan sus textos reales para que ocupen y se acomoden igual. La dirección
            // reserva dos líneas: la calle y, debajo, la ciudad.
            <div className="visitanos__reserva" aria-hidden="true">
              <div className="visitanos__datos">
                <div className="visitanos__dato"><h3>&nbsp;</h3><p>&nbsp;<br />&nbsp;</p></div>
                <div className="visitanos__dato"><h3>&nbsp;</h3><p>&nbsp;</p></div>
              </div>
              <div className="visitanos__botones">
                <span className="visitanos__btn">Escribinos por WhatsApp</span>
                <span className="visitanos__btn">Cómo llegar</span>
              </div>
              <p className="visitanos__instagram">&nbsp;</p>
            </div>
          ) : (
            <>
              {(direccion || horarios) && (
                <div className="visitanos__datos">
                  {direccion && (
                    <div className="visitanos__dato">
                      <h3>Dirección</h3>
                      <p>
                        {direccion}
                        {!incluyeCiudad(direccion) && <><br />{CIUDAD}</>}
                      </p>
                    </div>
                  )}
                  {horarios && (
                    <div className="visitanos__dato">
                      <h3>Horarios</h3>
                      <p className="visitanos__horarios">{horarios}</p>
                    </div>
                  )}
                </div>
              )}

              {(whatsapp || comoLlegar) && (
                <div className="visitanos__botones">
                  {whatsapp && (
                    <a
                      className="visitanos__btn visitanos__btn--negro"
                      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Escribinos por WhatsApp
                    </a>
                  )}
                  {comoLlegar && (
                    <a
                      className="visitanos__btn visitanos__btn--borde"
                      href={comoLlegar}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cómo llegar
                    </a>
                  )}
                </div>
              )}

              {instagram && (
                <p className="visitanos__instagram">
                  Instagram{' '}
                  <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer">
                    @{instagram}
                  </a>
                </p>
              )}
            </>
          )}
        </div>

        {cargando ? (
          <div className="visitanos__mapa" aria-hidden="true" />
        ) : (
          direccion &&
          consulta && (
            <div className="visitanos__mapa">
              <iframe
                src={`https://maps.google.com/maps?q=${consulta}&output=embed`}
                title={`Mapa: ${direccion}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )
        )}
      </div>
    </section>
  )
}
