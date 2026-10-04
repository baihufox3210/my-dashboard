import { useEffect, useRef, useState } from 'react'
import useEscapeKey from './useEscapeKey'
import { useMusicPlayer } from './MusicPlayerContext'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function FloatingMusicPlayer({ isHome }: { isHome: boolean }) {
  const {
    tracks,
    currentTrackIndex,
    isPlaying,
    progress,
    duration,
    toggle,
    changeTrack,
    seek,
  } = useMusicPlayer()
  const [open, setOpen] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)
  const currentTrack = tracks[currentTrackIndex]

  useEscapeKey(open, () => setOpen(false), 5)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !playerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  if (!currentTrack) return null

  return <div
    ref={playerRef}
    className={`floating-music-player${isHome ? ' is-home' : ''}${open ? ' is-open' : ''}${isPlaying ? ' is-playing' : ''}`}
  >
    {!open && <button
      type="button"
      className="floating-music-bubble"
      aria-label="開啟音樂播放器"
      aria-expanded={false}
      onClick={() => setOpen(true)}
    >
      <span aria-hidden="true">♫</span>
    </button>}
    <div className="floating-music-content" role="dialog" aria-label="音樂播放器" aria-hidden={!open}>
      <header className="floating-music-header">
        <div>
          <p>NOW PLAYING</p>
          <strong title={currentTrack.title}>{currentTrack.title}</strong>
        </div>
        <button type="button" aria-label="關閉音樂播放器" onClick={() => setOpen(false)}>×</button>
      </header>
      <input
        className="floating-music-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(progress, duration || 0)}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="音樂播放進度"
        tabIndex={open ? 0 : -1}
      />
      <div className="floating-music-times"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
      <div className="floating-music-controls">
        <button type="button" onClick={() => changeTrack(-1)} aria-label="上一首" tabIndex={open ? 0 : -1}>◀</button>
        <button type="button" className="floating-music-play" onClick={toggle} aria-label={isPlaying ? '暫停播放' : '播放'} tabIndex={open ? 0 : -1}>{isPlaying ? 'Ⅱ' : '▶'}</button>
        <button type="button" onClick={() => changeTrack(1)} aria-label="下一首" tabIndex={open ? 0 : -1}>▶</button>
      </div>
    </div>
  </div>
}

export default FloatingMusicPlayer
