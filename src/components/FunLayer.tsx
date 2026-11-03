import { lazy, Suspense, useEffect, useState } from 'react'
import { achievementEvent, unlock, type Achievement } from '../features/fun/achievements'

const Terminal = lazy(() => import('./Terminal'))

export const terminalOpenEvent = 'terminal:open'
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const rainEmoji = ['🦊', '🌸', '✨', '🍡', '🦊', '🌸']

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function EmojiRain({ onDone }: { onDone: () => void }) {
  const [drops] = useState(() => Array.from({ length: 36 }, (_unused, index) => ({
    id: index,
    emoji: rainEmoji[index % rainEmoji.length],
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

// Site-wide easter eggs: the terminal (` or Ctrl/⌘+K), the Konami code, and achievement toasts.
function FunLayer() {
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [raining, setRaining] = useState(false)
  const [toasts, setToasts] = useState<Achievement[]>([])

  useEffect(() => {
    console.info('%c🦊 嗨，看原始碼的你！%c\n按 ` 或 Ctrl/⌘ + K 打開終端機，試試 help。', 'font-size:14px;font-weight:700', 'font-size:12px')
  }, [])

  useEffect(() => {
    let progress = 0
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
      progress = key === konami[progress] ? progress + 1 : key === konami[0] ? 1 : 0
      if (progress === konami.length) {
        progress = 0
        unlock('konami')
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setRaining(true)
      }
    }
    const openTerminal = () => setTerminalOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(terminalOpenEvent, openTerminal)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(terminalOpenEvent, openTerminal)
    }
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
    {raining && <EmojiRain onDone={() => setRaining(false)} />}
    {toast && <div className="achievement-toast" role="status" key={toast.id}>
      <span aria-hidden="true">{toast.emoji}</span>
      <div><small>成就解鎖</small><strong>{toast.title}</strong><p>{toast.description}</p></div>
    </div>}
  </>
}

export default FunLayer
