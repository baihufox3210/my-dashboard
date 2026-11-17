import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FileDropzone from '../../components/FileDropzone'
import MarkdownEditor from '../../components/MarkdownEditor'
import useEscapeKey from '../../components/useEscapeKey'
import { useSiteName } from '../../components/usePageTitle'
import { fetchArticle, publishArticle, updateArticle, uploadArticleImage } from '../../features/blog/api'
import type { ArticleSummary } from '../../features/blog/article'
import CoverImage from '../../components/CoverImage'

type Draft = { title: string; category: string; tags: string; content: string; seoTitle: string; seoDescription: string }
type StoredDraft = Draft & { savedAt: number }

type ArticleEditorProps = {
  article?: ArticleSummary
  onSaved: (saved: ArticleSummary) => void
  onClose: () => void
}

const emptyDraft: Draft = { title: '', category: '', tags: '', content: '', seoTitle: '', seoDescription: '' }
const cjkCharacter = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const markdownImage = /!\[([^\]]*)\]\([^)]*\)/g

// Same counting as the server: each CJK character is a word, images are not.
function countWords(raw: string) {
  const text = raw.replace(markdownImage, ' $1 ')
  const cjk = text.match(cjkCharacter)?.length ?? 0
  const other = text.replace(cjkCharacter, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
  return { words: cjk + other, minutes: Math.max(1, Math.round(cjk / 400 + other / 220)) }
}

// Unsaved work is kept on this device, so closing the editor or losing the session
// does not lose it. It is offered back the next time the same article is opened.
const draftKey = (id?: string) => `article-draft:${id ?? 'new'}`
function readStoredDraft(id?: string): StoredDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') as StoredDraft | null
    return value && typeof value.content === 'string' ? value : null
  } catch { return null }
}
function storeDraft(id: string | undefined, draft: Draft) {
  try { localStorage.setItem(draftKey(id), JSON.stringify({ ...draft, savedAt: Date.now() })) } catch { /* storage unavailable */ }
}
function forgetDraft(id?: string) {
  try { localStorage.removeItem(draftKey(id)) } catch { /* storage unavailable */ }
}
const sameDraft = (first: Draft, second: Draft) => first.title === second.title && first.category === second.category && first.tags === second.tags && first.content === second.content && (first.seoTitle ?? '') === (second.seoTitle ?? '') && (first.seoDescription ?? '') === (second.seoDescription ?? '')

function timeAgo(at: number, now: number) {
  const minutes = Math.round((now - at) / 60_000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours} 小時前` : `${Math.round(hours / 24)} 天前`
}

const draftOf = (article: ArticleSummary, content: string): Draft => ({ title: article.title, category: article.category === 'Uncategorized' ? '' : article.category, tags: article.tags.join(', '), content, seoTitle: article.seoTitle ?? '', seoDescription: article.seoDescription ?? '' })

// Search results cut a title at about 30 Chinese characters (Latin letters and digits take about
// half the width), so the preview below warns when the part people search for would be lost.
const titleLimit = 30
const titleUnits = (text: string) => [...text].reduce((sum, character) => sum + (/[\u2E80-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(character) ? 1 : 0.5), 0)
const plainExcerpt = (markdown: string) => markdown.replace(markdownImage, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\|\|[\s\S]+?\|\|/g, '▒▒▒').replace(/[#*`>_[\]!~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)

// Same shell as the Projects editor: header, grouped sections, sticky action row.
function ArticleEditor({ article, onSaved, onClose }: ArticleEditorProps) {
  const [openedAt] = useState(() => Date.now())
  const siteName = useSiteName()
  const [draft, setDraft] = useState<Draft>(() => article ? draftOf(article, '') : emptyDraft)
  const [baseline, setBaseline] = useState<Draft | null>(article ? null : emptyDraft)
  const [cover, setCover] = useState<File | null>(null)
  const [coverPosition, setCoverPosition] = useState(article?.coverImagePosition ?? '50% 50%')
  const [coverScale, setCoverScale] = useState(article?.coverImageScale ?? 1)
  const [uploading, setUploading] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [restorable, setRestorable] = useState<StoredDraft | null>(null)
  const articleId = article?.id
  const loaded = baseline !== null
  const dirty = loaded && (!sameDraft(draft, baseline) || cover !== null || coverPosition !== (article?.coverImagePosition ?? '50% 50%') || coverScale !== (article?.coverImageScale ?? 1))
  const countedContent = useDeferredValue(draft.content)
  const { words, minutes } = useMemo(() => countWords(countedContent), [countedContent])
  const tags = useMemo(() => draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), [draft.tags])
  const update = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const close = () => { if (!busy) onClose() }
  useEscapeKey(true, close, 10)

  useEffect(() => {
    let active = true
    const offerStored = (loadedDraft: Draft) => {
      const stored = readStoredDraft(articleId)
      if (stored && !sameDraft(stored, loadedDraft)) setRestorable(stored)
    }
    if (!article) { offerStored(emptyDraft); return }
    fetchArticle(article)
      .then((full) => {
        if (!active) return
        const loadedDraft = draftOf(article, full.content)
        setDraft(loadedDraft)
        setBaseline(loadedDraft)
        offerStored(loadedDraft)
      })
      .catch(() => { if (active) setMessage('文章內容載入失敗，請重新整理後再試。') })
    return () => { active = false }
  }, [article, articleId])

  useEffect(() => {
    if (!dirty || sameDraft(draft, baseline ?? emptyDraft)) return
    const timer = window.setTimeout(() => storeDraft(articleId, draft), 700)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, baseline, articleId])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const coverUrl = useMemo(() => cover ? URL.createObjectURL(cover) : '', [cover])
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl) }, [coverUrl])
  const coverPreview = coverUrl || article?.coverImage || ''

  async function save() {
    if (busy || !loaded) return
    if (uploading > 0) { setMessage('圖片還在上傳，請稍候再儲存。'); return }
    if (!draft.title.trim()) { setMessage('請輸入文章標題。'); return }
    if (!draft.content.trim()) { setMessage('請輸入文章內容。'); return }
    const form = new FormData()
    form.set('title', draft.title.trim())
    form.set('category', draft.category.trim())
    form.set('tags', draft.tags)
    form.set('content', draft.content)
    form.set('seoTitle', draft.seoTitle.trim())
    form.set('seoDescription', draft.seoDescription.trim())
    form.set('coverImagePosition', coverPosition)
    form.set('coverImageScale', String(coverScale))
    if (cover) form.set('coverImage', cover)
    setBusy(true)
    setMessage('')
    try {
      const saved = article ? await updateArticle(article.id, form) : await publishArticle(form)
      forgetDraft(articleId)
      setBaseline(draft)
      setCover(null)
      onSaved(saved)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '儲存文章失敗。')
    } finally {
      setBusy(false)
    }
  }

  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); void saveRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const status = !loaded ? '載入中…' : uploading ? `正在上傳 ${uploading} 張圖片…` : dirty ? '尚未儲存 · 已暫存在此裝置' : article ? '已是最新版本' : ''

  return createPortal(<div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !dirty) close() }}>
    <section className="project-editor-modal is-wide" role="dialog" aria-modal="true" aria-labelledby="article-editor-title">
      <header className="project-editor-header">
        <div>
          <p>BLOG CONTENT <span>///</span> EDITOR</p>
          <h2 id="article-editor-title">{article ? '編輯文章' : '撰寫文章'}</h2>
          <small>整理文章資訊、內容與封面，儲存後會更新文章列表。</small>
        </div>
        <button type="button" className="modal-close-button" aria-label="關閉" disabled={busy} onClick={close}>×</button>
      </header>
      <form className="project-editor-form" onSubmit={(event) => { event.preventDefault(); void save() }}>
        {restorable && <p className="projects-feedback editor-draft-notice" role="status">
          <span>這台裝置上有一份 {timeAgo(restorable.savedAt, openedAt)} 尚未儲存的草稿。</span>
          <button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => { setDraft({ title: restorable.title, category: restorable.category, tags: restorable.tags, content: restorable.content, seoTitle: restorable.seoTitle ?? '', seoDescription: restorable.seoDescription ?? '' }); setRestorable(null) }}>恢復草稿</button>
          <button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => { forgetDraft(articleId); setRestorable(null) }}>捨棄</button>
        </p>}
        <section className="project-editor-section" aria-labelledby="article-info-heading">
          <div className="project-editor-section-heading"><h3 id="article-info-heading">基本資料</h3><span>標題、分類與標籤</span></div>
          <label className="project-form-field project-title-field">文章標題<input required maxLength={200} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="例如：月夜的神社" /></label>
          <div className="project-form-two">
            <label className="project-form-field">分類<input maxLength={100} value={draft.category} onChange={(event) => update('category', event.target.value)} placeholder="Dev / 隨筆 / 筆記" /></label>
            <label className="project-form-field">標籤 <small>以逗號分隔</small><input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="React, 攝影, 散步" /></label>
          </div>
        </section>
        <section className="project-editor-section" aria-labelledby="article-content-heading">
          <div className="project-editor-section-heading"><h3 id="article-content-heading">文章內容</h3><span>{words.toLocaleString()} 字 · 約 {minutes} 分鐘閱讀</span></div>
          <MarkdownEditor
            label="內容"
            size="tall"
            value={draft.content}
            onChange={(content) => update('content', content)}
            onUploadImage={async (file) => (await uploadArticleImage(file)).url}
            onUploadingChange={setUploading}
            onError={setMessage}
            disabled={!loaded}
            placeholder="開始寫作…"
            previewHeader={<header className="md-preview-header">
              <p>{draft.category.trim() || 'BLOG POST'} <span>///</span> {new Date(article?.publishedAt ?? openedAt).toLocaleDateString()}</p>
              {coverPreview && <CoverImage className="detail-cover" src={coverPreview} position={coverPosition} scale={coverScale} lazy={false} />}
              <h2>{draft.title.trim() || '文章標題'}</h2>
              <small>約 {minutes} 分鐘閱讀 · {words.toLocaleString()} 字{tags.length ? ` · ${tags.map((tag) => `#${tag}`).join(' ')}` : ''}</small>
            </header>}
          />
        </section>
        <section className="project-editor-section" aria-labelledby="article-seo-heading">
          <div className="project-editor-section-heading"><h3 id="article-seo-heading">搜尋引擎</h3><span>選填：不填就用文章標題與內文開頭</span></div>
          <div className="seo-preview" aria-label="搜尋結果預覽">
            <small>{window.location.host} › blog › post</small>
            <b>{draft.seoTitle.trim() || `${draft.title.trim() || '文章標題'} | ${siteName}`}</b>
            <p>{draft.seoDescription.trim() || plainExcerpt(draft.content) || '內文開頭會顯示在這裡。'}</p>
          </div>
          <label className="project-form-field">搜尋標題 <small>把大家會搜尋的關鍵字放在最前面</small>
            <input maxLength={100} value={draft.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} placeholder="例如：116 成大資工特選心得｜上機考經驗" />
          </label>
          {(() => {
            const units = titleUnits(draft.seoTitle.trim() || `${draft.title.trim()} | ${siteName}`)
            return <p className={`seo-count${units > titleLimit ? ' is-over' : ''}`}>標題約 {Math.ceil(units)} / {titleLimit} 字寬{units > titleLimit ? '，超出的部分在搜尋結果會被「…」截掉' : ''}</p>
          })()}
          <label className="project-form-field">搜尋描述 <small>顯示在搜尋結果標題下方，約 80 字內</small>
            <textarea rows={2} maxLength={200} value={draft.seoDescription} onChange={(event) => update('seoDescription', event.target.value)} placeholder="例如：116 學年度成大資工特選上機考的考場環境、評分方式與心得。" />
          </label>
        </section>
        <section className="project-editor-section project-editor-assets" aria-labelledby="article-assets-heading">
          <div className="project-editor-section-heading"><h3 id="article-assets-heading">封面</h3><span>固定寬幅比例（4:1），文章卡片與內文顯示相同的裁切</span></div>
          <div className="project-form-field">
            <span>封面圖片 <small>JPG / PNG / WebP / GIF，其他格式會自動轉檔</small></span>
            <FileDropzone title="上傳文章封面" hint="點擊選取圖片" file={cover} previewUrl={article?.coverImage} imagePosition={coverPosition} imageScale={coverScale} onImagePositionChange={setCoverPosition} onImageScaleChange={setCoverScale} onFile={setCover} />
          </div>
        </section>
        {message && <p className="projects-feedback project-editor-error" role="alert">{message}</p>}
        <footer className="project-editor-actions">
          {status && <span className={`editor-status${dirty ? ' is-dirty' : ''}`} aria-live="polite">{status}</span>}
          <button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={close}>取消</button>
          <button type="submit" className="ui-button ui-button-primary" disabled={busy || !loaded}>{busy ? '儲存中…' : '儲存文章'}</button>
        </footer>
      </form>
    </section>
  </div>, document.body)
}

export default ArticleEditor
