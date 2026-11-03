import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { achievementEvent, matrixEvent, unlock, type Achievement } from '../features/fun/achievements'
import { funEffectEvent, isLunarNewYear, isPadoruSeason, lunarYearAnimal, playEffect, type FunEffect } from '../features/fun/memes'
import { getEasterEggPage, getPublicPage } from '../routes/routes'

const Terminal = lazy(() => import('./Terminal'))

export const terminalOpenEvent = 'terminal:open'
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const rainEmoji = ['🦊', '🌸', '✨', '🍡', '🦊', '🌸']

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function EmojiRain({ onDone, emoji = rainEmoji }: { onDone: () => void; emoji?: string[] }) {
  const [drops] = useState(() => Array.from({ length: 36 }, (_unused, index) => ({
    id: index,
    emoji: emoji[index % emoji.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.6 + Math.random() * 1.8,
    size: 1.1 + Math.random() * 1.2,
  })))
  useEffect(() => {
    const timer = window.setTimeout(onDone, 5000)
    return () => window.clearTimeout(timer)
  }, [onDone])
  return <div className="emoji-rain" aria-hidden="true">
    {drops.map((drop) => <span key={drop.id} style={{ left: `${drop.left}%`, animationDelay: `${drop.delay}s`, animationDuration: `${drop.duration}s`, fontSize: `${drop.size}rem` }}>{drop.emoji}</span>)}
  </div>
}

function MatrixRain({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const size = 16
    const drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -40)
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺ01白狐BAIHU165'
    let frame = 0
    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, .08)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#3cff7a'
      context.font = `${size}px monospace`
      drops.forEach((y, index) => {
        context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)] ?? '0', index * size, y * size)
        drops[index] = y * size > canvas.height && Math.random() > .97 ? 0 : y + 1
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    const timer = window.setTimeout(onDone, 5200)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [onDone])
  return <canvas ref={canvasRef} className="matrix-rain" aria-hidden="true" onClick={onDone} />
}

// Site-wide easter eggs: the terminal (` or Ctrl/⌘+K), the Konami code, and achievement toasts.
function FunLayer() {
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [raining, setRaining] = useState(false)
  const [toasts, setToasts] = useState<Achievement[]>([])
  const [matrix, setMatrix] = useState(false)
  const [foxRun, setFoxRun] = useState(0)
  const [effect, setEffect] = useState<FunEffect | null>(null)
  const stopEffect = useCallback(() => setEffect(null), [])
  const stopRain = useCallback(() => setRaining(false), [])
  const stopMatrix = useCallback(() => setMatrix(false), [])

  useEffect(() => {
    console.info('%c🦊 嗨，看原始碼的你！%c\n按 ` 或 Ctrl/⌘ + K 打開終端機，試試 help。', 'font-size:14px;font-weight:700', 'font-size:12px')
  }, [])

  useEffect(() => {
    let progress = 0
    let typed = ''
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setTerminalOpen((open) => !open)
        return
      }
      if (isTyping(event.target)) return
      if (event.key === '`' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        setTerminalOpen(true)
        return
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      // Typing "fox" sends a fox running across the bottom of the screen.
      typed = `${typed}${key.length === 1 ? key : ' '}`.slice(-3)
      if (typed === 'fox') { typed = ''; unlock('fox-runner'); setFoxRun((count) => count + 1) }
      progress = key === konami[progress] ? progress + 1 : key === konami[0] ? 1 : 0
      if (progress === konami.length) {
        progress = 0
        unlock('konami')
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setRaining(true)
      }
    }
    const openTerminal = () => setTerminalOpen(true)
    const startMatrix = () => {
      unlock('matrix')
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setMatrix(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(terminalOpenEvent, openTerminal)
    window.addEventListener(matrixEvent, startMatrix)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(terminalOpenEvent, openTerminal)
      window.removeEventListener(matrixEvent, startMatrix)
    }
  }, [])

  // Padoru, red envelopes and page tricks, from the terminal or the calendar.
  useEffect(() => {
    const play = (event: Event) => {
      const next = (event as CustomEvent<FunEffect>).detail
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && next !== 'newyear') return
      if (['barrel-roll', 'askew', 'tableflip'].includes(next)) {
        const className = `fun-${next}`
        document.body.classList.remove(className)
        void document.body.offsetWidth
        document.body.classList.add(className)
        window.setTimeout(() => document.body.classList.remove(className), next === 'askew' ? 6000 : 2200)
        return
      }
      setEffect(next)
    }
    window.addEventListener(funEffectEvent, play)
    // Seasonal surprises: once per browser session, on the home page only.
    const seasonal = isLunarNewYear() ? 'newyear' : isPadoruSeason() ? 'padoru' : null
    let timer = 0
    if (seasonal && getPublicPage() === 'home' && !getEasterEggPage()) {
      const key = `seasonal-${seasonal}`
      let seen = false
      try { seen = sessionStorage.getItem(key) === '1' } catch { /* storage unavailable */ }
      // Marked as seen only once it actually plays, so a remount before then doesn't skip it.
      if (!seen) timer = window.setTimeout(() => {
        try { sessionStorage.setItem(key, '1') } catch { /* storage unavailable */ }
        unlock(seasonal === 'newyear' ? 'lunar-new-year' : 'padoru')
        playEffect(seasonal)
      }, 2500)
    }
    return () => { window.removeEventListener(funEffectEvent, play); window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const show = (event: Event) => setToasts((current) => [...current, (event as CustomEvent<Achievement>).detail])
    window.addEventListener(achievementEvent, show)
    // Unlocked here, once the toast listener exists.
    unlock('first-visit')
    if (new Date().getHours() < 5) unlock('night-owl')
    return () => window.removeEventListener(achievementEvent, show)
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), 3600)
    return () => window.clearTimeout(timer)
  }, [toasts])

  const toast = toasts[0]
  return <>
    {terminalOpen && <Suspense fallback={null}><Terminal onClose={() => setTerminalOpen(false)} /></Suspense>}
    {raining && <EmojiRain onDone={stopRain} />}
    {matrix && <MatrixRain onDone={stopMatrix} />}
    {effect === 'padoru' && <div className="padoru" aria-hidden="true" onAnimationEnd={stopEffect}><span>🦊🎅</span><b>🛷</b><em>PADORU PADORU!</em></div>}
    {effect === 'newyear' && <>
      <EmojiRain onDone={stopEffect} emoji={['🧧', '🧧', '🧨', '🍊', '✨', lunarYearAnimal()]} />
      <div className="lunar-banner" role="status"><strong>新年快樂 {lunarYearAnimal()}</strong><p>恭喜你發財　恭喜你精彩</p><small>—— 劉德華（大概）</small></div>
    </>}
    {foxRun > 0 && <span key={foxRun} className="fox-run" aria-hidden="true" onAnimationEnd={() => setFoxRun(0)}>🦊</span>}
    {toast && <div className="achievement-toast" role="status" key={toast.id}>
      <span aria-hidden="true">{toast.emoji}</span>
      <div><small>成就解鎖</small><strong>{toast.title}</strong><p>{toast.description}</p></div>
    </div>}
  </>
}

export default FunLayer
