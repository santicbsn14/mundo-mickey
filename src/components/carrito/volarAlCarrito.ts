/**
 * `id` del botón "Carrito" del header. Lo usan la estrella (destino del vuelo y `pop`) y el drawer
 * (le devuelve el foco al cerrar). Un `id` y no un `ref` en el contexto: el botón es uno solo y
 * quien anima no necesita re-renderizar nada.
 */
export const ID_BOTON_CARRITO = 'btn-carrito'

const EASE = 'cubic-bezier(.2,.8,.2,1)'

function sinMovimiento(): boolean {
  return (
    typeof Element.prototype.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Una "★" amarilla con contorno negro vuela desde `desde` hasta el botón del carrito, y el botón hace
 * `pop`. Misma curva y duración que la maqueta. Con reduced motion o sin Web Animations, no anima.
 */
export function volarAlCarrito(desde: HTMLElement) {
  const boton = document.getElementById(ID_BOTON_CARRITO)
  if (!boton || sinMovimiento()) return

  // `pop` de la maqueta: el easing va por tramo, igual que en un @keyframes de CSS
  boton.animate(
    [
      { transform: 'scale(1)', easing: EASE },
      { transform: 'scale(1.14)', offset: 0.35, easing: EASE },
      { transform: 'scale(.95)', offset: 0.65, easing: EASE },
      { transform: 'scale(1)' },
    ],
    { duration: 450 },
  )

  const a = desde.getBoundingClientRect()
  const b = boton.getBoundingClientRect()
  const estrella = document.createElement('span')
  estrella.textContent = '★'
  estrella.setAttribute('aria-hidden', 'true')
  Object.assign(estrella.style, {
    position: 'fixed',
    zIndex: '70',
    left: `${a.left + a.width / 2}px`,
    top: `${a.top}px`,
    pointerEvents: 'none',
    color: 'var(--amarillo)',
    fontSize: '1.8rem',
    lineHeight: '1',
    textShadow: '1px 1px 0 var(--negro), -1px -1px 0 var(--negro), 1px -1px 0 var(--negro), -1px 1px 0 var(--negro)',
    transform: 'translate(-50%, 0) scale(.6)',
  })
  document.body.appendChild(estrella)

  const dx = b.left + b.width - 20 - (a.left + a.width / 2)
  const dy = b.top + 8 - a.top
  const vuelo = estrella.animate(
    [
      { transform: 'translate(-50%, 0) scale(.6) rotate(0)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${dx * 0.5}px), ${dy * 0.5 - 80}px) scale(1.3) rotate(180deg)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.4) rotate(360deg)`, opacity: 0.2 },
    ],
    { duration: 700, easing: 'cubic-bezier(.5,0,.5,1)' },
  )
  const sacar = () => estrella.remove()
  vuelo.onfinish = sacar
  vuelo.oncancel = sacar
}
