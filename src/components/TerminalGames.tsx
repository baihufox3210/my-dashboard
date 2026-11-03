import { useEffect, useRef, useState } from 'react'
import { unlock } from '../features/fun/achievements'

const columns = 26
const rows = 12
type Point = { x: number; y: number }

function randomFood(snake: Point[]): Point {
  for (;;) {
    const food = { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) }
    if (!snake.some((part) => part.x === food.x && part.y === food.y)) return food
  }
}

// Text-mode snake inside the terminal: arrow keys (or WASD) to steer, Esc / q to quit.
export function SnakeGame({ onExit }: { onExit: (score: number) => void }) {
  const start = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]
  const [view, setView] = useState({ snake: start, food: { x: 14, y: 6 }, score: 0 })
  const game = useRef({ snake: start, food: { x: 14, y: 6 }, score: 0, direction: { x: 1, y: 0 }, queued: { x: 1, y: 0 } })
  const exitRef = useRef(onExit)
  useEffect(() => { exitRef.current = onExit }, [onExit])

  useEffect(() => {
    const keys: Record<string, Point> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'q') { event.preventDefault(); exitRef.current(-1); return }
      const next = keys[event.key]
      if (!next) return
      event.preventDefault()
      const { direction } = game.current
      // No reversing straight into yourself.
      if (next.x !== -direction.x || next.y !== -direction.y) game.current.queued = next
    }
    window.addEventListener('keydown', onKey, true)
    const timer = window.setInterval(() => {
      const current = game.current
      current.direction = current.queued
      const head = current.snake[0] ?? { x: 0, y: 0 }
      const next = { x: (head.x + current.direction.x + columns) % columns, y: (head.y + current.direction.y + rows) % rows }
      if (current.snake.some((part) => part.x === next.x && part.y === next.y)) {
        window.clearInterval(timer)
        exitRef.current(current.score)
        return
      }
      const body = [next, ...current.snake]
      if (next.x === current.food.x && next.y === current.food.y) {
        current.score += 1
        current.food = randomFood(body)
        if (current.score >= 10) unlock('snake')
      } else {
        body.pop()
      }
      current.snake = body
      setView({ snake: body, food: current.food, score: current.score })
    }, 120)
    return () => { window.removeEventListener('keydown', onKey, true); window.clearInterval(timer) }
  }, [])

  const { snake, food, score } = view
  const grid = Array.from({ length: rows }, (_row, y) => Array.from({ length: columns }, (_column, x) => {
    if (snake[0]?.x === x && snake[0]?.y === y) return '◆'
    if (snake.some((part) => part.x === x && part.y === y)) return '■'
    return food.x === x && food.y === y ? '●' : '·'
  }).join(' ')).join('\n')

  return <div className="terminal-game">
    <p className="is-accent">🐍 snake · 分數 {score} · 方向鍵或 WASD 移動 · Esc 離開</p>
    <pre>{grid}</pre>
  </div>
}

const fakeCode = `#include <fox.h>
/* baihu-kernel: fox fire subsystem */
static int ignite_fox_fire(struct fox *f, unsigned long tails)
{
    if (!f || tails > NINE_TAILS)
        return -EINVAL;
    spin_lock(&f->den_lock);
    f->flame = kitsune_alloc(sizeof(struct flame), GFP_MOONLIGHT);
    for (int i = 0; i < tails; i++)
        f->flame->heat += tail_energy(f, i) << 2;
    spin_unlock(&f->den_lock);
    return bypass_firewall(f->flame) ?: grant_root(current);
}

int main(void)
{
    struct fox *baihu = summon("baihu", WHITE);
    printf("hacking the mainframe...\\n");
    while (!access_granted())
        ignite_fox_fire(baihu, 9);
    return 0; /* totally real hacking */
}
`

// Any key "types" plausible hacker code; press Alt three times for ACCESS GRANTED.
export function HackerTyper({ onExit }: { onExit: () => void }) {
  const [length, setLength] = useState(0)
  const [granted, setGranted] = useState(false)
  const alts = useRef(0)
  const outputRef = useRef<HTMLPreElement>(null)
  const exitRef = useRef(onExit)
  useEffect(() => { exitRef.current = onExit }, [onExit])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); exitRef.current(); return }
      event.preventDefault()
      if (event.key === 'Alt') {
        alts.current += 1
        if (alts.current >= 3) { alts.current = 0; setGranted(true); unlock('hacker') }
        return
      }
      setGranted(false)
      setLength((value) => value + 4)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => { outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }) }, [length])

  const text = fakeCode.repeat(Math.floor(length / fakeCode.length) + 1).slice(0, length)
  return <div className="terminal-game">
    <p className="is-muted">💻 hacker typer · 亂按鍵盤就對了 · 連按 3 次 Alt · Esc 離開</p>
    <pre ref={outputRef} className="hacker-typer">{text}<i className="hacker-cursor" /></pre>
    {granted && <p className="hacker-granted">ACCESS GRANTED</p>}
  </div>
}
