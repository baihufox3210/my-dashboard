import { useEffect, useRef } from 'react'
import { unlock } from '../features/fun/achievements'

// Conway's Game of Life over the page for a few seconds (as Google does for the search).
function GameOfLife({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    unlock('life')
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const size = 12
    const columns = Math.ceil(window.innerWidth / size)
    const rows = Math.ceil(window.innerHeight / size)
    canvas.width = columns * size
    canvas.height = rows * size
    const color = getComputedStyle(document.body).getPropertyValue('--theme-primary').trim() || '#806348'
    let cells = Array.from({ length: rows * columns }, () => Math.random() < .22)
    const step = () => {
      const next = cells.map((alive, index) => {
        const x = index % columns
        const y = Math.floor(index / columns)
        let neighbours = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && cells[((y + dy + rows) % rows) * columns + ((x + dx + columns) % columns)]) neighbours++
        }
        return neighbours === 3 || (alive && neighbours === 2)
      })
      cells = next
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = color
      cells.forEach((alive, index) => { if (alive) context.fillRect((index % columns) * size + 1, Math.floor(index / columns) * size + 1, size - 2, size - 2) })
    }
    step()
    const interval = window.setInterval(step, 110)
    const timer = window.setTimeout(onDone, 9000)
    return () => { window.clearInterval(interval); window.clearTimeout(timer) }
  }, [onDone])

  return <canvas ref={canvasRef} className="game-of-life" aria-hidden="true" onClick={onDone} />
}

export default GameOfLife
