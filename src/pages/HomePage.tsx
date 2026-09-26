import { useEffect, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import { fetchArticles, fetchHomeProfile } from '../features/blog/api'
import type { Article, HomeProfile } from '../features/blog/article'

const fallback: HomeProfile = {
  name: 'baihu',
  introduction: '喜歡動手做，也喜歡把有趣的想法變成作品。',
  quote: 'Stay curious, keep building.',
  avatarUrl: '/avatar.png',
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/baihu3210' },
    { name: 'Discord', url: 'https://discord.com/users/808972376619483137' },
    { name: 'GitHub', url: 'https://github.com/baihufox3210' },
  ],
  tags: ['FRC'],
  updateTitle: '最近在做什麼',
  updateText: '目前專注在機器人、程式與新點子的實作。',
}

function HomePage() {
  const [profile, setProfile] = useState(fallback)
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  useEffect(() => {
    fetchHomeProfile().then(setProfile).catch(() => undefined)
    fetchArticles().then(setArticles).catch(() => undefined)
  }, [])

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
          <div className="home-avatar-wrap">
            {profile.avatarUrl ? <img className="home-avatar" src={profile.avatarUrl} alt={`${profile.name} 頭像`} /> : <div className="home-avatar home-avatar-placeholder" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</div>}
          </div>
          <p className="home-eyebrow">個人首頁</p>
          <h1>{profile.name}</h1>
          <blockquote>{profile.quote}</blockquote>
        </section>
        <section className="home-tags-card home-panel" aria-label="興趣標籤"><p className="home-eyebrow">INTERESTS</p><div className="home-tags">{profile.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
        <section className="home-contact-card home-panel" aria-label="聯絡方式"><nav className="home-socials" aria-label="社群連結">
          {profile.socials.map((social) => <a key={social.name} href={social.url} target="_blank" rel="noreferrer" aria-label={social.name} title={social.name}>
            {social.name === 'Instagram' ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle className="social-icon-dot" cx="17.65" cy="6.55" r="1"/></svg> : social.name === 'Discord' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M19.7 5.4a17.7 17.7 0 0 0-4.35-1.35l-.54 1.1a16 16 0 0 0-5.62 0l-.55-1.1A17.8 17.8 0 0 0 4.3 5.4C1.55 9.45.8 13.4 1.18 17.3a17.9 17.9 0 0 0 5.35 2.7l1.15-1.87c-.63-.23-1.23-.52-1.8-.86l.44-.35c3.47 1.6 7.23 1.6 10.66 0l.45.35c-.57.34-1.17.63-1.8.86l1.14 1.87a17.9 17.9 0 0 0 5.36-2.7c.45-4.53-.77-8.45-3.43-11.9ZM8.8 14.95c-1.04 0-1.9-.96-1.9-2.13s.84-2.14 1.9-2.14 1.91.97 1.9 2.14c0 1.17-.84 2.13-1.9 2.13Zm6.4 0c-1.05 0-1.9-.96-1.9-2.13s.84-2.14 1.9-2.14 1.9.97 1.9 2.14c0 1.17-.83 2.13-1.9 2.13Z"/></svg> : social.name === 'GitHub' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.31-3.76-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3.01 0 4.27-2.6 5.21-5.08 5.49.4.35.76 1.02.76 2.06v3.07c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg> : <span>{social.name.slice(0, 2).toUpperCase()}</span>}
          </a>)}
        </nav></section>
      </div>

      <section className="home-blog home-panel">
        <div className="home-section-heading"><div><p className="home-eyebrow">FROM THE BLOG</p><h2>最新文章</h2></div><span className="home-post-count">{articles.length} 篇文章</span></div>
        {articles.length ? <div className="home-article-list">{articles.map((article) => <button className="home-article" type="button" onClick={() => setSelectedArticle(article)} key={article.id}>
          {article.coverImage && <img className="home-article-cover" src={article.coverImage} alt="" />}
          <span className="home-article-copy"><small>{article.category} · {new Date(article.publishedAt).toLocaleDateString()}</small><strong>{article.title}</strong><span>{article.content.replace(/[#*`>_[\]!~]/g, '').slice(0, 140)}{article.content.length > 140 ? '…' : ''}</span></span><span className="home-article-arrow" aria-hidden="true">↗</span></button>)}</div> : <div className="home-blog-empty"><span>✳</span><strong>新文章正在路上</strong><p>最近的想法與作品會出現在這裡。</p></div>}
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
          {selectedArticle.coverImage && <img src={selectedArticle.coverImage} alt="" />}
          <MarkdownPreview content={selectedArticle.content} />
        </article>
      </div>}
    </main>
  )
}

export default HomePage
