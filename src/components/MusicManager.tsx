import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { deleteMusicTrack, fetchMusicTracks, updateMusicTrackOrder, uploadMusicTracks } from '../features/blog/api'
import type { MusicTrack } from '../features/blog/article'

type MusicManagerProps = { onMessage: (message: string) => void }

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function MusicManager({ onMessage }: MusicManagerProps) {
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [trackToDelete, setTrackToDelete] = useState<MusicTrack | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchMusicTracks().then(setTracks).catch((error: unknown) => onMessage(error instanceof Error ? error.message : '無法載入音樂清單。')).finally(() => setLoading(false))
  }, [onMessage])

  useEffect(() => {
    const audio = previewAudioRef.current
    if (!audio) return
    const update = () => { setPreviewProgress(audio.currentTime); setPreviewDuration(audio.duration || 0) }
    const ended = () => setPreviewPlaying(false)
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('loadedmetadata', update)
    audio.addEventListener('ended', ended)
    return () => {
      audio.removeEventListener('timeupdate', update)
      audio.removeEventListener('loadedmetadata', update)
      audio.removeEventListener('ended', ended)
    }
  }, [])

  function addFiles(selected: File[]) {
    setFiles((current) => {
      const next = [...current]
      selected.filter((file) => file.name.toLowerCase().endsWith('.mp3')).forEach((file) => {
        const duplicate = next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)
        if (!duplicate) next.push(file)
      })
      return next
    })
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles([...(event.target.files ?? [])])
    event.target.value = ''
  }

  function dropFiles(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    addFiles([...event.dataTransfer.files])
  }

  async function upload() {
    if (!files.length) return
    setBusy(true)
    const form = new FormData()
    files.forEach((file) => form.append('tracks', file))
    form.set('fileNames', JSON.stringify(files.map((file) => file.name)))
    try {
      const uploaded = await uploadMusicTracks(form)
      setTracks((current) => [...current, ...uploaded])
      setFiles([])
      onMessage(`已上傳 ${uploaded.length} 首音樂。`)
    } catch (error) { onMessage(error instanceof Error ? error.message : '音樂上傳失敗。') }
    finally { setBusy(false) }
  }

  function moveTrack(from: number, to: number) {
    if (from === to || to < 0 || to >= tracks.length) return
    setTracks((current) => {
      const next = [...current]
      const [item] = next.splice(from, 1)
      if (!item) return current
      next.splice(to, 0, item)
      return next
    })
    setDraggedIndex(to)
  }

  async function finishDrag() {
    if (draggedIndex === null) return
    setDraggedIndex(null)
    setBusy(true)
    try {
      const saved = await updateMusicTrackOrder(tracks.map((track) => track.id))
      setTracks(saved)
      onMessage('音樂排序已儲存。')
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '音樂排序儲存失敗。')
      fetchMusicTracks().then(setTracks).catch(() => undefined)
    } finally { setBusy(false) }
  }

  async function togglePreview(track: MusicTrack) {
    const audio = previewAudioRef.current
    if (!audio) return
    if (previewTrackId === track.id && !audio.paused) {
      audio.pause()
      setPreviewPlaying(false)
      return
    }
    if (previewTrackId !== track.id) {
      audio.src = track.fileUrl
      audio.load()
      setPreviewTrackId(track.id)
      setPreviewProgress(0)
      setPreviewDuration(0)
    }
    try {
      await audio.play()
      setPreviewPlaying(true)
    } catch { setPreviewPlaying(false) }
  }

  function seekPreview(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value)
    if (previewAudioRef.current) previewAudioRef.current.currentTime = next
    setPreviewProgress(next)
  }

  async function removeTrack(track: MusicTrack) {
    setBusy(true)
    try {
      await deleteMusicTrack(track.id)
      setTracks((current) => current.filter((item) => item.id !== track.id).map((item, order) => ({ ...item, order })))
      if (previewTrackId === track.id) { previewAudioRef.current?.pause(); setPreviewTrackId(null); setPreviewPlaying(false) }
      setTrackToDelete(null)
      onMessage(`已移除「${track.title}」。`)
    } catch (error) { onMessage(error instanceof Error ? error.message : '音樂刪除失敗。') }
    finally { setBusy(false) }
  }

  return <section className="music-manager">
    <div className="music-manager-heading"><div><p className="admin-kicker">AUDIO LIBRARY</p><h2>音樂管理</h2><p>上傳 MP3 後，首頁訪客可以在播放器中切換收聽。拖曳清單即可保存播放順序。</p></div><button type="button" className="ui-button ui-button-primary" onClick={() => inputRef.current?.click()} disabled={busy}>＋ 選擇 MP3</button></div>
    <input ref={inputRef} className="music-file-input" type="file" accept="audio/mpeg,.mp3" multiple onChange={chooseFiles} />
    {files.length > 0 && <div className="music-upload-queue" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}><div><strong>待上傳 {files.length} 首</strong><span>{files.reduce((total, file) => total + file.size, 0) / 1024 / 1024 < 1 ? `${Math.round(files.reduce((total, file) => total + file.size, 0) / 1024)} KB` : `${(files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(1)} MB`}</span></div><div className="music-upload-files">{files.map((file, index) => <div className="music-upload-file" key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><button type="button" aria-label={`移除待上傳檔案 ${file.name}`} onClick={() => setFiles((current) => current.filter((_item, itemIndex) => itemIndex !== index))}>×</button></div>)}</div><button type="button" className="ui-button ui-button-primary music-upload-submit" onClick={() => void upload()} disabled={busy}>{busy ? '上傳中…' : '開始上傳'}</button></div>}
    <div className="music-list" aria-busy={loading || busy}>{loading ? <p className="music-empty">載入音樂清單…</p> : tracks.length ? tracks.map((track, index) => <article key={track.id} className={`music-track-row${draggedIndex === index ? ' is-dragging' : ''}`} onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDraggedIndex(index) }} onPointerMove={(event) => { if (draggedIndex === null) return; const rows = [...event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.music-track-row') ?? []]; const target = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2); moveTrack(draggedIndex, target < 0 ? rows.length - 1 : target) }} onPointerUp={() => void finishDrag()} onPointerCancel={() => setDraggedIndex(null)}><span className="music-drag-handle" aria-label="拖曳排序">⋮⋮</span><div className="music-track-number">{String(index + 1).padStart(2, '0')}</div><div className="music-track-copy"><strong>{track.title}</strong></div><div className="music-preview-controls" onPointerDown={(event) => event.stopPropagation()}><button type="button" className="music-preview-button" onClick={() => void togglePreview(track)} aria-label={`${previewTrackId === track.id && previewPlaying ? '暫停' : '試播'} ${track.title}`}>{previewTrackId === track.id && previewPlaying ? 'Ⅱ' : '▶'}</button><div className="music-preview-progress"><input type="range" min="0" max={previewTrackId === track.id ? previewDuration || 0 : 0} step="0.1" value={previewTrackId === track.id ? Math.min(previewProgress, previewDuration || 0) : 0} onChange={seekPreview} aria-label={`${track.title} 試播進度`} /><span>{previewTrackId === track.id ? formatTime(previewProgress) : '0:00'} / {previewTrackId === track.id ? formatTime(previewDuration) : '0:00'}</span></div></div><button type="button" className="music-delete" aria-label={`刪除 ${track.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setTrackToDelete(track)}>×</button></article>) : <div className="music-empty"><strong>尚未加入音樂</strong><p>選擇多個 MP3 檔案，建立你的播放清單。</p></div>}</div>
    <audio ref={previewAudioRef} preload="metadata" loop />
    <ConfirmDialog open={Boolean(trackToDelete)} title="移除這首音樂？" message={trackToDelete ? `「${trackToDelete.title}」移除後將無法復原。` : ''} busy={busy} onConfirm={() => trackToDelete ? removeTrack(trackToDelete) : undefined} onCancel={() => { if (!busy) setTrackToDelete(null) }} />
  </section>
}

export default MusicManager
