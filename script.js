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

// -------- 工具函数 --------
const rand = (a = 0, b = 1) => a + (b - a) * Math.random()
const randInt = (a, b) => Math.floor(rand(a, b + 1))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// -------- 可调参数（节奏 / 颜色 / 性能） --------
const MAX_CONCURRENT_TEXTS = 3 // 同屏最多文本烟花组
const MAX_PARTICLES = 2200 // 全局粒子上限
const MAX_FIREWORKS = 18 // 同时在空中的火箭上限

const BASE_SPAWN_INTERVAL = [700, 1400] // 常规发射间隔(ms)
const BURST_SPAWN_INTERVAL = [220, 380] // 小高潮期发射间隔(ms)
const BURST_CHANCE = 0.18 // 进入小高潮的概率
const BURST_DURATION = [1600, 2600] // 小高潮持续时间(ms)

const ROCKET_SPEED = [3.0, 5.0] // 火箭上升速度区间
const ROCKET_GRAVITY = 0.02 // 火箭重力

// 自动火箭爆炸高度分布：主频在上中部，偶尔更高一点
const AUTO_TARGET_MAIN_HEIGHT = [0.34, 0.52]
const AUTO_TARGET_HIGH_HEIGHT = [0.58, 0.72]
const AUTO_TARGET_HIGH_PROB = 0.22 // 小概率更高一档

const PARTICLE_FRICTION = 0.985 // 粒子速度衰减
const PARTICLE_GRAVITY = 0.03 // 粒子重力

const TRAIL_ALPHA = 0.1 // 背景擦除透明度，越低拖尾越长

const NORMAL_HUE_JITTER = 15 // 普通烟花色相偏移范围
const NORMAL_SATURATION = [90, 100]
const NORMAL_LIGHTNESS = [60, 75]

// 文本与节奏相关参数（集中可调）
const TEXT_FIREWORK_CHANCE_BASE = 0.24 // 文本烟花基础概率中心值
const TEXT_CADENCE_MIN = 0.16
const TEXT_CADENCE_MAX = 0.32
const TEXT_CADENCE_PERIOD = 16000 // 文本概率缓慢起伏周期(ms)

const MIN_TEXT_GROUP_GAP = 2000 // 相邻文本组最小间隔(ms)
const TEXT_SAFE_MARGIN = 44 // 文本整体距画面边缘安全距离
const TEXT_BOUNDS_MARGIN = 36 // 文本组包围盒用于防重叠的额外边距

// 文本色彩参数（集中可调）
const TEXT_HUE_MAX_OFFSET = 18 // 文本相对于爆点的最大色相偏移
const TEXT_HUE_SMALL_SWING = 6 // 文本色相随时间/位置的轻微摆动幅度
const TEXT_SAT_RANGE = [88, 98]
const TEXT_LIGHT_RANGE = [56, 66]
const TEXT_ALPHA_POWER = 1.35 // 文本 alpha 非线性映射指数

// 兼容旧变量命名，方便下方逻辑复用
const TEXT_SATURATION_RANGE = TEXT_SAT_RANGE
const TEXT_LIGHTNESS_MIN = TEXT_LIGHT_RANGE[0]
const TEXT_LIGHTNESS_CAP = TEXT_LIGHT_RANGE[1]
const ALPHA_POWER = TEXT_ALPHA_POWER

const TEXT_GROUP_LIFETIME = 4200 // 文本组寿命(ms)，用于并发控制
const MAX_TEXT_POINTS_PER_GROUP = 900 // 单组文本采样点上限

const TEXT_STAY_DURATION = [900, 1700]
const TEXT_STAY_DURATION_EXTRA = [1500, 2400]

// 文本 halo 粒子参数
const HALO_COUNT = 16
const HALO_BASE_ALPHA = 0.5
const HALO_FADE_RANGE = [0.03, 0.055]

// -------- 状态 --------
const fireworks = []
const particles = []
let spawnerId = null
let burstUntil = 0

const phrases = [
  '猪猪，生日快乐',
  '刘 ❤️ 朱',
  '杭州夏天的风, 我会永远记得',
  'Love You 3000',
  '永远 爱你',
  '2026 每天开心',
]

const textCanvas = document.createElement('canvas')
const textCtx = textCanvas.getContext('2d')

let activeTextGroups = [] // { id, bounds: {x,y,w,h}, expireAt }
let nextTextGroupId = 1
let lastTextGroupTime = 0

let lastAutoSide = null

function pickAutoTargetX() {
  const regions = [
    [0.12, 0.35],
    [0.4, 0.6],
    [0.65, 0.88]
  ]

  let weights = [1, 1.08, 1]

  if (lastAutoSide != null) {
    const bias = 0.6
    if (lastAutoSide === 0) {
      weights[0] *= 1 - bias
      weights[2] *= 1 + bias
    } else if (lastAutoSide === 2) {
      weights[2] *= 1 - bias
      weights[0] *= 1 + bias
    }
  }

  const total = weights[0] + weights[1] + weights[2]
  let r = Math.random() * total
  let idx

  if (r < weights[0]) {
    idx = 0
  } else if (r < weights[0] + weights[1]) {
    idx = 1
  } else {
    idx = 2
  }

  lastAutoSide = idx
  const range = regions[idx]
  return rand(w * range[0], w * range[1])
}

function pushParticle(p) {
  if (particles.length >= MAX_PARTICLES) return
  particles.push(p)
}

// -------- 火箭与爆炸 --------
function spawnRocket(targetX, targetY) {
  const sy = h + 10
  let tx

  if (targetX != null) {
    tx = clamp(targetX, w * 0.1, w * 0.9)
  } else {
    tx = pickAutoTargetX()
  }

  const sx = rand(tx - w * 0.15, tx + w * 0.15)

  let ty
  if (targetY != null) {
    const minY = h * 0.22
    const maxY = h * 0.78
    ty = clamp(targetY, minY, maxY)
  } else {
    const useHighBand = Math.random() < AUTO_TARGET_HIGH_PROB
    const band = useHighBand ? AUTO_TARGET_HIGH_HEIGHT : AUTO_TARGET_MAIN_HEIGHT
    ty = rand(h * band[0], h * band[1])
  }

  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.hypot(dx, dy) || 1
  const speed = rand(ROCKET_SPEED[0], ROCKET_SPEED[1])
  const vx = (dx / dist) * speed
  const vy = (dy / dist) * speed
  const hue = rand(0, 360)

  fireworks.push({ x: sx, y: sy, vx, vy, tx, ty, hue })
}

// 根据画布尺寸自适应文本采样密度
function getTextSamplingStep() {
  const shorter = Math.min(w, h)
  if (shorter <= 480) return 2
  if (shorter <= 900) return 3
  return 4
}

function getTextData(text, fontSize) {
  const pad = Math.round(fontSize * 0.3)
  const font =
    '700 ' +
    fontSize +
    'px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'

  textCtx.font = font
  const m = textCtx.measureText(text)
  const tw = Math.ceil(m.width) + pad * 2
  const th = Math.ceil(fontSize * 1.4) + pad * 2

  textCanvas.width = tw
  textCanvas.height = th
  textCtx.clearRect(0, 0, tw, th)

  // 仅用 alpha 通道做采样，颜色本身无关紧要
  textCtx.fillStyle = '#fff'
  textCtx.font = font
  textCtx.textBaseline = 'middle'
  textCtx.textAlign = 'center'
  textCtx.fillText(text, tw / 2, th / 2)

  const img = textCtx.getImageData(0, 0, tw, th).data
  const pts = []
  const step = getTextSamplingStep()

  for (let y0 = 0; y0 < th; y0 += step) {
    for (let x0 = 0; x0 < tw; x0 += step) {
      const idx = (y0 * tw + x0) * 4 + 3
      if (img[idx] > 10) pts.push({ x: x0 - tw / 2, y: y0 - th / 2 })
    }
  }

  return { pts, tw, th }
}

function cleanupExpiredTextGroups(now) {
  activeTextGroups = activeTextGroups.filter(g => g.expireAt > now)
}

function rectsOverlap(a, b) {
  const ax2 = a.x + a.w
  const ay2 = a.y + a.h
  const bx2 = b.x + b.w
  const by2 = b.y + b.h
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y)
}

function normalizeHue(h) {
  let hh = h % 360
  if (hh < 0) hh += 360
  return hh
}

function shortestHueDiff(a, b) {
  const ha = normalizeHue(a)
  const hb = normalizeHue(b)
  let diff = ha - hb
  diff = ((diff + 540) % 360) - 180 // [-180, 180]
  return diff
}

function clampHueAroundBase(baseHue, hue, maxDelta) {
  const base = normalizeHue(baseHue)
  let candidate = normalizeHue(hue)
  let diff = shortestHueDiff(candidate, base)
  if (diff > maxDelta) diff = maxDelta
  if (diff < -maxDelta) diff = -maxDelta
  return normalizeHue(base + diff)
}

function buildAnalogousPalette(baseHue) {
  const h = normalizeHue(baseHue)
  const offsets = [-24, -8, 0, 8, 24]
  const hues = offsets.map(offset => clampHueAroundBase(h, h + offset, TEXT_HUE_MAX_OFFSET))
  return hues
}

function interpolatePalette(u, palette) {
  if (!palette || palette.length === 0) return 0
  const t = clamp(u, 0, 1)
  if (palette.length === 1) return normalizeHue(palette[0])

  const scaled = t * (palette.length - 1)
  const idx = Math.floor(scaled)
  const frac = scaled - idx
  const i0 = idx
  const i1 = Math.min(idx + 1, palette.length - 1)

  const h0 = normalizeHue(palette[i0])
  const h1 = normalizeHue(palette[i1])
  const diff = shortestHueDiff(h1, h0)
  const h = h0 + diff * frac
  return normalizeHue(h)
}


function createTextExplosion(x, y, hue) {
  const now = performance.now()
  cleanupExpiredTextGroups(now)

  if (activeTextGroups.length >= MAX_CONCURRENT_TEXTS) return false

  const text = phrases[Math.floor(rand(0, phrases.length))]
  const shorter = Math.min(w, h)
  let fs = Math.floor(shorter * 0.1)
  fs = clamp(fs, 28, 96)

  const data = getTextData(text, fs)

  const margin = TEXT_SAFE_MARGIN
  const bx = clamp(x, data.tw / 2 + margin, w - data.tw / 2 - margin)
  const by = clamp(y, data.th / 2 + margin, h - data.th / 2 - margin)

  const boundsMargin = TEXT_BOUNDS_MARGIN
  const bounds = {
    x: bx - data.tw / 2 - boundsMargin,
    y: by - data.th / 2 - boundsMargin,
    w: data.tw + boundsMargin * 2,
    h: data.th + boundsMargin * 2
  }

  // 与现有文本组碰撞则降级为普通烟花
  for (let i = 0; i < activeTextGroups.length; i++) {
    if (rectsOverlap(bounds, activeTextGroups[i].bounds)) {
      return false
    }
  }

  if (now - lastTextGroupTime < MIN_TEXT_GROUP_GAP) return false

  const groupId = nextTextGroupId++
  const expireAt = now + TEXT_GROUP_LIFETIME
  activeTextGroups.push({ id: groupId, bounds, expireAt })
  lastTextGroupTime = now

  // 控制单组文本粒子总量
  const pts = data.pts
  const total = pts.length
  const step = total > MAX_TEXT_POINTS_PER_GROUP ? Math.ceil(total / MAX_TEXT_POINTS_PER_GROUP) : 1
  const tw = data.tw
  const th = data.th
  const palette = buildAnalogousPalette(hue)

  for (let i = 0; i < total; i += step) {
    const tp = pts[i]
    const spd = rand(0.3, 0.9)
    const size = rand(1.6, 2.6)
    const baseSat = rand(TEXT_SATURATION_RANGE[0], TEXT_SATURATION_RANGE[1])
    const baseLight = rand(TEXT_LIGHTNESS_MIN, TEXT_LIGHTNESS_CAP)
    const u = (tp.x + tw / 2) / tw
    const v = (tp.y + th / 2) / th

    pushParticle({
      x,
      y,
      vx: Math.cos(rand(0, Math.PI * 2)) * spd,
      vy: Math.sin(rand(0, Math.PI * 2)) * spd,
      alpha: 1,
      fade: rand(0.01, 0.02),
      stayUntil: now + rand(TEXT_STAY_DURATION[0], TEXT_STAY_DURATION[1]),
      size,
      hue,
      sat: baseSat,
      light: baseLight,
      type: 'text',
      tx: bx + tp.x,
      ty: by + tp.y,
      arrived: false,
      groupId,
      flickerPhase: rand(0, Math.PI * 2),
      baseHue: hue,
      baseSat,
      baseLight,
      u,
      v,
      palette,
      birthTime: now
    })
  }

  // 少量加粗点位，中心略更亮、停留稍久
  for (let i = 0; i < total; i += step) {
    if (Math.random() < 0.35) {
      const tp = pts[i]
      const size = rand(1.6, 2.6)
      const baseSat = rand(TEXT_SATURATION_RANGE[0], TEXT_SATURATION_RANGE[1])
      const baseLight = rand(TEXT_LIGHTNESS_MIN, TEXT_LIGHTNESS_CAP)
      const u = (tp.x + tw / 2) / tw
      const v = (tp.y + th / 2) / th

      pushParticle({
        x,
        y,
        vx: 0,
        vy: 0,
        alpha: 1,
        fade: rand(0.01, 0.02),
        stayUntil: now + rand(TEXT_STAY_DURATION_EXTRA[0], TEXT_STAY_DURATION_EXTRA[1]),
        size,
        hue,
        sat: baseSat,
        light: baseLight,
        type: 'text',
        tx: bx + tp.x + rand(-1, 1),
        ty: by + tp.y + rand(-1, 1),
        arrived: false,
        groupId,
        flickerPhase: rand(0, Math.PI * 2),
        baseHue: hue,
        baseSat,
        baseLight,
        u,
        v,
        palette,
        birthTime: now
      })
    }
  }

  // 文本周围加少量普通粒子作为柔和光晕（在 lighter 下绘制）
  const extra = HALO_COUNT
  for (let i = 0; i < extra; i++) {
    const ang = rand(0, Math.PI * 2)
    const radius = rand(0, data.tw * 0.12)
    const ox = Math.cos(ang) * radius
    const oy = Math.sin(ang) * radius
    const spd = rand(0.4, 1.1)
    const pHue = hue + rand(-NORMAL_HUE_JITTER, NORMAL_HUE_JITTER)

    pushParticle({
      x: bx + ox,
      y: by + oy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      alpha: HALO_BASE_ALPHA,
      fade: rand(HALO_FADE_RANGE[0], HALO_FADE_RANGE[1]),
      size: rand(0.9, 1.6),
      hue: pHue,
      sat: rand(NORMAL_SATURATION[0], NORMAL_SATURATION[1]),
      light: rand(NORMAL_LIGHTNESS[0], NORMAL_LIGHTNESS[1])
    })
  }

  return true
}

function createRegularExplosion(x, y, hue) {
  const areaFactor = clamp((w * h) / (1280 * 720), 0.5, 1.4)
  const baseCount = 180
  const count = Math.floor(baseCount * areaFactor * rand(0.8, 1.2))

  const baseHue = hue
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2)
    const spd = rand(0.8, 4.0)
    const fade = rand(0.006, 0.014)
    const size = rand(1.4, 3.0)
    const sat = rand(NORMAL_SATURATION[0], NORMAL_SATURATION[1])
    const light = rand(NORMAL_LIGHTNESS[0], NORMAL_LIGHTNESS[1])
    const pHue = baseHue + rand(-NORMAL_HUE_JITTER, NORMAL_HUE_JITTER)

    pushParticle({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      alpha: 1,
      fade,
      size,
      hue: pHue,
      sat,
      light
    })
  }
}

function getTextFireworkChance(now) {
  const t = now / TEXT_CADENCE_PERIOD
  const mid = TEXT_FIREWORK_CHANCE_BASE
  const amp = (TEXT_CADENCE_MAX - TEXT_CADENCE_MIN) / 2
  let chance = mid + amp * Math.sin(t * Math.PI * 2)

  chance = clamp(chance, TEXT_CADENCE_MIN, TEXT_CADENCE_MAX)

  const sinceLast = now - lastTextGroupTime
  if (sinceLast > 0 && sinceLast < MIN_TEXT_GROUP_GAP) {
    const k = sinceLast / MIN_TEXT_GROUP_GAP
    chance *= clamp(k, 0, 1)
  }

  if (activeTextGroups.length > 0) {
    const load = clamp(activeTextGroups.length / MAX_CONCURRENT_TEXTS, 0, 1)
    const minScale = 0.25
    const scale = 1 - load * (1 - minScale)
    chance *= clamp(scale, minScale, 1)
  }

  return clamp(chance, 0, 1)
}

function explode(x, y, hue) {
  const now = performance.now()
  const chance = getTextFireworkChance(now)
  const showText = Math.random() < chance

  if (showText) {
    const ok = createTextExplosion(x, y, hue)
    if (!ok) createRegularExplosion(x, y, hue)
  } else {
    createRegularExplosion(x, y, hue)
  }
}

// -------- 动画主循环 --------
function step() {
  const now = performance.now()

  // 背景拖尾擦除
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgba(0, 0, 0, ${TRAIL_ALPHA})`
  ctx.fillRect(0, 0, w, h)

  // 第一段：在 lighter 模式下绘制火箭和所有非文本粒子
  ctx.globalCompositeOperation = 'lighter'

  // 火箭更新与绘制
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i]
    f.x += f.vx
    f.y += f.vy
    f.vy += ROCKET_GRAVITY

    const dx = f.tx - f.x
    const dy = f.ty - f.y

    if (dx * dx + dy * dy < 16 * 16 || f.y < 24 || f.x < 12 || f.x > w - 12 || f.vy >= 0) {
      explode(f.x, f.y, f.hue)
      fireworks.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(f.x, f.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${f.hue} 100% 70%)`
    ctx.fill()
  }

  const textGroupAlive = new Set()
  const textToDraw = []

  // 粒子更新：非文本在 lighter 下直接绘制，文本仅记录，稍后用 source-over 绘制
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]

    if (p.type === 'text') {
      const dx = p.tx - p.x
      const dy = p.ty - p.y

      p.vx = p.vx * 0.82 + dx * 0.1
      p.vy = p.vy * 0.82 + dy * 0.1
      p.x += p.vx
      p.y += p.vy

      if (!p.arrived && dx * dx + dy * dy < 4) {
        p.arrived = true
        p.vx = 0
        p.vy = 0
      }

      if (p.arrived) {
        if (p.stayUntil && now < p.stayUntil) {
          p.alpha = 1
        } else {
          p.alpha -= p.fade
        }
      }

      if (p.groupId != null) {
        textGroupAlive.add(p.groupId)
      }
    } else {
      p.x += p.vx
      p.y += p.vy
      p.vx *= PARTICLE_FRICTION
      p.vy *= PARTICLE_FRICTION
      p.vy += PARTICLE_GRAVITY
      p.alpha -= p.fade
    }

    if (p.alpha <= 0 || p.y > h + 80 || p.x < -80 || p.x > w + 80) {
      particles.splice(i, 1)
      continue
    }

    const alphaVis = Math.pow(clamp(p.alpha, 0, 1), ALPHA_POWER)
    if (alphaVis <= 0) continue

    if (p.type === 'text') {
      const u = p.u != null ? p.u : 0.5
      const v = p.v != null ? p.v : 0.5
      const baseHue = p.baseHue != null ? p.baseHue : p.hue
      const palette = p.palette || buildAnalogousPalette(baseHue)

      const hueFromPalette = interpolatePalette(u, palette)
      const birth = p.birthTime != null ? p.birthTime : now
      const lifeT = clamp((now - birth) / 2000, 0, 1)
      const swayTime = Math.sin(lifeT * Math.PI * 2 + (p.flickerPhase || 0)) * (TEXT_HUE_SMALL_SWING * 0.5)
      const swayV = (v - 0.5) * TEXT_HUE_SMALL_SWING

      let hue = hueFromPalette + swayTime + swayV
      hue = clampHueAroundBase(baseHue, hue, TEXT_HUE_MAX_OFFSET)

      let sat = p.baseSat != null ? p.baseSat : p.sat != null ? p.sat : TEXT_SATURATION_RANGE[1]
      sat += (u - 0.5) * 4 + (v - 0.5) * 4
      sat = clamp(sat, TEXT_SATURATION_RANGE[0], TEXT_SATURATION_RANGE[1])

      let light = p.baseLight != null ? p.baseLight : p.light
      const flickerPhase = p.flickerPhase || 0
      const flicker = Math.sin(now * 0.003 + flickerPhase) * 2
      const band = (0.5 - Math.abs(v - 0.5)) * 4
      light = clamp(light + band + flicker, TEXT_LIGHTNESS_MIN, TEXT_LIGHTNESS_CAP)

      textToDraw.push({
        x: p.x,
        y: p.y,
        size: p.size,
        hue,
        sat,
        light,
        alpha: alphaVis,
        u,
        v
      })
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue} ${p.sat}% ${p.light}% / ${alphaVis})`
      ctx.fill()
    }
  }

  // 当某组所有文本粒子消失或超时后，从活动文本组中移除
  activeTextGroups = activeTextGroups.filter(g => g.expireAt > now && textGroupAlive.has(g.id))

  // 第二段：切换为 source-over 绘制文本主体，避免同形状高密度叠加导致的白化
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < textToDraw.length; i++) {
    const t = textToDraw[i]
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${t.hue} ${t.sat}% ${t.light}% / ${t.alpha})`
    ctx.fill()
  }

  requestAnimationFrame(step)
}

requestAnimationFrame(step)

// 交互：点击发射烟花
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const tx = e.clientX - rect.left
  const ty = e.clientY - rect.top
  spawnRocket(tx, ty)
})

// -------- 自动发射调度 --------
function startContinuous() {
  if (spawnerId) return

  const schedule = () => {
    const now = performance.now()
    const inBurst = now < burstUntil
    const intervalRange = inBurst ? BURST_SPAWN_INTERVAL : BASE_SPAWN_INTERVAL
    const delay = Math.floor(rand(intervalRange[0], intervalRange[1]))

    spawnerId = setTimeout(() => {
      if (fireworks.length < MAX_FIREWORKS && particles.length < MAX_PARTICLES * 0.95) {
        spawnRocket()

        // 小高潮期偶尔连发两枚，制造节奏上的小高潮
        if (inBurst && Math.random() < 0.45 && fireworks.length < MAX_FIREWORKS) {
          spawnRocket()
        }
      }

      // 从平缓期随机进入下一段小高潮
      if (!inBurst && Math.random() < BURST_CHANCE) {
        const dur = rand(BURST_DURATION[0], BURST_DURATION[1])
        burstUntil = performance.now() + dur
      }

      schedule()
    }, delay)
  }

  schedule()
}

window.enableFireworks = function () {
  startContinuous()
}

if (window.__gate_fireworks_pending) {
  window.enableFireworks()
}
