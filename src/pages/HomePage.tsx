import { useEffect, useRef, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import SocialLinks from '../components/SocialLinks'
import { fetchArticles, fetchHomeProfile, recordPageView } from '../features/blog/api'
import type { Article, HomeProfile } from '../features/blog/article'

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
  const articleListRef = useRef<HTMLDivElement>(null)
  const homeTagsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHomeProfile().then(setProfile).catch(() => undefined)
    fetchArticles().then(setArticles).catch(() => undefined)
  }, [])

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

  useEffect(() => {
    if (!selectedArticle) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedArticle(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedArticle])

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
          <span className="home-article-copy"><small>{article.category}</small><strong>{article.title}</strong><span>{article.content.replace(/[#*`>_[\]!~]/g, '').slice(0, 140)}{article.content.length > 140 ? '…' : ''}</span><time className="home-article-date">{new Date(article.publishedAt).toLocaleDateString()}</time></span><span className="home-article-arrow" aria-hidden="true">↗</span></button>)}</div> : <div className="home-blog-empty"><span>✳</span><strong>新文章正在路上</strong><p>最近的想法與作品會出現在這裡。</p></div>}
      </section>

      <aside className="home-updates home-panel">
        <p className="home-eyebrow">NOW</p><h2>{profile.updateTitle}</h2><p>{profile.updateText}</p>
        <div className="home-update-rule" />
        <span className="home-update-note"><i /> 持續探索中</span>
      </aside>
      {selectedArticle && <div className="article-reader-backdrop" role="presentation" onClick={() => setSelectedArticle(null)}>
        <article className="article-reader" role="dialog" aria-modal="true" aria-labelledby="home-article-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="secondary-button" onClick={() => setSelectedArticle(null)}>關閉</button>
          <p className="placeholder-label">{selectedArticle.category} · {new Date(selectedArticle.publishedAt).toLocaleDateString()}</p>
          <h2 id="home-article-title">{selectedArticle.title}</h2>
          {selectedArticle.coverImage && <img src={selectedArticle.coverImage} alt="" style={{ objectPosition: selectedArticle.coverImagePosition ?? '50% 50%', transform: `scale(${selectedArticle.coverImageScale ?? 1})`, transformOrigin: 'center' }} />}
          <MarkdownPreview content={selectedArticle.content} />
        </article>
      </div>}
    </main>
  )
}

export default HomePage
