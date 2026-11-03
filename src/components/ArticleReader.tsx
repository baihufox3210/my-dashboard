import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import MarkdownPreview from './MarkdownPreview'
import useEscapeKey from './useEscapeKey'
import { fetchArticle, fetchArticleReactions, toggleArticleReaction, type ArticleReaction, type ArticleReactions } from '../features/blog/api'
import type { ArticleSummary } from '../features/blog/article'
import { coverImageStyle } from '../features/blog/media'
import { trackProgress, unlock } from '../features/fun/achievements'

type ArticleReaderProps = {
  article: ArticleSummary
  onClose: () => void
  children?: ReactNode
}

const reactions: { id: ArticleReaction; emoji: string; label: string }[] = [
  { id: 'like', emoji: '👍', label: '讚' },
  { id: 'love', emoji: '❤️', label: '喜歡' },
  { id: 'laugh', emoji: '😂', label: '好笑' },
  { id: 'wow', emoji: '😮', label: '驚訝' },
]

function articleUrl(id: string) {
  return `${window.location.origin}/blog/post/${encodeURIComponent(id)}`
}

function Reactions({ articleId }: { articleId: string }) {
  const [state, setState] = useState<ArticleReactions | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchArticleReactions(articleId).then((result) => { if (active) setState(result) }).catch(() => undefined)
    return () => { active = false }
  }, [articleId])

  async function toggle(reaction: ArticleReaction) {
    setBusy(true)
    try {
      const next = await toggleArticleReaction(articleId, reaction)
      setState(next)
      if (next.mine.includes(reaction)) unlock('reaction')
    } catch { /* rate limited or offline */ } finally { setBusy(false) }
  }

  if (!state) return null
  return <div className="article-reactions" role="group" aria-label="對這篇文章的反應">
    {reactions.map((item) => {
      const active = state.mine.includes(item.id)
      return <button key={item.id} type="button" className={active ? 'active' : ''} aria-pressed={active} aria-label={`${item.label} ${state.counts[item.id]}`} title={item.label} disabled={busy} onClick={() => void toggle(item.id)}>
        <span aria-hidden="true">{item.emoji}</span>{state.counts[item.id] > 0 && <strong>{state.counts[item.id]}</strong>}
      </button>
    })}
  </div>
}

function ShareButton({ articleId }: { articleId: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(articleUrl(articleId))
      setCopied(true)
    } catch {
      window.prompt('複製文章連結', articleUrl(articleId))
    }
  }

  return <button type="button" className="ui-button ui-button-secondary ui-button-small article-share" onClick={() => void copy()}>{copied ? '已複製連結 ✓' : '複製文章連結'}</button>
}

function ArticleReader({ article, onClose, children }: ArticleReaderProps) {
  const [loaded, setLoaded] = useState<{ id: string; content: string | null } | null>(null)
  const [progress, setProgress] = useState(0)
  const backdropRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const content = loaded?.id === article.id ? loaded.content : undefined
  useEscapeKey(true, onClose, 10)

  useEffect(() => {
    let active = true
    fetchArticle(article)
      .then((full) => {
        if (!active) return
        setLoaded({ id: article.id, content: full.content })
        unlock('reader')
        trackProgress('articles', article.id, 3, 'bookworm')
      })
      .catch(() => { if (active) setLoaded({ id: article.id, content: null }) })
    return () => { active = false }
  }, [article])

  // Desktop scrolls the backdrop, phones scroll the article itself; track whichever moves.
  useEffect(() => {
    const scrollers = [backdropRef.current, articleRef.current].filter((element): element is HTMLElement => Boolean(element))
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const ratios = scrollers.map((element) => {
          const range = element.scrollHeight - element.clientHeight
          return range > 1 ? element.scrollTop / range : 0
        })
        setProgress(Math.min(1, Math.max(0, ...ratios)))
      })
    }
    scrollers.forEach((element) => element.addEventListener('scroll', update, { passive: true }))
    update()
    return () => {
      cancelAnimationFrame(frame)
      scrollers.forEach((element) => element.removeEventListener('scroll', update))
    }
  }, [content])

  // Portal: page cards use backdrop-filter, which would trap a fixed-position dialog.
  return createPortal(
    <div ref={backdropRef} className="project-modal-backdrop article-reader-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="reading-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <article ref={articleRef} className="project-detail-modal article-reader" role="dialog" aria-modal="true" aria-labelledby="article-reader-title">
        <header className="project-detail-header">
          <p>{article.category || 'BLOG POST'} <span>///</span> {new Date(article.publishedAt).toLocaleDateString()}</p>
          <button type="button" className="modal-close-button" aria-label="關閉文章" onClick={onClose}>×</button>
        </header>
        {article.coverImage && <img className="project-detail-cover" src={article.coverImage} alt="" style={coverImageStyle(article)} />}
        <h2 id="article-reader-title">{article.title}</h2>
        <p className="article-reader-meta">約 {article.readingMinutes ?? 1} 分鐘閱讀 · {(article.wordCount ?? 0).toLocaleString()} 字{article.tags.length ? ` · ${article.tags.map((tag) => `#${tag}`).join(' ')}` : ''}</p>
        <div className="project-detail-content article-reader-content" aria-busy={content === undefined}>
          {content === null ? <p className="error-message">文章載入失敗，請稍後再試。</p> : content !== undefined && <MarkdownPreview content={content} />}
        </div>
        <footer className="article-reader-footer">
          <Reactions articleId={article.id} />
          <ShareButton articleId={article.id} />
        </footer>
        {children}
      </article>
    </div>,
    document.body,
  )
}

export default ArticleReader
