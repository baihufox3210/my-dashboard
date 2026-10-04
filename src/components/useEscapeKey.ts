import { useEffect, useLayoutEffect, useRef } from 'react'

type EscapeLayer = {
  priority: number
  order: number
  close: () => void
}

const escapeLayers = new Map<symbol, EscapeLayer>()
let nextOrder = 0
let listening = false

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing) return

  const topLayer = [...escapeLayers.values()].reduce<EscapeLayer | null>((top, layer) => {
    if (!top || layer.priority > top.priority || (layer.priority === top.priority && layer.order > top.order)) return layer
    return top
  }, null)
  if (!topLayer) return

  event.preventDefault()
  event.stopImmediatePropagation()
  topLayer.close()
}

function addEscapeLayer(layer: EscapeLayer) {
  if (!listening) {
    window.addEventListener('keydown', handleEscape, true)
    listening = true
  }

  const key = Symbol('escape-layer')
  escapeLayers.set(key, layer)
  return () => {
    escapeLayers.delete(key)
    if (escapeLayers.size === 0 && listening) {
      window.removeEventListener('keydown', handleEscape, true)
      listening = false
    }
  }
}

export default function useEscapeKey(active: boolean, onEscape: () => void, priority = 0) {
  const closeRef = useRef(onEscape)
  useLayoutEffect(() => {
    closeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    return addEscapeLayer({
      priority,
      order: ++nextOrder,
      close: () => closeRef.current(),
    })
  }, [active, priority])
}
