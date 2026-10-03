import { useEffect, useId, useRef, useState } from 'react'

type FileDropzoneProps = {
  title: string
  hint?: string
  file?: File | null
  previewUrl?: string
  imagePosition?: string
  imageScale?: number
  onImagePositionChange?: (position: string) => void
  onImageScaleChange?: (scale: number) => void
  onFile: (file: File | null) => void
}

type DragStart = { pointerId: number; x: number; y: number; positionX: number; positionY: number }

function getCoverTransform(position: string, scale: number) {
  const [positionX, positionY] = position.split(' ').map((value) => Number.parseFloat(value))
  const x = Number.isFinite(positionX) ? positionX : 50
  const y = Number.isFinite(positionY) ? positionY : 50
  // Limit translation to half of the scaled overflow. At 0%/100%, the
  // corresponding image edge is exactly aligned with the viewport edge.
  const maxTranslation = (scale - 1) * 50
  return `translate(${(((50 - x) / 50) * maxTranslation).toFixed(2)}%, ${(((50 - y) / 50) * maxTranslation).toFixed(2)}%) scale(${scale})`
}

function FileDropzone({
  title,
  hint = '點擊選取，或將圖片拖曳至此',
  file,
  previewUrl,
  imagePosition = '50% 50%',
  imageScale = 1,
  onImagePositionChange,
  onImageScaleChange,
  onFile,
}: FileDropzoneProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [localPreview, setLocalPreview] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const dragStart = useRef<DragStart | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null)
  const imageSrc = localPreview || previewUrl
  const previewScale = 1.15 * imageScale
  const canAdjust = Boolean(imageSrc && onImagePositionChange)

  useEffect(() => {
    let active = true
    if (!file) {
      queueMicrotask(() => { if (active) setLocalPreview('') })
      return () => { active = false }
    }
    const url = URL.createObjectURL(file)
    queueMicrotask(() => { if (active) setLocalPreview(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file])

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function updatePosition(event: React.PointerEvent<HTMLElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId || pointers.current.size > 1 || !onImagePositionChange) return
    // Subtract the pointer delta so the image content follows the user's hand.
    const nextX = Math.max(0, Math.min(100, start.positionX - ((event.clientX - start.x) / event.currentTarget.clientWidth) * 100))
    const nextY = Math.max(0, Math.min(100, start.positionY - ((event.clientY - start.y) / event.currentTarget.clientHeight) * 100))
    // Consume each move incrementally. This prevents a late/coalesced pointer
    // event, or a second touch used for pinch zoom, from jumping the image back.
    start.x = event.clientX
    start.y = event.clientY
    start.positionX = nextX
    start.positionY = nextY
    onImagePositionChange(`${Math.round(nextX)}% ${Math.round(nextY)}%`)
  }

  function startPositionDrag(event: React.PointerEvent<HTMLElement>) {
    if (!canAdjust || pointers.current.size > 0) return
    event.preventDefault()
    event.stopPropagation()
    const begin = () => {
      const [positionX, positionY] = imagePosition.split(' ').map((value) => Number.parseFloat(value))
      dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, positionX: positionX || 50, positionY: positionY || 50 }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (event.pointerType === 'touch') longPressTimer.current = window.setTimeout(begin, 450)
    else begin()
  }

  function finishPositionDrag(event: React.PointerEvent<HTMLElement>) {
    clearLongPress()
    if (dragStart.current?.pointerId === event.pointerId) dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handlePinchStart(event: React.PointerEvent<HTMLElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const points = [...pointers.current.values()]
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      pinchStart.current = { distance, scale: imageScale }
    }
  }

  function handlePinchMove(event: React.PointerEvent<HTMLElement>) {
    const start = pinchStart.current
    if (!start || !onImageScaleChange) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    if (points.length < 2) return
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    onImageScaleChange(Math.max(1, Math.min(3, Number((start.scale * distance / start.distance).toFixed(2)))))
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    finishPositionDrag(event)
  }

  function acceptFiles(files: FileList | null) {
    const selected = files?.[0]
    if (selected?.type.startsWith('image/')) onFile(selected)
  }

  return <>
    <label
      className={`file-dropzone${dragging ? ' is-dragging' : ''}${imageSrc ? ' has-image' : ''}`}
      htmlFor={inputId}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files) }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <input id={inputId} type="file" accept="image/*" onChange={(event) => { acceptFiles(event.target.files); event.currentTarget.value = '' }} />
      {imageSrc ? <img src={imageSrc} alt="" draggable={false} style={{ objectPosition: '50% 50%', transform: getCoverTransform(imagePosition, previewScale), transformOrigin: 'center' }} onPointerDown={startPositionDrag} onPointerMove={updatePosition} onPointerUp={finishPositionDrag} onPointerCancel={finishPositionDrag} onClick={(event) => { event.preventDefault(); event.stopPropagation() }} /> : <span className="file-dropzone-icon">↑</span>}
      <span className="file-dropzone-copy"><strong>{file?.name || title}</strong><small>{canAdjust ? '開啟調整視窗後拖曳；手機請長按 · ' : ''}{hint}</small></span>
      {canAdjust && <button type="button" className="file-position-toggle" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAdjustOpen(true) }}>調整圖片位置</button>}
    </label>
    {adjustOpen && imageSrc && <div className="image-adjust-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdjustOpen(false) }}>
      <section className="image-adjust-modal" role="dialog" aria-modal="true" aria-label="調整封面圖片">
        <header><div><strong>調整封面圖片</strong><small>滑鼠滾輪或雙指縮放 · 左鍵拖曳 · 手機長按後拖曳</small></div><button type="button" aria-label="關閉調整視窗" onClick={() => setAdjustOpen(false)}>×</button></header>
        <div
          className="image-adjust-viewport"
          onWheel={(event) => { event.preventDefault(); onImageScaleChange?.(Math.max(1, Math.min(3, Number((imageScale - event.deltaY * 0.002).toFixed(2))))) }}
          onPointerDown={(event) => { startPositionDrag(event); handlePinchStart(event); event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={(event) => { updatePosition(event); handlePinchMove(event) }}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <img src={imageSrc} alt="封面預覽" draggable={false} style={{ objectPosition: '50% 50%', transform: getCoverTransform(imagePosition, previewScale), pointerEvents: 'none' }} />
        </div>
        <footer><span>縮放 {Math.round(imageScale * 100)}%</span><button type="button" onClick={() => onImageScaleChange?.(1)}>重設縮放</button><button type="button" className="save-button" onClick={() => setAdjustOpen(false)}>完成</button></footer>
      </section>
    </div>}
  </>
}

export default FileDropzone
