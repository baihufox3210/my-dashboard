import { useEffect, useId, useRef, useState } from 'react'

type FileDropzoneProps = {
  title: string
  hint?: string
  file?: File | null
  previewUrl?: string
  imagePosition?: string
  imageScale?: number
  aspectRatio?: number
  onImagePositionChange?: (position: string) => void
  onImageScaleChange?: (scale: number) => void
  onFile: (file: File | null) => void
}

type Point = { x: number; y: number }
type DragState = {
  pointerId: number
  x: number
  y: number
  positionX: number
  positionY: number
  overflowX: number
  overflowY: number
}

type ImageMetrics = {
  overflowX: number
  overflowY: number
}

function parsePosition(position: string) {
  const [x, y] = position.split(' ').map((value) => Number.parseFloat(value))
  return {
    x: Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50,
    y: Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50,
  }
}

function getRenderedMetrics(image: HTMLImageElement, frame: HTMLElement): ImageMetrics | null {
  const frameRect = frame.getBoundingClientRect()
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (!frameRect.width || !frameRect.height || !naturalWidth || !naturalHeight) return null

  // Match object-fit: cover in the card preview, without measuring a transformed image.
  const coverScale = Math.max(frameRect.width / naturalWidth, frameRect.height / naturalHeight)
  return {
    overflowX: Math.max(0, naturalWidth * coverScale - frameRect.width),
    overflowY: Math.max(0, naturalHeight * coverScale - frameRect.height),
  }
}

function FileDropzone({
  title,
  hint = '點擊選取，或將圖片拖曳至此',
  file,
  previewUrl,
  imagePosition = '50% 50%',
  imageScale = 1,
  aspectRatio = 16 / 9,
  onImagePositionChange,
  onImageScaleChange,
  onFile,
}: FileDropzoneProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [localPreview, setLocalPreview] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const longPressRef = useRef<number | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const editorFrameRef = useRef<HTMLDivElement>(null)
  const editorImageRef = useRef<HTMLImageElement>(null)
  const scaleLabelRef = useRef<HTMLSpanElement>(null)
  const positionRef = useRef(imagePosition)
  const scaleRef = useRef(imageScale)
  const scaleCommitTimerRef = useRef<number | null>(null)
  const imageSrc = localPreview || previewUrl
  const canAdjust = Boolean(imageSrc && onImagePositionChange)

  useEffect(() => {
    positionRef.current = imagePosition
    if (editorImageRef.current) editorImageRef.current.style.objectPosition = imagePosition
  }, [imagePosition])

  useEffect(() => {
    scaleRef.current = imageScale
    if (editorImageRef.current) editorImageRef.current.style.transform = `scale(${imageScale})`
    if (scaleLabelRef.current) scaleLabelRef.current.textContent = `縮放 ${Math.round(imageScale * 100)}%`
  }, [imageScale])

  useEffect(() => () => {
    if (scaleCommitTimerRef.current !== null) window.clearTimeout(scaleCommitTimerRef.current)
  }, [])

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
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  function applyEditorImage(position = positionRef.current, scale = scaleRef.current) {
    const image = editorImageRef.current
    if (!image) return
    image.style.objectPosition = position
    image.style.transform = `scale(${scale})`
  }

  function commitPosition() {
    onImagePositionChange?.(positionRef.current)
  }

  function commitScale() {
    if (scaleCommitTimerRef.current !== null) {
      window.clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    onImageScaleChange?.(scaleRef.current)
  }

  function scheduleScaleCommit() {
    if (scaleCommitTimerRef.current !== null) window.clearTimeout(scaleCommitTimerRef.current)
    scaleCommitTimerRef.current = window.setTimeout(() => {
      scaleCommitTimerRef.current = null
      onImageScaleChange?.(scaleRef.current)
    }, 120)
  }

  function updateEditorScale(nextScale: number) {
    scaleRef.current = nextScale
    applyEditorImage()
    if (scaleLabelRef.current) scaleLabelRef.current.textContent = `縮放 ${Math.round(nextScale * 100)}%`
  }

  function getNextPosition(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag) return
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    const nextX = drag.overflowX > 0
      ? Math.max(0, Math.min(100, drag.positionX - deltaX / drag.overflowX * 100))
      : 50
    const nextY = drag.overflowY > 0
      ? Math.max(0, Math.min(100, drag.positionY - deltaY / drag.overflowY * 100))
      : 50
    drag.x = event.clientX
    drag.y = event.clientY
    drag.positionX = nextX
    drag.positionY = nextY
    positionRef.current = `${Number(nextX.toFixed(2))}% ${Number(nextY.toFixed(2))}%`
    applyEditorImage()
  }

  function beginDrag(event: React.PointerEvent<HTMLElement>) {
    const frame = editorFrameRef.current
    const image = editorImageRef.current
    if (!frame || !image) return
    const metrics = getRenderedMetrics(image, frame)
    if (!metrics) return
    const { x, y } = parsePosition(positionRef.current)
    const scale = scaleRef.current
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      positionX: x,
      positionY: y,
      overflowX: metrics.overflowX * scale,
      overflowY: metrics.overflowY * scale,
    }
    frame.setPointerCapture(event.pointerId)
  }

  function startPositionDrag(event: React.PointerEvent<HTMLElement>) {
    if (!canAdjust || pointersRef.current.size > 0) return
    event.preventDefault()
    event.stopPropagation()
    if (event.pointerType === 'touch') {
      clearLongPress()
      longPressRef.current = window.setTimeout(() => beginDrag(event), 350)
    } else {
      beginDrag(event)
    }
  }

  function finishPositionDrag(event: React.PointerEvent<HTMLElement>) {
    clearLongPress()
    if (dragRef.current?.pointerId === event.pointerId) {
      commitPosition()
      dragRef.current = null
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handlePinchStart(event: React.PointerEvent<HTMLElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      clearLongPress()
      const points = [...pointersRef.current.values()]
      pinchRef.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: scaleRef.current }
      dragRef.current = null
    }
  }

  function handlePinchMove(event: React.PointerEvent<HTMLElement>) {
    const pinch = pinchRef.current
    if (!pinch || !onImageScaleChange) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointersRef.current.values()]
    if (points.length < 2) return
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    updateEditorScale(Math.max(1, Math.min(3, Number((pinch.scale * distance / pinch.distance).toFixed(2)))))
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLElement>) {
    const wasPinching = Boolean(pinchRef.current)
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    finishPositionDrag(event)
    if (wasPinching) commitScale()
  }

  function finishAdjustment() {
    commitPosition()
    commitScale()
    setAdjustOpen(false)
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
      {imageSrc ? <span className="file-dropzone-preview" style={{ aspectRatio: canAdjust ? (Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9) : undefined, height: canAdjust ? 'auto' : undefined }}><img src={imageSrc} alt="" draggable={false} style={{ objectPosition: imagePosition, transform: `scale(${imageScale})`, transformOrigin: 'center' }} onClick={(event) => { event.preventDefault(); event.stopPropagation() }} /></span> : null}
      <span className="file-dropzone-copy"><strong>{file?.name || title}</strong><small>{canAdjust ? '開啟調整視窗後拖曳；手機請長按 · ' : ''}{hint}</small></span>
      {canAdjust && <button type="button" className="file-position-toggle" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAdjustOpen(true) }}>調整圖片位置</button>}
    </label>
    {adjustOpen && imageSrc && <div className="image-adjust-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finishAdjustment() }}>
      <section className="image-adjust-modal" role="dialog" aria-modal="true" aria-label="調整封面圖片">
        <header><div><strong>調整封面圖片</strong><small>比例同卡片封面 · 滑鼠拖曳／手機長按 · 滾輪或雙指縮放</small></div><button type="button" aria-label="關閉調整視窗" onClick={finishAdjustment}>×</button></header>
        <div
          className="image-adjust-viewport"
          ref={editorFrameRef}
          style={{ aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9 }}
          onWheel={(event) => {
            event.preventDefault()
            updateEditorScale(Math.max(1, Math.min(3, Number((scaleRef.current - event.deltaY * 0.002).toFixed(2)))))
            scheduleScaleCommit()
          }}
          onPointerDown={(event) => { startPositionDrag(event); handlePinchStart(event); event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={(event) => { getNextPosition(event); handlePinchMove(event) }}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <img ref={editorImageRef} src={imageSrc} alt="封面預覽" draggable={false} style={{ objectPosition: imagePosition, transform: `scale(${imageScale})`, transformOrigin: 'center', pointerEvents: 'none' }} />
        </div>
        <footer><span ref={scaleLabelRef}>縮放 {Math.round(imageScale * 100)}%</span><button type="button" onClick={() => { updateEditorScale(1); commitScale() }}>重設縮放</button><button type="button" className="save-button" onClick={finishAdjustment}>完成</button></footer>
      </section>
    </div>}
  </>
}

export default FileDropzone
