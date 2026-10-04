import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchMusicTracks } from '../features/blog/api'
import type { MusicTrack } from '../features/blog/article'
import { resolveSameOriginMediaUrl } from '../features/blog/media'

type MusicPlayerContextValue = {
  tracks: MusicTrack[]
  currentTrackIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  toggle: () => void
  changeTrack: (direction: -1 | 1) => void
  seek: (value: number) => void
  requestAutoplay: () => void
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null)

function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldPlayRef = useRef(false)
  const userControlledRef = useRef(false)

  useEffect(() => {
    let active = true
    fetchMusicTracks()
      .then((loaded) => {
        if (!active) return
        setTracks(loaded)
        setCurrentTrackIndex((index) => Math.min(index, Math.max(0, loaded.length - 1)))
      })
      .catch(() => {
        if (active) setTracks([])
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateProgress = () => {
      setProgress(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', updateProgress)
    audio.addEventListener('durationchange', updateProgress)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('loadedmetadata', updateProgress)
      audio.removeEventListener('durationchange', updateProgress)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const track = tracks[currentTrackIndex]
    if (!audio || !track) return

    const source = resolveSameOriginMediaUrl(track.fileUrl)
    if (!source) {
      audio.pause()
      audio.removeAttribute('src')
      return
    }

    let active = true
    const startIfRequested = () => {
      if (!active || !shouldPlayRef.current) return
      void audio.play().catch(() => {
        if (active) setIsPlaying(false)
      })
    }

    audio.pause()
    audio.src = source
    audio.loop = true
    audio.load()
    queueMicrotask(() => {
      if (!active) return
      setProgress(0)
      setDuration(0)
      setIsPlaying(false)
    })
    audio.addEventListener('canplay', startIfRequested, { once: true })
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) startIfRequested()

    return () => {
      active = false
      audio.removeEventListener('canplay', startIfRequested)
    }
  }, [currentTrackIndex, tracks])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    shouldPlayRef.current = true
    void audio.play().catch(() => setIsPlaying(false))
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !tracks.length) return
    userControlledRef.current = true
    if (audio.paused) {
      play()
    } else {
      shouldPlayRef.current = false
      audio.pause()
    }
  }, [play, tracks.length])

  const changeTrack = useCallback((direction: -1 | 1) => {
    if (!tracks.length) return
    userControlledRef.current = true
    shouldPlayRef.current = Boolean(audioRef.current && !audioRef.current.paused)
    setCurrentTrackIndex((index) => (index + direction + tracks.length) % tracks.length)
  }, [tracks.length])

  const seek = useCallback((value: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = value
    setProgress(value)
  }, [])

  const requestAutoplay = useCallback(() => {
    if (userControlledRef.current) return
    shouldPlayRef.current = true
    play()
  }, [play])

  return (
    <MusicPlayerContext.Provider value={{ tracks, currentTrackIndex, isPlaying, progress, duration, toggle, changeTrack, seek, requestAutoplay }}>
      {children}
      <audio ref={audioRef} preload="metadata" loop aria-hidden="true" />
    </MusicPlayerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext)
  if (!context) throw new Error('useMusicPlayer must be used inside MusicPlayerProvider')
  return context
}

export default MusicPlayerProvider
