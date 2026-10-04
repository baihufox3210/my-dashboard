import { useEffect, useRef, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import SocialLinks from '../components/SocialLinks'
import useEscapeKey from '../components/useEscapeKey'
import { fetchArticles, fetchHomeProfile, fetchMusicTracks, fetchServerStatus, recordPageView } from '../features/blog/api'
import type { Article, HomeProfile, MusicTrack, ServerStatus } from '../features/blog/article'
import { resolveSameOriginMediaUrl } from '../features/blog/media'

const fallback: HomeProfile = {
  name: 'baihu',
  introduction: '喜歡動手做，也喜歡把有趣的想法變成作品。',
  quote: 'Stay curious, keep building.',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/baihu3210' },
    { name: 'Discord', url: 'https://discord.com/users/808972376619483137' },
    { name: 'GitHub', url: 'https://github.com/baihufox3210' },
  ],
  tags: [],
  avatarMessages: ['嗨，歡迎來逛逛！ (｡•̀ᴗ-)✧', '今天也要保持好奇心！ (ง •̀_•́)ง', '謝謝你來看我的網站～ (´▽`ʃ♡ƪ)'],
  updateTitle: '最近在做什麼',
  updateText: '目前專注在機器人、程式與新點子的實作。',
}

function HomePage() {
  const [profile, setProfile] = useState(fallback)
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [articleListHeight, setArticleListHeight] = useState<number | null>(null)
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicProgress, setMusicProgress] = useState(0)
  const [musicDuration, setMusicDuration] = useState(0)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldKeepPlayingRef = useRef(true)
  const articleListRef = useRef<HTMLDivElement>(null)
  const homeTagsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHomeProfile().then(setProfile).catch(() => undefined)
    fetchArticles().then(setArticles).catch(() => undefined)
    fetchMusicTracks().then(setMusicTracks).catch(() => undefined)
    fetchServerStatus().then(setServerStatus).catch(() => undefined)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const track = musicTracks[currentTrackIndex]
    if (!audio || !track) return

    const source = resolveSameOriginMediaUrl(track.fileUrl)
    if (!source) return
    const shouldPlay = shouldKeepPlayingRef.current
    let active = true
    const startPlayback = () => {
      if (!active || !shouldPlay) return
      void audio.play()
        .then(() => { if (active) setIsPlaying(true) })
        .catch(() => { if (active) { shouldKeepPlayingRef.current = false; setIsPlaying(false) } })
    }

    audio.pause()
    audio.src = source
    audio.load()
    queueMicrotask(() => {
      if (!active) return
      setMusicProgress(0)
      setMusicDuration(0)
      setIsPlaying(false)
    })
    audio.addEventListener('canplay', startPlayback, { once: true })
    startPlayback()

    return () => {
      active = false
      audio.removeEventListener('canplay', startPlayback)
    }
  }, [currentTrackIndex, musicTracks])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateProgress = () => { setMusicProgress(audio.currentTime); setMusicDuration(audio.duration || 0) }
    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', updateProgress)
    return () => { audio.removeEventListener('timeupdate', updateProgress); audio.removeEventListener('loadedmetadata', updateProgress) }
  }, [musicTracks.length])

  function toggleMusic() {
    const audio = audioRef.current
    if (!audio || !musicTracks.length) return
    if (audio.paused) {
      shouldKeepPlayingRef.current = true
      void audio.play().then(() => setIsPlaying(true)).catch(() => {
        shouldKeepPlayingRef.current = false
        setIsPlaying(false)
      })
    } else {
      shouldKeepPlayingRef.current = false
      audio.pause()
      setIsPlaying(false)
    }
  }

  function changeTrack(direction: -1 | 1) {
    if (!musicTracks.length) return
    shouldKeepPlayingRef.current = Boolean(audioRef.current && !audioRef.current.paused)
    setCurrentTrackIndex((index) => (index + direction + musicTracks.length) % musicTracks.length)
  }

  function seekMusic(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value)
    if (audioRef.current) audioRef.current.currentTime = next
    setMusicProgress(next)
  }

  function formatMusicTime(seconds: number) {
    if (!Number.isFinite(seconds)) return '0:00'
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  }

  function formatUptime(seconds: number) {
    const totalMinutes = Math.max(0, Math.floor(seconds / 60))
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60
    return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  useEffect(() => {
    if (!avatarMessage) return
    const timer = window.setTimeout(() => setAvatarMessage(''), 3200)
    return () => window.clearTimeout(timer)
  }, [avatarMessage])

  useEffect(() => {
    const tags = homeTagsRef.current
    if (!tags) return
    let frame = 0

    const fitTags = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        tags.classList.remove('is-wrapped')
        if (!tags.clientWidth) return
        if (tags.scrollWidth > tags.clientWidth + 1) tags.classList.add('is-wrapped')
      })
    }

    fitTags()
    const observer = new ResizeObserver(fitTags)
    observer.observe(tags)
    if (tags.parentElement) observer.observe(tags.parentElement)
    window.addEventListener('resize', fitTags)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', fitTags)
    }
  }, [profile.tags])

  useEffect(() => {
    const list = articleListRef.current
    if (!list) return
    let frame = 0
    let lastHeight = -1

    const measureArticleWindow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const cards = [...list.querySelectorAll<HTMLElement>(':scope > .home-article')]
        if (cards.length <= 2) {
          if (lastHeight !== 0) {
            lastHeight = 0
            setArticleListHeight(null)
          }
          return
        }

        const listStyle = getComputedStyle(list)
        const gap = Number.parseFloat(listStyle.rowGap || listStyle.gap) || 0
        const padding = (Number.parseFloat(listStyle.paddingTop) || 0) + (Number.parseFloat(listStyle.paddingBottom) || 0)
        const nextHeight = Math.ceil((cards[0]?.getBoundingClientRect().height ?? 0) + (cards[1]?.getBoundingClientRect().height ?? 0) + gap + padding)
        if (nextHeight > 0 && Math.abs(nextHeight - lastHeight) > 1) {
          lastHeight = nextHeight
          setArticleListHeight(nextHeight)
        }
      })
    }

    measureArticleWindow()
    const observer = new ResizeObserver(measureArticleWindow)
    observer.observe(list)
    list.querySelectorAll('img').forEach((image) => image.addEventListener('load', measureArticleWindow, { once: true }))
    window.addEventListener('resize', measureArticleWindow)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measureArticleWindow)
    }
  }, [articles])

  function showAvatarMessage() {
    const messages = profile.avatarMessages.filter(Boolean)
    setAvatarMessage(messages.length ? messages[Math.floor(Math.random() * messages.length)] ?? '' : '(๑•̀ㅂ•́)و✧')
  }

  useEffect(() => {
    if (selectedArticle) void recordPageView('article', { articleId: selectedArticle.id })
  }, [selectedArticle])

  useEscapeKey(Boolean(selectedArticle), () => setSelectedArticle(null), 10)

  return (
    <main className="main-page home-page">
      <div className="home-profile-column">
        <section className="home-profile home-panel" aria-label="個人介紹">
          <div className="home-avatar-stage">
            <button type="button" className="home-avatar-wrap" onClick={showAvatarMessage} aria-label="點擊頭像看一句小語" aria-expanded={Boolean(avatarMessage)}>
              {profile.avatarUrl ? <img className="home-avatar" src={profile.avatarUrl} alt={`${profile.name} 頭像`} /> : <span className="home-avatar home-avatar-placeholder" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>}
            </button>
            {avatarMessage && <span className="home-avatar-message" role="status">{avatarMessage}</span>}
          </div>
          <p className="home-eyebrow">個人首頁</p>
          <h1>{profile.name}</h1>
          <blockquote>{profile.quote}</blockquote>
        </section>
        <section className="home-tags-card home-panel" aria-label="興趣標籤"><p className="home-eyebrow">INTERESTS</p><div className="home-tags" ref={homeTagsRef}>{profile.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
        <section className="home-contact-card home-panel" aria-label="聯絡方式"><SocialLinks socials={profile.socials} /></section>
      </div>

      <section className="home-blog home-panel">
        <div className="home-section-heading"><div><p className="home-eyebrow">FROM THE BLOG</p><h2>最新文章</h2></div><span className="home-post-count">{articles.length} 篇文章</span></div>
        {articles.length ? <div className={`home-article-list${articles.length > 2 ? ' is-scrollable' : ''}`} ref={articleListRef} style={articleListHeight ? { height: `${articleListHeight}px`, maxHeight: `${articleListHeight}px`, flex: '0 0 auto' } : undefined}>{articles.map((article) => <button className="home-article" type="button" onClick={() => setSelectedArticle(article)} key={article.id}>
          {article.coverImage && <img className="home-article-cover" src={article.coverImage} alt="" style={{ objectPosition: article.coverImagePosition ?? '50% 50%', transform: `scale(${article.coverImageScale ?? 1})`, transformOrigin: 'center' }} />}
          <span className="home-article-copy"><small>{article.category}</small><strong>{article.title}</strong><span>{article.content.replace(/[#*`>_[\]!~]/g, '').slice(0, 140)}{article.content.length > 140 ? '…' : ''}</span><time className="home-article-date">{new Date(article.publishedAt).toLocaleDateString()}</time></span></button>)}</div> : <div className="home-blog-empty"><span>✳</span><strong>新文章正在路上</strong><p>最近的想法與作品會出現在這裡。</p></div>}
      </section>

      <div className="home-right-column">
        <aside className="home-updates home-panel"><p className="home-eyebrow">NOW</p><h2>{profile.updateTitle}</h2><p>{profile.updateText}</p><div className="home-update-rule" /></aside>
        <aside className="home-server-card home-panel" aria-label="伺服器資訊"><p className="home-eyebrow">SERVER STATUS</p><div className="home-server-stats"><div><span>運作時間</span><strong>{serverStatus ? formatUptime(serverStatus.uptimeSeconds) : '--:--:--'}</strong><small>DD : HH : MM</small></div><div><span>最後活動</span><strong>{serverStatus?.lastActivity ? new Date(serverStatus.lastActivity).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : '—'}</strong><small>{serverStatus?.lastActivity ? new Date(serverStatus.lastActivity).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '尚無紀錄'}</small></div></div></aside>
        <aside className="home-music-card home-panel" aria-label="音樂播放器"><p className="home-eyebrow">LISTENING NOW</p>{musicTracks.length ? <><strong className="home-music-title">{musicTracks[currentTrackIndex]?.title}</strong><input className="home-music-progress" type="range" min="0" max={musicDuration || 0} step="0.1" value={Math.min(musicProgress, musicDuration || 0)} onChange={seekMusic} aria-label="音樂播放進度" /><div className="home-music-times"><span>{formatMusicTime(musicProgress)}</span><span>{formatMusicTime(musicDuration)}</span></div><div className="home-music-controls"><button type="button" onClick={() => changeTrack(-1)} aria-label="上一首">◀</button><button type="button" className="home-music-play" onClick={toggleMusic} aria-label={isPlaying ? '停止播放' : '播放'}>{isPlaying ? 'Ⅱ' : '▶'}</button><button type="button" onClick={() => changeTrack(1)} aria-label="下一首">▶</button></div><div className={`home-music-orbit${isPlaying ? ' is-playing' : ''}`} aria-hidden="true"><span /></div></> : <p className="home-music-empty">尚未加入音樂。</p>}<audio ref={audioRef} preload="metadata" loop /></aside>
      </div>
      {selectedArticle && <div className="project-modal-backdrop article-reader-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedArticle(null) }}>
        <article className="project-detail-modal article-reader" role="dialog" aria-modal="true" aria-labelledby="home-article-title">
          <header className="project-detail-header">
            <p>{selectedArticle.category || 'BLOG POST'} <span>///</span> {new Date(selectedArticle.publishedAt).toLocaleDateString()}</p>
            <button type="button" className="modal-close-button" aria-label="關閉文章" onClick={() => setSelectedArticle(null)}>×</button>
          </header>
          {selectedArticle.coverImage && <img className="project-detail-cover" src={selectedArticle.coverImage} alt="" style={{ objectPosition: selectedArticle.coverImagePosition ?? '50% 50%', transform: `scale(${selectedArticle.coverImageScale ?? 1})`, transformOrigin: 'center' }} />}
          <h2 id="home-article-title">{selectedArticle.title}</h2>
          <div className="project-detail-content article-reader-content"><MarkdownPreview content={selectedArticle.content} /></div>
        </article>
      </div>}
    </main>
  )
}

export default HomePage
