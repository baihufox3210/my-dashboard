import { useEffect, useState, type ReactNode } from 'react'
import MarkdownPreview from './MarkdownPreview'
import useEscapeKey from './useEscapeKey'
import { fetchArticle } from '../features/blog/api'
import type { ArticleSummary } from '../features/blog/article'

type ArticleReaderProps = {
  article: ArticleSummary
  onClose: () => void
  children?: ReactNode
}

function ArticleReader({ article, onClose, children }: ArticleReaderProps) {
  const [loaded, setLoaded] = useState<{ id: string; content: string | null } | null>(null)
  const content = loaded?.id === article.id ? loaded.content : undefined
  useEscapeKey(true, onClose, 10)

  useEffect(() => {
    let active = true
    fetchArticle(article)
      .then((full) => { if (active) setLoaded({ id: article.id, content: full.content }) })
      .catch(() => { if (active) setLoaded({ id: article.id, content: null }) })
    return () => { active = false }
  }, [article])

  return (
    <div className="project-modal-backdrop article-reader-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <article className="project-detail-modal article-reader" role="dialog" aria-modal="true" aria-labelledby="article-reader-title">
        <header className="project-detail-header">
          <p>{article.category || 'BLOG POST'} <span>///</span> {new Date(article.publishedAt).toLocaleDateString()}</p>
          <button type="button" className="modal-close-button" aria-label="關閉文章" onClick={onClose}>×</button>
        </header>
        {article.coverImage && <img className="project-detail-cover" src={article.coverImage} alt="" style={{ objectPosition: article.coverImagePosition ?? '50% 50%', transform: `scale(${article.coverImageScale ?? 1})`, transformOrigin: 'center' }} />}
        <h2 id="article-reader-title">{article.title}</h2>
        <div className="project-detail-content article-reader-content" aria-busy={content === undefined}>
          {content === null ? <p className="error-message">文章載入失敗，請稍後再試。</p> : content !== undefined && <MarkdownPreview content={content} />}
        </div>
        {children}
      </article>
    </div>
  )
}

export default ArticleReader
