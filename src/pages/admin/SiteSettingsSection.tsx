import { useEffect, useRef, useState } from 'react'
import FileDropzone from '../../components/FileDropzone'
import useEscapeKey from '../../components/useEscapeKey'
import { fetchSiteSettings, updateSiteSettings } from '../../features/blog/api'
import type { SiteSettings } from '../../features/blog/article'
import { applySiteBackground } from '../../features/blog/background'

type SectionProps = { onMessage: (message: string) => void }
type BackgroundViewport = 'desktop' | 'mobile'
const blankSettings: SiteSettings = { siteName: '', biography: '', experience: '', backgroundPositionX: 50, backgroundPositionY: 50, backgroundDesktopPositionX: 50, backgroundDesktopPositionY: 50, backgroundMobilePositionX: 50, backgroundMobilePositionY: 50 }

function SiteSettingsSection({ onMessage }: SectionProps) {
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState(blankSettings)
  const [background, setBackground] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState('')

  const [backgroundDragging, setBackgroundDragging] = useState(false)
  const [backgroundAdjustOpen, setBackgroundAdjustOpen] = useState(false)
  const [backgroundViewport, setBackgroundViewport] = useState<BackgroundViewport>('desktop')
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const previewImageRef = useRef<HTMLImageElement>(null)
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number; positionX: number; positionY: number; overflowX: number; overflowY: number } | null>(null)
  const backgroundPositionLabelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let active = true
    if (!background) {
      queueMicrotask(() => { if (active) setBackgroundPreview('') })
      return () => { active = false }
    }
    const url = URL.createObjectURL(background)
    queueMicrotask(() => { if (active) setBackgroundPreview(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [background])

  useEffect(() => {
    fetchSiteSettings().then(setSettings).catch((error: unknown) => onMessage(error instanceof Error ? error.message : '無法載入後台資料。'))
  }, [onMessage])

  useEscapeKey(backgroundAdjustOpen, () => setBackgroundAdjustOpen(false), 20)

  async function saveSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); onMessage('')
    const form = new FormData(); form.set('siteName', settings.siteName); form.set('biography', settings.biography); form.set('experience', settings.experience)
    form.set('backgroundPositionX', String(settings.backgroundPositionX ?? 50))
    form.set('backgroundPositionY', String(settings.backgroundPositionY ?? 50))
    form.set('backgroundDesktopPositionX', String(settings.backgroundDesktopPositionX ?? settings.backgroundPositionX ?? 50))
    form.set('backgroundDesktopPositionY', String(settings.backgroundDesktopPositionY ?? settings.backgroundPositionY ?? 50))
    form.set('backgroundMobilePositionX', String(settings.backgroundMobilePositionX ?? settings.backgroundPositionX ?? 50))
    form.set('backgroundMobilePositionY', String(settings.backgroundMobilePositionY ?? settings.backgroundPositionY ?? 50))
    if (background) form.set('background', background)
    try {
      const saved = await updateSiteSettings(form)
      setSettings(saved); setBackground(null)
      applySiteBackground(saved)
      onMessage('網站設定已儲存。')
    }
    catch (error) { onMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  function startBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!backgroundAdjustOpen || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const image = previewImageRef.current
    const frame = previewFrameRef.current
    if (!image || !frame || !image.naturalWidth || !image.naturalHeight) return
    const coverScale = Math.max(frame.clientWidth / image.naturalWidth, frame.clientHeight / image.naturalHeight)
    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      positionX: backgroundViewport === 'desktop'
        ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX ?? 50
        : settings.backgroundMobilePositionX ?? settings.backgroundPositionX ?? 50,
      positionY: backgroundViewport === 'desktop'
        ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY ?? 50
        : settings.backgroundMobilePositionY ?? settings.backgroundPositionY ?? 50,
      overflowX: Math.max(1, image.naturalWidth * coverScale - frame.clientWidth),
      overflowY: Math.max(1, image.naturalHeight * coverScale - frame.clientHeight),
    }
    setBackgroundDragging(true)
  }

  function moveBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const image = previewImageRef.current
    if (!image) return
    event.preventDefault()
    const positionX = Math.max(0, Math.min(100, start.positionX - ((event.clientX - start.x) / start.overflowX) * 100))
    const positionY = Math.max(0, Math.min(100, start.positionY - ((event.clientY - start.y) / start.overflowY) * 100))
    start.x = event.clientX
    start.y = event.clientY
    start.positionX = positionX
    start.positionY = positionY
    image.style.objectPosition = `${positionX}% ${positionY}%`
    if (backgroundPositionLabelRef.current) backgroundPositionLabelRef.current.textContent = `${backgroundViewport === 'desktop' ? '電腦' : '手機'}位置 ${Math.round(positionX)}% / ${Math.round(positionY)}%`
  }

  function stopBackgroundDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (start?.pointerId === event.pointerId) {
      setSettings((current) => backgroundViewport === 'desktop'
        ? { ...current, backgroundDesktopPositionX: start.positionX, backgroundDesktopPositionY: start.positionY }
        : { ...current, backgroundMobilePositionX: start.positionX, backgroundMobilePositionY: start.positionY })
    }
    pointerStartRef.current = null
    setBackgroundDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <form className="admin-form-card admin-site-settings-form" onSubmit={saveSite}><div className="admin-form-intro"><div><h2>網站設定</h2></div><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</button></div><div className="admin-form-grid">
          <label className="admin-field span-two">網站名稱<input value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} /></label><label className="admin-field span-two">About 自介（Markdown） <small>支援標題、清單、粗體與連結</small><textarea rows={8} value={settings.biography} onChange={(event) => setSettings({ ...settings, biography: event.target.value })} placeholder={'## 關於我\n\n在這裡寫下你的故事…'} /></label><label className="admin-field span-two">經歷<textarea rows={5} value={settings.experience} onChange={(event) => setSettings({ ...settings, experience: event.target.value })} /></label>
          <div className="admin-form-section span-two"><span>首頁背景</span></div><div className="admin-field span-two"><span>背景圖片</span><FileDropzone title="選擇或拖入圖片" file={background} previewUrl={settings.backgroundUrl} onFile={setBackground} />
            {(backgroundPreview || settings.backgroundUrl) && <button type="button" className="background-open-editor" onClick={() => { setBackgroundViewport('desktop'); setBackgroundAdjustOpen(true) }}>開啟背景編輯器 <span>電腦／手機分別調整</span></button>}
            {backgroundAdjustOpen && (backgroundPreview || settings.backgroundUrl) && <div className="image-adjust-backdrop background-adjust-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBackgroundAdjustOpen(false) }}>
              <section className={`image-adjust-modal background-adjust-modal ${backgroundViewport === 'mobile' ? 'is-mobile' : 'is-desktop'}`} role="dialog" aria-modal="true" aria-labelledby="background-adjust-title">
                <header><div><strong id="background-adjust-title">調整首頁背景</strong><small>拖曳圖片定位 · 電腦與手機會分別保存位置</small></div><button type="button" aria-label="關閉背景編輯器" onClick={() => setBackgroundAdjustOpen(false)}>×</button></header>
                <div className="background-modal-toolbar" role="tablist" aria-label="選擇背景預覽裝置"><span>預覽裝置</span><div><button type="button" className={backgroundViewport === 'desktop' ? 'active' : ''} onClick={() => setBackgroundViewport('desktop')}>電腦</button><button type="button" className={backgroundViewport === 'mobile' ? 'active' : ''} onClick={() => setBackgroundViewport('mobile')}>手機</button></div></div>
                <div className={`image-adjust-viewport background-adjust-viewport ${backgroundViewport === 'mobile' ? 'is-mobile' : 'is-desktop'}${backgroundDragging ? ' is-dragging' : ''}`} ref={previewFrameRef} onPointerDown={startBackgroundDrag} onPointerMove={moveBackgroundDrag} onPointerUp={stopBackgroundDrag} onPointerCancel={stopBackgroundDrag} onLostPointerCapture={stopBackgroundDrag}>
                  <img ref={previewImageRef} src={backgroundPreview || settings.backgroundUrl} alt={`${backgroundViewport === 'mobile' ? '手機' : '電腦'}首頁背景預覽`} draggable={false} style={{ objectPosition: `${(backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX : settings.backgroundMobilePositionX ?? settings.backgroundPositionX) ?? 50}% ${(backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY : settings.backgroundMobilePositionY ?? settings.backgroundPositionY) ?? 50}%` }} />
                  <span className="background-modal-hint">{backgroundDragging ? '正在調整位置' : '左鍵拖曳 · 手機長按後拖曳'}</span>
                </div>
                <footer><span ref={backgroundPositionLabelRef}>{backgroundViewport === 'desktop' ? '電腦' : '手機'}位置 {Math.round((backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionX ?? settings.backgroundPositionX : settings.backgroundMobilePositionX ?? settings.backgroundPositionX) ?? 50)}% / {Math.round((backgroundViewport === 'desktop' ? settings.backgroundDesktopPositionY ?? settings.backgroundPositionY : settings.backgroundMobilePositionY ?? settings.backgroundPositionY) ?? 50)}%</span><button type="button" className="ui-button ui-button-primary ui-button-small" onClick={() => setBackgroundAdjustOpen(false)}>完成調整</button></footer>
              </section>
            </div>}
          </div>
        </div></form>
}

export default SiteSettingsSection
