import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { achievementEvent, completionEvent, matrixEvent, unlock, type Achievement } from '../features/fun/achievements'
import { installConsoleAdventure } from '../features/fun/consoleAdventure'
import { funEffectEvent, funToastEvent, isAprilFools, isLunarNewYear, isPadoruSeason, lunarYearAnimal, playEffect, type FunEffect } from '../features/fun/memes'
import { getEasterEggPage, getPublicPage } from '../routes/routes'

const Terminal = lazy(() => import('./Terminal'))
const FoxRunner = lazy(() => import('./FoxRunner'))
const GameOfLife = lazy(() => import('./GameOfLife'))
const ZergRush = lazy(() => import('./ZergRush'))

const cardSelector = '.home-panel, .public-article-card, .recent-articles, .site-stats, .popular-tags-card, .project-card, .friend-card, .home-article'

function visibleCards() {
  return [...document.querySelectorAll<HTMLElement>(cardSelector)].filter((card) => {
    const box = card.getBoundingClientRect()
    return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
  })
}

// Thanos: half of the visible cards turn to dust, then come back.
function snap() {
  const cards = visibleCards().filter((card) => !card.parentElement?.closest(cardSelector))
  const doomed = cards.filter(() => Math.random() < .5)
  if (!doomed.length && cards[0]) doomed.push(cards[0])
  doomed.forEach((card, index) => { card.style.animationDelay = `${index * 120}ms`; card.classList.add('thanos-dust') })
  window.setTimeout(() => doomed.forEach((card) => { card.classList.remove('thanos-dust'); card.classList.add('thanos-return') }), 4200)
  window.setTimeout(() => doomed.forEach((card) => { card.classList.remove('thanos-return'); card.style.animationDelay = '' }), 5600)
}

// Google Gravity: every visible card drops to the bottom of the screen, then floats back.
function gravity() {
  const cards = visibleCards().filter((card) => !card.parentElement?.closest(cardSelector))
  cards.forEach((card) => {
    const box = card.getBoundingClientRect()
    card.style.transition = `transform ${900 + Math.random() * 500}ms cubic-bezier(.5, 0, .75, 1.4)`
    card.style.transform = `translateY(${Math.max(0, window.innerHeight - box.bottom - 6)}px) rotate(${(Math.random() - .5) * 24}deg)`
  })
  window.setTimeout(() => cards.forEach((card) => { card.style.transition = 'transform 900ms cubic-bezier(.2, .8, .2, 1)'; card.style.transform = '' }), 3800)
  window.setTimeout(() => cards.forEach((card) => { card.style.transition = '' }), 4800)
}

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
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺ01BAIHU165'
    const matrixColor = getComputedStyle(document.body).getPropertyValue('--theme-matrix').trim() || '#3cff7a'
    let frame = 0
    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, .08)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = matrixColor
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

// Idle screensaver: the fox logo bounces like an old DVD player and changes hue at each
// wall. A perfect corner hit is celebrated.
function DvdScreensaver({ onCorner }: { onCorner: () => void }) {
  const logoRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const logo = logoRef.current
    if (!logo) return
    let x = Math.random() * (window.innerWidth - 200)
    let y = Math.random() * (window.innerHeight - 90)
    let vx = 2.2
    let vy = 1.8
    let hue = 0
    let frame = 0
    const step = () => {
      const maxX = window.innerWidth - logo.offsetWidth
      const maxY = window.innerHeight - logo.offsetHeight
      x += vx
      y += vy
      let hitX = false
      let hitY = false
      if (x <= 0 || x >= maxX) { vx = -vx; x = Math.max(0, Math.min(maxX, x)); hitX = true }
      if (y <= 0 || y >= maxY) { vy = -vy; y = Math.max(0, Math.min(maxY, y)); hitY = true }
      if (hitX || hitY) { hue = (hue + 67) % 360; logo.style.filter = `hue-rotate(${hue}deg)` }
      // Within a few pixels of both walls at once counts as the legendary corner hit.
      if ((hitX && (y < 6 || y > maxY - 6)) || (hitY && (x < 6 || x > maxX - 6))) onCorner()
      logo.style.transform = `translate(${x}px, ${y}px)`
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [onCorner])
  return <div className="dvd-screensaver" aria-hidden="true"><div ref={logoRef} className="dvd-logo">🦊 BAIHU<small>VIDEO</small></div></div>
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
  const [offlineGame, setOfflineGame] = useState(false)
  const [androidToast, setAndroidToast] = useState<{ id: number; text: string } | null>(null)
  const [idle, setIdle] = useState(false)
  const [complete, setComplete] = useState(false)
  const cornerHit = useCallback(() => { unlock('dvd-corner'); playEffect('fireworks') }, [])
  const stopRain = useCallback(() => setRaining(false), [])
  const stopMatrix = useCallback(() => setMatrix(false), [])

  // Tab title: call the visitor back when they switch away.
  useEffect(() => {
    let original = document.title
    let timer = 0
    const onVisibility = () => {
      window.clearTimeout(timer)
      if (document.hidden) {
        original = document.title.startsWith('🦊') ? original : document.title
        document.title = '🦊 你去哪了？快回來～'
      } else {
        document.title = '🦊 歡迎回來！'
        timer = window.setTimeout(() => { document.title = original }, 2000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.clearTimeout(timer); document.title = original }
  }, [])

  // Idle for 90 seconds starts the DVD screensaver; any input ends it.
  useEffect(() => {
    let timer = 0
    const reset = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIdle(true) }, 90_000)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }))
    reset()
    return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)) }
  }, [])

  // April Fools: Comic Sans and upside-down headings for one day.
  useEffect(() => {
    if (!isAprilFools()) return
    document.body.classList.add('fun-april-fools')
    return () => document.body.classList.remove('fun-april-fools')
  }, [])

  useEffect(() => {
    let next = 1
    const show = (event: Event) => setAndroidToast({ id: next++, text: (event as CustomEvent<string>).detail })
    const celebrate = () => { setComplete(true); playEffect('fireworks') }
    window.addEventListener(funToastEvent, show)
    window.addEventListener(completionEvent, celebrate)
    installConsoleAdventure()
    return () => { window.removeEventListener(funToastEvent, show); window.removeEventListener(completionEvent, celebrate) }
  }, [])

  useEffect(() => {
    if (!androidToast) return
    const timer = window.setTimeout(() => setAndroidToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [androidToast])

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
      typed = `${typed}${key.length === 1 ? key : ' '}`.slice(-8)
      if (typed.endsWith('fox')) { typed = ''; unlock('fox-runner'); setFoxRun((count) => count + 1) }
      if (typed.endsWith('sus')) { typed = ''; playEffect('sus') }
      if (typed.endsWith('nyan')) { typed = ''; playEffect('nyan') }
      if (typed.endsWith('67')) { typed = ''; playEffect('six-seven') }
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
      if (next === 'snap') { unlock('thanos'); snap(); return }
      if (next === 'gravity') { unlock('gravity'); gravity(); return }
      if (next === 'six-seven') unlock('six-seven')
      if (next === 'sus') unlock('sus')
      if (next === 'nyan') unlock('nyan')
      if (['barrel-roll', 'askew', 'tableflip', 'six-seven', 'blink'].includes(next)) {
        if (next === 'six-seven') setEffect('six-seven')
        const className = `fun-${next}`
        document.body.classList.remove(className)
        void document.body.offsetWidth
        document.body.classList.add(className)
        window.setTimeout(() => document.body.classList.remove(className), next === 'askew' || next === 'blink' ? 6000 : next === 'six-seven' ? 2600 : 2200)
        return
      }
      setEffect(next)
    }
    window.addEventListener(funEffectEvent, play)
    // Like Chrome's dinosaur: losing the connection offers a game.
    const goneOffline = () => setOfflineGame(true)
    window.addEventListener('offline', goneOffline)
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
    return () => { window.removeEventListener(funEffectEvent, play); window.removeEventListener('offline', goneOffline); window.clearTimeout(timer) }
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
    {effect === 'zerg' && <Suspense fallback={null}><ZergRush onDone={stopEffect} /></Suspense>}
    {effect === 'sus' && <div className="sus-space" role="status" onAnimationEnd={(event) => { if (event.target === event.currentTarget) stopEffect() }}>
      <span className="sus-crewmate" aria-hidden="true">ඞ</span>
      <p>baihu was not The Impostor.</p>
      <small>1 Impostor remains.</small>
    </div>}
    {effect === 'nyan' && <div className="nyan-fox" aria-hidden="true" onAnimationEnd={stopEffect}><i /><span>🦊</span></div>}
    {effect === 'fireworks' && <EmojiRain onDone={stopEffect} emoji={['🎆', '🎇', '✨', '🎉', '🦊']} />}
    {complete && <div className="completion-banner" role="status">
      <strong>🏆 全成就達成！</strong>
      <p>你找到了 baihu 網站的所有彩蛋。</p>
      <div><a className="ui-button ui-button-primary ui-button-small" href="/certificate" onClick={() => setComplete(false)}>領取通關證書</a><button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => setComplete(false)}>稍後</button></div>
    </div>}
    {idle && <DvdScreensaver onCorner={cornerHit} />}
    {androidToast && <div className="android-toast" key={androidToast.id} role="status">{androidToast.text}</div>}
    {effect === 'six-seven' && <div className="six-seven" aria-hidden="true" onAnimationEnd={stopEffect}><span>🤷</span><b>6</b><b>7</b><span>🤷</span></div>}
    {(effect === 'dino' || offlineGame) && <Suspense fallback={null}><FoxRunner offline={offlineGame && effect !== 'dino'} onClose={() => { setOfflineGame(false); stopEffect() }} /></Suspense>}
    {effect === 'life' && <Suspense fallback={null}><GameOfLife onDone={stopEffect} /></Suspense>}
    {effect === 'padoru' && <div className="padoru" aria-hidden="true" onAnimationEnd={stopEffect}><span>🦊🎅</span><b>🛷</b><em>PADORU PADORU!</em></div>}
    {effect === 'newyear' && <>
      <EmojiRain onDone={stopEffect} emoji={['🧧', '🧧', '🧨', '🍊', '✨', lunarYearAnimal()]} />
      <div className="lunar-banner" role="status"><strong>新年快樂 {lunarYearAnimal()}</strong><p>恭喜你發財{'\u3000'}恭喜你精彩</p><small>—— 劉德華（大概）</small></div>
    </>}
    {foxRun > 0 && <span key={foxRun} className="fox-run" aria-hidden="true" onAnimationEnd={() => setFoxRun(0)}>🦊</span>}
    {toast && <div className="achievement-toast" role="status" key={toast.id}>
      <span aria-hidden="true">{toast.emoji}</span>
      <div><small>成就解鎖</small><strong>{toast.title}</strong><p>{toast.description}</p></div>
    </div>}
  </>
}

export default FunLayer
