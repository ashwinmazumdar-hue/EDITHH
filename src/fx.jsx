import React, { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web/build/player/lottie_light'
import loaderData from './loader.json'

/* ═══════════════════════════════════════════════════════════
   GLOBAL MOTION STYLES
═══════════════════════════════════════════════════════════ */
const CSS = `
@property --fx-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

@keyframes fxRise    { from { opacity: 0; transform: translateY(26px) scale(.97); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes fxFade    { from { opacity: 0; } to { opacity: 1; } }
@keyframes fxSlideL  { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes fxSlideR  { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
@keyframes fxPop     { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
@keyframes fxFloat   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes fxPulse   { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes fxSpin    { to { --fx-angle: 360deg; } }
@keyframes fxShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes fxSweep   { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(260%) skewX(-20deg); } }
@keyframes fxScan    { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
@keyframes fxMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes fxDot     { 0%,80%,100% { transform: scale(.5); opacity: .3; } 40% { transform: scale(1); opacity: 1; } }
@keyframes fxGlow    { 0%,100% { box-shadow: 0 0 0 0 var(--c, #00D4FF); } 50% { box-shadow: 0 0 22px 2px var(--c, #00D4FF); } }
@keyframes fxRing    { from { transform: translate(-50%,-50%) scale(.2); opacity: .9; } to { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
@keyframes fxLetter  { 0% { opacity: 0; transform: translateY(14px) rotateX(90deg); filter: blur(4px); } 100% { opacity: 1; transform: none; filter: none; } }
@keyframes fxGlitch  { 0%,92%,100% { text-shadow: 0 0 12px rgba(0,212,255,.6); transform: none; }
                       93% { text-shadow: -2px 0 #FF3366, 2px 0 #00D4FF; transform: translateX(1px); }
                       95% { text-shadow: 2px 0 #7B61FF, -2px 0 #00FF88; transform: translateX(-1px); }
                       97% { text-shadow: 0 0 12px rgba(0,212,255,.6); transform: none; } }
@keyframes fxToast   { from { opacity: 0; transform: translateY(20px) scale(.95); } to { opacity: 1; transform: none; } }
@keyframes fxBar     { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes fxOrbit   { from { transform: rotate(0deg) translateX(var(--r)) rotate(0deg); } to { transform: rotate(360deg) translateX(var(--r)) rotate(-360deg); } }

.fx-rise   { animation: fxRise .8s cubic-bezier(.22,1,.36,1) backwards; animation-delay: var(--d, 0ms); }
.fx-fade   { animation: fxFade .6s ease backwards; animation-delay: var(--d, 0ms); }
.fx-slideL { animation: fxSlideL .55s cubic-bezier(.22,1,.36,1) backwards; animation-delay: var(--d, 0ms); }
.fx-slideR { animation: fxSlideR .55s cubic-bezier(.22,1,.36,1) backwards; animation-delay: var(--d, 0ms); }
.fx-pop    { animation: fxPop .6s cubic-bezier(.34,1.56,.64,1) backwards; animation-delay: var(--d, 0ms); }
.fx-float  { animation: fxFloat 4s ease-in-out infinite; }
.fx-pulse  { animation: fxPulse 1.8s ease-in-out infinite; }
.fx-page   { animation: fxRise .6s cubic-bezier(.22,1,.36,1) backwards; }

.fx-card { position: relative; overflow: hidden; transform-style: preserve-3d; will-change: transform;
  transition: transform .25s cubic-bezier(.22,1,.36,1), border-color .3s, box-shadow .3s; }
.fx-card::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--c, #00D4FF) 22%, transparent), transparent 65%); }
.fx-card:hover::after { opacity: 1; }
.fx-card:hover { box-shadow: 0 18px 50px -18px var(--c, #00D4FF); border-color: color-mix(in srgb, var(--c, #00D4FF) 55%, transparent) !important; }

.fx-border::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: conic-gradient(from var(--fx-angle), transparent 0 60%, var(--c, #00D4FF) 78%, #fff 82%, var(--c, #00D4FF) 86%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  animation: fxSpin 4s linear infinite; }

.fx-shine { position: relative; overflow: hidden; }
.fx-shine::before { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: 0; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); transform: translateX(-120%) skewX(-20deg); }
.fx-shine:hover::before { animation: fxSweep .8s ease; }

.fx-btn { transition: transform .18s ease, box-shadow .25s ease, background .2s, color .2s, border-color .2s !important; }
.fx-btn:hover  { transform: translateY(-2px); box-shadow: 0 8px 24px -10px var(--c, #00D4FF); }
.fx-btn:active { transform: translateY(0) scale(.97); }

.fx-nav { transition: all .25s cubic-bezier(.22,1,.36,1) !important; }
.fx-nav:hover { transform: translateX(4px); color: #fff !important; background: rgba(255,255,255,.04) !important; }

.fx-text-shimmer { background: linear-gradient(90deg, #00D4FF 0%, #fff 20%, #7B61FF 40%, #00D4FF 60%);
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent !important;
  animation: fxShimmer 4s linear infinite; }
.fx-glitch { animation: fxGlitch 6s infinite; display: inline-block; }

.fx-row { animation: fxSlideL .45s cubic-bezier(.22,1,.36,1) backwards; animation-delay: var(--d, 0ms); transition: background .2s; }
.fx-row:hover { background: rgba(0,212,255,.06) !important; }

.fx-grow { transform-origin: left center; animation: fxBar 1.2s cubic-bezier(.22,1,.36,1) backwards; animation-delay: var(--d, 0ms); }

.fx-scanline { position: fixed; left: 0; right: 0; height: 140px; pointer-events: none; z-index: 1;
  background: linear-gradient(180deg, transparent, rgba(0,212,255,.035), transparent); animation: fxScan 9s linear infinite; }

input:focus, textarea:focus { box-shadow: 0 0 0 3px rgba(0,212,255,.15); border-color: rgba(0,212,255,.6) !important; transition: box-shadow .2s, border-color .2s; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('edith-fx')) {
  const el = document.createElement('style'); el.id = 'edith-fx'; el.textContent = CSS; document.head.appendChild(el)
}

/* ═══════════════════════════════════════════════════════════
   LOTTIE LOADER (your animation)
═══════════════════════════════════════════════════════════ */
export const LottieLoader = ({ size = 160 }) => {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    let anim
    try {
      anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop: true, autoplay: true, animationData: loaderData })
    } catch (e) { console.error('Lottie failed', e) }
    return () => anim && anim.destroy()
  }, [])
  return <div ref={ref} style={{ width: size, height: size, filter: 'drop-shadow(0 0 24px rgba(200,40,240,.45))' }} />
}

// Full-screen loading overlay built around the Lottie animation
export const LoadingScreen = ({ label = 'LOADING EDITH', sub = '', progress = null, overlay = false }) => (
  <div style={{
    position: overlay ? 'fixed' : 'relative', inset: overlay ? 0 : undefined, zIndex: overlay ? 9999 : 'auto',
    minHeight: '100vh', width: '100%', background: overlay ? 'rgba(2,6,16,0.92)' : '#020610',
    backdropFilter: overlay ? 'blur(12px)' : undefined,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
  }} className="fx-fade">
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, borderRadius: '50%',
          border: '1px solid rgba(123,97,255,.35)', animation: `fxRing 3s ease-out ${i}s infinite` }} />
      ))}
      <LottieLoader size={190} />
    </div>
    <div className="fx-text-shimmer" style={{ fontFamily: 'Space Mono', fontSize: 13, fontWeight: 700, letterSpacing: 6 }}>{label}</div>
    {sub && <div className="fx-pulse" style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{sub}</div>}
    {progress && (
      <div style={{ width: 340 }}>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress.pct}%`, background: 'linear-gradient(90deg,#00D4FF,#7B61FF,#FF3366)', backgroundSize: '200% 100%',
            animation: 'fxShimmer 2s linear infinite', transition: 'width .35s ease', boxShadow: '0 0 16px rgba(123,97,255,.7)', borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(255,255,255,.45)' }}>
          <span>{progress.current} of {progress.total} files</span>
          <span style={{ color: '#00D4FF' }}>{progress.pct}%</span>
        </div>
        {progress.name && <div style={{ fontFamily: 'Space Mono', fontSize: 8, color: 'rgba(255,255,255,.3)', marginTop: 6, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progress.name}</div>}
        {progress.rows > 0 && <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#00FF88', marginTop: 6, textAlign: 'center' }}><CountUp value={progress.rows.toLocaleString('en-IN')} duration={400} /> rows saved</div>}
      </div>
    )}
  </div>
)

/* ═══════════════════════════════════════════════════════════
   COUNT-UP: animates the number inside any string ("₹2.47 Cr", "1,23,456", "0.84%")
═══════════════════════════════════════════════════════════ */
export const CountUp = ({ value, duration = 1400 }) => {
  const str = String(value ?? '')
  const m = str.match(/-?[\d,]*\.?\d+/)
  const target = m ? parseFloat(m[0].replace(/,/g, '')) : null
  const decimals = m && m[0].includes('.') ? m[0].split('.')[1].length : 0
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null || isNaN(target)) return
    let raf, start
    const f0 = from.current
    const step = (t) => {
      if (!start) start = t
      const p = Math.min((t - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 4)
      setV(f0 + (target - f0) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  if (target == null || isNaN(target)) return <>{str}</>
  const shown = v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return <>{str.slice(0, m.index)}{shown}{str.slice(m.index + m[0].length)}</>
}

/* ═══════════════════════════════════════════════════════════
   TILT: 3D tilt + spotlight that follows the cursor
═══════════════════════════════════════════════════════════ */
export const Tilt = ({ children, color = '#00D4FF', max = 8, className = '', style = {}, delay = 0, ...rest }) => {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-3px)`
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`)
  }
  const onLeave = () => { if (ref.current) ref.current.style.transform = '' }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`fx-card fx-rise ${className}`}
      style={{ '--c': color, '--d': `${delay}ms`, ...style }} {...rest}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED LOGO: letters drop in, then shimmer and glitch
═══════════════════════════════════════════════════════════ */
export const AnimatedLogo = ({ size = 16, spacing = 5 }) => (
  <span className="fx-glitch" style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: size, letterSpacing: spacing, perspective: 400 }}>
    {'EDITH'.split('').map((ch, i) => (
      <span key={i} className="fx-text-shimmer" style={{ display: 'inline-block', animation: `fxLetter .7s cubic-bezier(.22,1,.36,1) ${i * 90}ms both, fxShimmer 4s linear ${i * 90}ms infinite` }}>{ch}</span>
    ))}
  </span>
)

/* ═══════════════════════════════════════════════════════════
   TYPING DOTS for EDITH AI
═══════════════════════════════════════════════════════════ */
export const TypingDots = ({ color = '#7B61FF' }) => (
  <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
    {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: color, animation: `fxDot 1.2s ease-in-out ${i * 0.16}s infinite` }} />)}
  </span>
)

/* ═══════════════════════════════════════════════════════════
   STAR FIELD: depth layers, constellations, nebulae, shooting stars,
   cursor gravity, and a warp burst on tab change (window event 'edith-warp')
═══════════════════════════════════════════════════════════ */
export const StarField = ({ density = 1 }) => {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d')
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    resize(); window.addEventListener('resize', resize)

    const mouse = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 }
    const N = Math.round(220 * density)
    const stars = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
      r: Math.random() * 1.3 + 0.2, tw: Math.random() * Math.PI * 2, hue: Math.random() < 0.15 ? 280 : Math.random() < 0.3 ? 160 : 200,
    }))
    const nebulae = [
      { x: .18, y: .25, r: 380, c: '123,97,255', a: .07, s: .00012 },
      { x: .78, y: .68, r: 420, c: '0,212,255', a: .06, s: .0001 },
      { x: .88, y: .12, r: 300, c: '255,51,102', a: .045, s: .00015 },
      { x: .4, y: .9, r: 340, c: '0,255,136', a: .035, s: .00009 },
    ]
    const shoots = []
    let warp = 0
    const onWarp = () => { warp = 1 }
    const onMouse = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY }
    window.addEventListener('edith-warp', onWarp); window.addEventListener('mousemove', onMouse)
    const shootTimer = setInterval(() => {
      if (document.hidden) return
      shoots.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, vx: 6 + Math.random() * 5, vy: 2 + Math.random() * 2.5, life: 1, len: 14 + Math.random() * 10 })
    }, 2600)

    let raf, t = 0
    const draw = () => {
      t++
      mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06
      ctx.clearRect(0, 0, W, H)

      nebulae.forEach((n, i) => {
        const nx = n.x * W + Math.sin(t * n.s * 60 + i) * 40 - (mouse.x - W / 2) * 0.02
        const ny = n.y * H + Math.cos(t * n.s * 50 + i) * 30 - (mouse.y - H / 2) * 0.02
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r)
        g.addColorStop(0, `rgba(${n.c},${n.a * (1 + warp)})`); g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g; ctx.fillRect(nx - n.r, ny - n.r, n.r * 2, n.r * 2)
      })

      const cx = W / 2, cy = H / 2
      const px = (mouse.x - cx) / cx, py = (mouse.y - cy) / cy
      stars.forEach(s => {
        s.tw += 0.02
        if (warp > 0.01) {
          const dx = s.x - cx, dy = s.y - cy
          s.x += dx * 0.06 * warp * s.z; s.y += dy * 0.06 * warp * s.z
          if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) { s.x = cx + (Math.random() - .5) * 80; s.y = cy + (Math.random() - .5) * 80 }
        } else {
          s.x += 0.04 * s.z; s.y += 0.02 * s.z
          if (s.x > W) s.x = 0; if (s.y > H) s.y = 0
        }
        const dx = mouse.x - s.x, dy = mouse.y - s.y, d = Math.hypot(dx, dy)
        let ox = -px * 18 * s.z, oy = -py * 18 * s.z
        if (d < 160) { ox += dx * (1 - d / 160) * 0.18; oy += dy * (1 - d / 160) * 0.18 }
        s.sx = s.x + ox; s.sy = s.y + oy
        const op = (0.35 + 0.65 * s.z) * (0.6 + 0.4 * Math.sin(s.tw))
        if (warp > 0.05) {
          ctx.strokeStyle = `hsla(${s.hue},90%,80%,${op})`; ctx.lineWidth = s.r * s.z * 1.4
          ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.sx - (s.x - cx) * 0.08 * warp, s.sy - (s.y - cy) * 0.08 * warp); ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(s.sx, s.sy, s.r * (0.6 + s.z * 0.8), 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${s.hue},90%,85%,${op})`; ctx.fill()
          if (s.z > 0.85 && Math.sin(s.tw) > 0.85) {
            ctx.strokeStyle = `hsla(${s.hue},90%,85%,${op * 0.5})`; ctx.lineWidth = 0.5
            const k = s.r * 4
            ctx.beginPath(); ctx.moveTo(s.sx - k, s.sy); ctx.lineTo(s.sx + k, s.sy); ctx.moveTo(s.sx, s.sy - k); ctx.lineTo(s.sx, s.sy + k); ctx.stroke()
          }
        }
      })
      warp *= 0.93

      // constellation lines near the cursor
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i]; if (Math.hypot(a.sx - mouse.x, a.sy - mouse.y) > 220) continue
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j], d = Math.hypot(a.sx - b.sx, a.sy - b.sy)
          if (d < 90) { ctx.strokeStyle = `rgba(0,212,255,${0.22 * (1 - d / 90)})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke() }
        }
      }

      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i]
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * s.len, s.y - s.vy * s.len)
        g.addColorStop(0, `rgba(255,255,255,${s.life})`); g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * s.len, s.y - s.vy * s.len); ctx.stroke()
        s.x += s.vx; s.y += s.vy; s.life -= 0.014
        if (s.life <= 0) shoots.splice(i, 1)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); clearInterval(shootTimer); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); window.removeEventListener('edith-warp', onWarp) }
  }, [density])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

export const triggerWarp = () => window.dispatchEvent(new Event('edith-warp'))

/* ═══════════════════════════════════════════════════════════
   CURSOR: glowing halo with a lagging ring, and a ripple on every click
═══════════════════════════════════════════════════════════ */
export const CursorFX = () => {
  const glow = useRef(null), ring = useRef(null)
  const [ripples, setRipples] = useState([])
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const p = { x: -500, y: -500 }, q = { x: -500, y: -500 }
    let raf, hover = false
    const move = (e) => { p.x = e.clientX; p.y = e.clientY; hover = !!e.target.closest('button, a, input, [role="button"], .fx-card') }
    const click = (e) => {
      const id = Math.random()
      setRipples(r => [...r, { id, x: e.clientX, y: e.clientY }])
      setTimeout(() => setRipples(r => r.filter(x => x.id !== id)), 700)
    }
    const loop = () => {
      q.x += (p.x - q.x) * 0.18; q.y += (p.y - q.y) * 0.18
      if (glow.current) glow.current.style.transform = `translate(${p.x - 260}px, ${p.y - 260}px)`
      if (ring.current) ring.current.style.transform = `translate(${q.x - 16}px, ${q.y - 16}px) scale(${hover ? 1.6 : 1})`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mousedown', click); loop()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', move); window.removeEventListener('mousedown', click) }
  }, [])
  return (
    <>
      <div ref={glow} style={{ position: 'fixed', left: 0, top: 0, width: 520, height: 520, borderRadius: '50%', pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, rgba(123,97,255,0.04) 35%, transparent 65%)' }} />
      <div ref={ring} style={{ position: 'fixed', left: 0, top: 0, width: 32, height: 32, borderRadius: '50%', pointerEvents: 'none', zIndex: 10000,
        border: '1.5px solid rgba(0,212,255,.55)', transition: 'transform .12s ease-out', mixBlendMode: 'screen' }} />
      {ripples.map(r => (
        <div key={r.id} style={{ position: 'fixed', left: r.x, top: r.y, width: 40, height: 40, borderRadius: '50%', pointerEvents: 'none', zIndex: 10000,
          border: '2px solid rgba(0,212,255,.8)', animation: 'fxRing .7s ease-out forwards' }} />
      ))}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   TICKER: scrolling live strip of platform numbers
═══════════════════════════════════════════════════════════ */
export const Ticker = ({ items = [] }) => {
  if (!items.length) return null
  const row = items.map((it, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 38 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.color, boxShadow: `0 0 8px ${it.color}` }} />
      <span style={{ color: it.color, fontWeight: 700 }}>{it.label}</span>
      <span style={{ color: 'rgba(255,255,255,.55)' }}>{it.text}</span>
    </span>
  ))
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(0,212,255,.06)', background: 'rgba(0,212,255,.02)',
      fontFamily: 'Space Mono', fontSize: 9, padding: '6px 0', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <div style={{ display: 'inline-block', animation: `fxMarquee ${Math.max(20, items.length * 5)}s linear infinite` }}>{row}{row}</div>
    </div>
  )
}

/* Tilt handlers for any existing element: <div {...tilt()} className="fx-card"> */
export const tilt = (max = 7) => ({
  onMouseMove: (e) => {
    const el = e.currentTarget, r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-3px)`
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`)
  },
  onMouseLeave: (e) => { e.currentTarget.style.transform = '' },
})
