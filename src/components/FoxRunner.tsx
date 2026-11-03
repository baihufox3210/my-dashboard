import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from './useEscapeKey'
import { unlock } from '../features/fun/achievements'

type Obstacle = { x: number; width: number; height: number; emoji: string }

const width = 640
const height = 180
const ground = 150
const gravity = .9
const jumpVelocity = -14

// Chrome's offline dinosaur game, starring the fox. Space, ↑ or a tap jumps.
function FoxRunner({ offline, onClose }: { offline: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const jumpRef = useRef<() => void>(() => undefined)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('fox-runner-best')) || 0 } catch { return 0 } })
  const [over, setOver] = useState(false)
  const [round, setRound] = useState(0)
  useEscapeKey(true, onClose, 60)

  useEffect(() => { unlock('dino') }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ink = getComputedStyle(document.body).getPropertyValue('--theme-card-ink').trim() || '#29231e'
    let foxY = ground
    let velocity = 0
    let speed = 6
    let distance = 0
    let nextObstacle = 60
    let frame = 0
    let alive = true
    const obstacles: Obstacle[] = []
    jumpRef.current = () => { if (alive && foxY >= ground) velocity = jumpVelocity }

    const draw = () => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = ink
      context.fillRect(0, ground + 2, width, 1)
      context.font = '30px sans-serif'
      context.textBaseline = 'bottom'
      context.save()
      context.translate(60 + 15, 0)
      context.scale(-1, 1)
      context.fillText('🦊', -15, foxY)
      context.restore()
      for (const obstacle of obstacles) {
        context.font = `${obstacle.height}px sans-serif`
        context.fillText(obstacle.emoji, obstacle.x, ground + 2)
      }
    }

    const tick = () => {
      velocity += gravity
      foxY = Math.min(ground, foxY + velocity)
      distance += speed
      speed = Math.min(14, 6 + distance / 2500)
      nextObstacle -= 1
      if (nextObstacle <= 0) {
        const tall = Math.random() < .35
        obstacles.push({ x: width, width: tall ? 26 : 22, height: tall ? 36 : 26, emoji: tall ? '🌵' : Math.random() < .5 ? '🪨' : '🍄' })
        nextObstacle = 45 + Math.floor(Math.random() * 55) - Math.floor(speed * 1.5)
      }
      for (const obstacle of obstacles) obstacle.x -= speed
      while (obstacles[0] && obstacles[0].x < -40) obstacles.shift()
      // The fox occupies roughly x 62–86 and the 24px above foxY.
      const hit = obstacles.some((obstacle) => obstacle.x < 84 && obstacle.x + obstacle.width > 64 && foxY > ground - obstacle.height + 8)
      setScore(Math.floor(distance / 40))
      draw()
      if (hit) {
        alive = false
        setOver(true)
        const final = Math.floor(distance / 40)
        setBest((previous) => {
          const next = Math.max(previous, final)
          try { localStorage.setItem('fox-runner-best', String(next)) } catch { /* storage unavailable */ }
          return next
        })
        return
      }
      frame = requestAnimationFrame(tick)
    }
    draw()
    frame = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(frame) }
  }, [round])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'ArrowUp') return
      event.preventDefault()
      if (over) { setOver(false); setRound((value) => value + 1) } else jumpRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over])

  const press = () => { if (over) { setOver(false); setRound((value) => value + 1) } else jumpRef.current() }

  return createPortal(
    <div className="fox-runner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="fox-runner" role="dialog" aria-modal="true" aria-label="狐狸跑酷">
        <header>
          <div><strong>{offline ? '沒有網路連線' : '狐狸跑酷'}</strong><small>{offline ? '趁網路回來前，跑一下吧' : '空白鍵、↑ 或點畫面跳躍'}</small></div>
          <span>HI {String(best).padStart(5, '0')} · {String(score).padStart(5, '0')}</span>
          <button type="button" aria-label="關閉" onClick={onClose}>×</button>
        </header>
        <canvas ref={canvasRef} width={width} height={height} onPointerDown={press} />
        {over && <p className="fox-runner-over">GAME OVER · 按空白鍵或點畫面再來一次</p>}
      </section>
    </div>,
    document.body,
  )
}

export default FoxRunner
