import { flushSync } from 'react-dom'
import { prefersReducedMotion } from './format'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> }
}

/** Swap themes with a circular reveal that grows from the toggle, where supported. */
export async function revealTheme(origin: HTMLElement | null, apply: () => void) {
  const doc = document as ViewTransitionDocument
  if (!origin || !doc.startViewTransition || prefersReducedMotion()) {
    apply()
    return
  }
  const rect = origin.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  await doc.startViewTransition(() => flushSync(apply)).ready
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 720, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
  )
}

/** A short celebratory spray of particles; skipped entirely for reduced motion. */
export function burst(rect: DOMRect | null) {
  if (!rect || prefersReducedMotion()) return
  const canvas = document.createElement('canvas')
  canvas.className = 'burst'
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const style = getComputedStyle(document.documentElement)
  const colors = ['--c-tide', '--c-sky', '--c-beam', '--c-rose', '--c-lilac'].map((name) => style.getPropertyValue(name).trim())
  const x0 = rect.left + rect.width / 2
  const y0 = rect.top + rect.height / 2
  const bits = Array.from({ length: 90 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3
    const speed = 5 + Math.random() * 9
    return {
      x: x0,
      y: y0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }
  })
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    let alive = false
    for (const bit of bits) {
      bit.vy += 0.32
      bit.vx *= 0.985
      bit.x += bit.vx
      bit.y += bit.vy
      bit.life -= 0.012
      if (bit.life <= 0) continue
      alive = true
      ctx.globalAlpha = bit.life
      ctx.fillStyle = bit.color
      ctx.beginPath()
      ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (alive) requestAnimationFrame(step)
    else canvas.remove()
  }
  requestAnimationFrame(step)
}
