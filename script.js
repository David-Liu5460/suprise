const canvas = document.getElementById('stage')
const ctx = canvas.getContext('2d')

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
const phrases = ['猪猪，生日快乐','每天爱你多一些','朱 ❤️ 刘']
const textCanvas = document.createElement('canvas')
const textCtx = textCanvas.getContext('2d')

function spawnRocket(targetX, targetY) {
  const sy = h + 10
  let tx
  const r = Math.random()
  if (targetX != null) tx = clamp(targetX, w * 0.1, w * 0.9)
  else if (r < 0.33) tx = rand(w * 0.12, w * 0.35)
  else if (r < 0.66) tx = rand(w * 0.4, w * 0.6)
  else tx = rand(w * 0.65, w * 0.88)
  const sx = rand(tx - w * 0.15, tx + w * 0.15)
  const ty = targetY != null ? clamp(targetY, h * 0.25, h * 0.65) : rand(h * 0.28, h * 0.62)
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.hypot(dx, dy)
  const speed = rand(3.2, 4.6)
  const vx = (dx / dist) * speed
  const vy = (dy / dist) * speed
  const hue = rand(0, 360)
  fireworks.push({ x: sx, y: sy, vx, vy, tx, ty, hue })
}

function getTextPoints(text, fontSize) {
  const pad = 20
  textCtx.font = 'bold ' + fontSize + 'px system-ui, \u5FAE\u8F6F\u96C5\u9ED1, Noto Sans SC, sans-serif'
  const m = textCtx.measureText(text)
  const tw = Math.ceil(m.width) + pad * 2
  const th = Math.ceil(fontSize * 1.4) + pad * 2
  textCanvas.width = tw
  textCanvas.height = th
  textCtx.clearRect(0, 0, tw, th)
  textCtx.fillStyle = '#fff'
  textCtx.font = 'bold ' + fontSize + 'px system-ui, \u5FAE\u8F6F\u96C5\u9ED1, Noto Sans SC, sans-serif'
  textCtx.textBaseline = 'middle'
  textCtx.textAlign = 'center'
  textCtx.fillText(text, tw / 2, th / 2)
  const img = textCtx.getImageData(0, 0, tw, th).data
  const pts = []
  const step = 4
  for (let y0 = 0; y0 < th; y0 += step) {
    for (let x0 = 0; x0 < tw; x0 += step) {
      const idx = (y0 * tw + x0) * 4 + 3
      if (img[idx] > 10) pts.push({ x: x0 - tw / 2, y: y0 - th / 2 })
    }
  }
  return pts
}

function explode(x, y, hue) {
  const showText = Math.random() < 0.8
  if (showText) {
    const text = phrases[Math.floor(rand(0, phrases.length))]
    const fs = Math.floor(Math.min(60, Math.max(32, Math.min(w, h) * 0.08)))
    const textPts = getTextPoints(text, fs)
    const step = 2 
    for (let i = 0; i < textPts.length; i += step) {
      const tp = textPts[i]
      const spd = rand(0.4, 1.0)
      const size = rand(1.2, 2.2)
      const sat = rand(70, 100)
      const light = rand(60, 80)
      particles.push({ x, y, vx: Math.cos(rand(0, Math.PI * 2)) * spd, vy: Math.sin(rand(0, Math.PI * 2)) * spd, alpha: 1, fade: rand(0.005, 0.015), size, hue, sat, light, type: 'text', tx: x + tp.x, ty: y + tp.y, arrived: false })
    }
    const extra = 30
    for (let i = 0; i < extra; i++) {
      const ang = rand(0, Math.PI * 2)
      const spd = rand(0.6, 1.6)
      particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, alpha: 1, fade: rand(0.01, 0.03), size: rand(1.0, 2.0), hue, sat: rand(70, 100), light: rand(45, 65) })
    }
  } else {
    const count = 100
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2)
      const spd = rand(0.6, 1.6)
      const fade = rand(0.003, 0.007)
      const size = rand(1.0, 2.4)
      const sat = rand(70, 100)
      const light = rand(45, 65)
      particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, alpha: 1, fade, size, hue, sat, light })
    }
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
    if (dx * dx + dy * dy < 16 * 16 || f.y < 24 || f.x < 12 || f.x > w - 12) {
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
    if (p.type === 'text') {
      const dx = p.tx - p.x
      const dy = p.ty - p.y
      p.vx = p.vx * 0.88 + dx * 0.04
      p.vy = p.vy * 0.88 + dy * 0.04
      p.x += p.vx
      p.y += p.vy
      if (!p.arrived && dx * dx + dy * dy < 9) { p.arrived = true; p.fade = rand(0.005, 0.015) }
      if (p.arrived) p.alpha -= p.fade
    } else {
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.972
      p.vy *= 0.972
      p.vy += 0.03
      p.alpha -= p.fade
    }
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
  const schedule = () => {
    const delay = Math.floor(rand(650, 1400))
    spawnerId = setTimeout(() => {
      if (fireworks.length < 8) spawnRocket()
      schedule()
    }, delay)
  }
  schedule()
}

startContinuous()
