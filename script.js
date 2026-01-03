const canvas = document.getElementById('stage')
const ctx = canvas.getContext('2d')
const yearEl = document.getElementById('year')

let w = 0
let h = 0
let dpr = Math.min(window.devicePixelRatio || 1, 2)

function resize() {
  w = window.innerWidth
  h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

resize()
window.addEventListener('resize', resize)

const rand = (a = 0, b = 1) => a + (b - a) * Math.random()
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const fireworks = []
const particles = []
let spawnerId = null
let yearShown = false

function spawnRocket(targetX, targetY) {
  const sx = rand(w * 0.2, w * 0.8)
  const sy = h + 10
  const m = Math.min(Math.max(140, Math.min(w, h) * 0.22), Math.min(w, h) * 0.45)
  const tx = targetX != null ? clamp(targetX, m, w - m) : rand(m, w - m)
  const ty = targetY != null ? clamp(targetY, m, h - m) : rand(m, h - m)
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.hypot(dx, dy)
  const speed = rand(3.0, 4.5)
  const vx = (dx / dist) * speed
  const vy = (dy / dist) * speed
  const hue = rand(0, 360)
  fireworks.push({ x: sx, y: sy, vx, vy, tx, ty, hue })
}

function explode(x, y, hue) {
  const count = 80
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rand(-0.05, 0.05)
    const spd = rand(0.6, 1.5)
    const fade = rand(0.003, 0.007)
    const size = rand(1.0, 2.4)
    const sat = rand(70, 100)
    const light = rand(45, 65)
    particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, alpha: 1, fade, size, hue, sat, light })
  }
}

function step() {
  const now = performance.now()
  

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i]
    f.x += f.vx
    f.y += f.vy
    f.vy += 0.012
    const dx = f.tx - f.x
    const dy = f.ty - f.y
    if (dx * dx + dy * dy < 16 * 16) {
      explode(f.x, f.y, f.hue)
      fireworks.splice(i, 1)
      continue
    }
    ctx.beginPath()
    ctx.arc(f.x, f.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${f.hue} 100% 70%)`
    ctx.fill()
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vx *= 0.972
    p.vy *= 0.972
    p.vy += 0.03
    p.alpha -= p.fade
    if (p.alpha <= 0 || p.y > h + 50) {
      particles.splice(i, 1)
      continue
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue} ${p.sat}% ${p.light}% / ${clamp(p.alpha, 0, 1)})`
    ctx.fill()
  }

  
  requestAnimationFrame(step)
}

requestAnimationFrame(step)

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const tx = e.clientX - rect.left
  const ty = e.clientY - rect.top
  spawnRocket(tx, ty)
})

function startContinuous() {
  if (spawnerId) return
  spawnerId = setInterval(() => {
    if (fireworks.length < 6) spawnRocket()
  }, 900)
}

startContinuous()

setTimeout(() => {
  if (!yearShown) {
    yearEl.classList.add('show')
    yearShown = true
  }
}, 5000)
