import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from './useEscapeKey'
import { unlock } from '../features/fun/achievements'

type Zergling = { id: number; x: number; y: number; hp: number; target: HTMLElement | null }

const total = 30
const cardSelector = '.home-panel, .public-article-card, .recent-articles, .site-stats, .popular-tags-card, .project-card, .friend-card'

// Google's "zerg rush": little o's pour in and eat the page. Click each three times.
function ZergRush({ onDone }: { onDone: () => void }) {
  const [zerglings, setZerglings] = useState<Zergling[]>([])
  const [killed, setKilled] = useState(0)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const state = useRef({ spawned: 0, nextId: 1, list: [] as Zergling[], health: new Map<HTMLElement, number>() })
  useEscapeKey(true, onDone, 70)

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(cardSelector)].filter((card) => {
      const box = card.getBoundingClientRect()
      return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight && !card.parentElement?.closest(cardSelector)
    })
    const current = state.current
    cards.forEach((card) => current.health.set(card, 100))
    const pickTarget = () => cards.filter((card) => (current.health.get(card) ?? 0) > 0)[Math.floor(Math.random() * cards.length)] ?? cards.find((card) => (current.health.get(card) ?? 0) > 0) ?? null
    let frame = 0
    let last = performance.now()
    let spawnClock = 0

    const loop = (now: number) => {
      const delta = Math.min(50, now - last)
      last = now
      spawnClock += delta
      if (current.spawned < total && spawnClock > 380) {
        spawnClock = 0
        current.spawned += 1
        current.list.push({ id: current.nextId++, x: Math.random() * window.innerWidth, y: -20, hp: 3, target: pickTarget() })
      }
      for (const zergling of current.list) {
        if (!zergling.target || (current.health.get(zergling.target) ?? 0) <= 0) zergling.target = pickTarget()
        if (!zergling.target) continue
        const box = zergling.target.getBoundingClientRect()
        const dx = box.left + box.width / 2 - zergling.x
        const dy = box.top + box.height / 2 - zergling.y
        const distance = Math.hypot(dx, dy)
        if (distance > 30) {
          zergling.x += (dx / distance) * delta * .11
          zergling.y += (dy / distance) * delta * .11
        } else {
          // Eating: the card fades as its health drops.
          const health = Math.max(0, (current.health.get(zergling.target) ?? 0) - delta * .012)
          current.health.set(zergling.target, health)
          zergling.target.style.opacity = String(health / 100)
        }
      }
      setZerglings([...current.list])
      const alive = [...current.health.values()].some((health) => health > 0)
      if (!alive) { setResult('lose'); return }
      if (current.spawned >= total && current.list.length === 0) { setResult('win'); unlock('zerg'); return }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      cards.forEach((card) => { card.style.opacity = '' })
    }
  }, [])

  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(onDone, 3200)
    return () => window.clearTimeout(timer)
  }, [result, onDone])

  function hit(id: number) {
    const current = state.current
    const zergling = current.list.find((item) => item.id === id)
    if (!zergling) return
    zergling.hp -= 1
    if (zergling.hp <= 0) {
      current.list = current.list.filter((item) => item.id !== id)
      setKilled((count) => count + 1)
    }
    setZerglings([...current.list])
  }

  return createPortal(<div className="zerg-layer">
    <p className="zerg-score">Zerg Rush · 擊退 {killed} / {total}{result === 'win' ? ' · GG 🎉' : result === 'lose' ? ' · 網站被吃光了 😱' : ' · 每個 o 點三下'}</p>
    {zerglings.map((zergling) => <button key={zergling.id} type="button" className={`zergling hp-${zergling.hp}`} style={{ transform: `translate(${zergling.x - 14}px, ${zergling.y - 14}px)` }} onPointerDown={() => hit(zergling.id)} aria-label="Zergling">o</button>)}
  </div>, document.body)
}

export default ZergRush
