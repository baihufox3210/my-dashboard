import { useCallback, useEffect, useState } from 'react'
import usePageTitle from '../components/usePageTitle'
import MarkdownPreview from '../components/MarkdownPreview'
import MarkdownEditor from '../components/MarkdownEditor'
import FileDropzone from '../components/FileDropzone'
import ConfirmDialog from '../components/ConfirmDialog'
import UiIcon from '../components/UiIcon'
import useEscapeKey from '../components/useEscapeKey'
import { createProject, deleteProject, fetchAdminSession, fetchProjects, updateProject, uploadArticleImage } from '../features/blog/api'
import type { Project } from '../features/blog/article'
import { ShareButton } from '../components/ArticleReader'
import { getPublicPath, getRouteSegments, isPlainClick, navigate, useLocationKey } from '../routes/routes'
import CoverImage from '../components/CoverImage'

type ProjectDraft = { title: string; summary: string; description: string; category: string; tags: string; projectUrl: string }
const blankDraft: ProjectDraft = { title: '', summary: '', description: '', category: '', tags: '', projectUrl: '' }

function ProjectsPage({ embedded = false }: { embedded?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isAdmin, setIsAdmin] = useState(embedded)
  const [editor, setEditor] = useState<Project | 'new' | null>(null)
  const [embeddedSelection, setEmbeddedSelection] = useState<Project | null>(null)
  const locationKey = useLocationKey()
  // On the public page the open project lives in the URL (/projects/:id), so it can be
  // shared and Back closes it. Inside the admin it is plain state.
  const routeProjectId = embedded || !locationKey ? '' : decodeURIComponent(getRouteSegments()[1] ?? '')
  const selected = embedded ? embeddedSelection : projects.find((project) => project.id === routeProjectId) ?? null
  const setSelected = (project: Project | null) => {
    if (embedded) setEmbeddedSelection(project)
    else if (project) navigate(`${getPublicPath('projects')}/${encodeURIComponent(project.id)}`)
    else if (routeProjectId) navigate(getPublicPath('projects'))
  }
  // The admin's embedded copy has no title of its own; a project opened by its address keeps the
  // server's title until it has loaded.
  usePageTitle(embedded ? undefined : selected ? selected.title : routeProjectId ? undefined : 'Projects 作品集')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [confirmPdfRemoval, setConfirmPdfRemoval] = useState(false)
  const [draft, setDraft] = useState(blankDraft)
  const [cover, setCover] = useState<File | null>(null)
  const [coverPosition, setCoverPosition] = useState('50% 50%')
  const [coverScale, setCoverScale] = useState(1)
  const [document, setDocument] = useState<File | null>(null)
  const [removeDocument, setRemoveDocument] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [message, setMessage] = useState('')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const result = await fetchProjects().then((items) => ({ items })).catch((error: unknown) => ({ error }))
    if ('items' in result) setProjects(result.items)
    else setLoadError(result.error instanceof Error ? result.error.message : '專案列表暫時無法載入。')
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProjects() }, 0)
    if (embedded) return () => window.clearTimeout(timer)
    let active = true
    fetchAdminSession().then(({ authenticated }) => { if (active) setIsAdmin(authenticated) }).catch(() => { if (active) setIsAdmin(false) })
    return () => { active = false; window.clearTimeout(timer) }
  }, [embedded, loadProjects])

  useEscapeKey(Boolean(editor || selected), () => {
    if (editor) closeEditor()
    else setSelected(null)
  }, 10)

  function openEditor(project: Project | 'new') {
    setEditor(project)
    setSelected(null)
    setDraft(project === 'new' ? blankDraft : {
      title: project.title, summary: project.summary, description: project.description,
      category: project.category, tags: project.tags.join(', '), projectUrl: project.projectUrl,
    })
    setCover(null)
    setCoverPosition(project === 'new' ? '50% 50%' : project.coverImagePosition ?? '50% 50%')
    setCoverScale(project === 'new' ? 1 : project.coverImageScale ?? 1)
    setDocument(null)
    setRemoveDocument(false)
    setMessage('')
  }

  function closeEditor() {
    if (busy) return
    setEditor(null); setCover(null); setDocument(null); setRemoveDocument(false)
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading > 0) { setMessage('圖片還在上傳，請稍候再儲存。'); return }
    setBusy(true); setMessage('')
    const form = new FormData()
    Object.entries(draft).forEach(([key, value]) => form.set(key, value))
    form.set('coverImagePosition', coverPosition)
    form.set('coverImageScale', String(coverScale))
    if (cover) form.set('coverImage', cover)
    if (document) form.set('document', document)
    if (removeDocument) form.set('removeDocument', 'true')
    try {
      const saved = editor !== 'new' && editor ? await updateProject(editor.id, form) : await createProject(form)
      if (saved.coverImagePosition !== coverPosition || saved.coverImageScale !== coverScale) {
        throw new Error('伺服器沒有回傳最新的封面位置與縮放，請確認後端已重新啟動後再儲存。')
      }
      setProjects((current) => editor !== 'new' && editor ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditor(null); setCover(null); setDocument(null); setRemoveDocument(false)
      setMessage('專案已儲存。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '儲存專案失敗。') }
    finally { setBusy(false) }
  }

  async function removeProject(project: Project) {
    setBusy(true); setMessage('')
    try {
      await deleteProject(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
      if (selected?.id === project.id) setSelected(null)
      setProjectToDelete(null)
      setMessage(`已刪除「${project.title}」。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '刪除專案失敗。') }
    finally { setBusy(false) }
  }

  function confirmRemovePdf() {
    setDocument(null)
    setRemoveDocument(editor !== 'new' && Boolean(editor && editor.documentUrl))
    setConfirmPdfRemoval(false)
  }

  const orderedProjects = [...projects].sort((a, b) => (b.updatedAt ?? b.publishedAt).localeCompare(a.updatedAt ?? a.publishedAt))

  return <main className={`main-page projects-page${embedded ? ' projects-page-embedded' : ''}`}>
    <div className="projects-scanline" aria-hidden="true" />
    <header className="projects-heading">
      <div><p className="projects-eyebrow"><span /> PROJECT ARCHIVE · {String(projects.length).padStart(2, '0')} ITEMS</p><h1>Projects</h1><p className="projects-lede">一些正在進行與完成的作品。</p></div>
      <div className="projects-heading-aside"><span className="projects-orbit" aria-hidden="true"><i>✳</i></span><small>BUILD / BREAK / REPEAT</small></div>
    </header>
    {message && <p className="projects-feedback" role="status">{message}</p>}
    {loadError && <p className="projects-feedback project-load-error" role="alert">專案載入失敗：{loadError} <button type="button" className="ui-button ui-button-secondary ui-button-small" onClick={() => void loadProjects()}><UiIcon name="refresh" />重新載入</button></p>}
    <div className="projects-toolbar"><span><i /> ARCHIVE INDEX <b>—</b> {String(projects.length).padStart(2, '0')}</span><span className="projects-toolbar-actions">{embedded && <a href={getPublicPath('projects')}>VIEW PUBLIC PAGE ↗</a>}{isAdmin && <button type="button" className="ui-button ui-button-primary ui-button-small" onClick={() => openEditor('new')}><UiIcon name="plus" />ADD PROJECT</button>}</span></div>
    {loading ? <div className="projects-empty"><span className="projects-loading-mark">✳</span><p>SYNCING ARCHIVE…</p></div> : loadError ? <div className="projects-empty"><span className="projects-loading-mark">!</span><p>ARCHIVE CONNECTION FAILED</p><span>確認伺服器連線後再試一次。</span><button type="button" className="ui-button ui-button-secondary" onClick={() => void loadProjects()}><UiIcon name="refresh" />RETRY</button></div> : orderedProjects.length ? <section className="projects-grid" aria-label="Project archive">
      {orderedProjects.map((project, index) => <article className={`project-card${index === 0 ? ' project-card-featured' : ''}`} data-project-id={project.id} key={project.id}>
        <a className="project-card-main" href={`${getPublicPath('projects')}/${encodeURIComponent(project.id)}`} onClick={(event) => { if (isPlainClick(event)) { event.preventDefault(); setSelected(project) } }}>
          <span className="project-card-top"><span>{project.category || 'UNCLASSIFIED'}</span><span>PRJ-{String(index + 1).padStart(3, '0')}</span></span>
          {project.coverImage ? <CoverImage className="project-card-thumb" src={project.coverImage} position={project.coverImagePosition} scale={project.coverImageScale} /> : <span className="project-card-thumb" aria-hidden="true"><span className="project-art-placeholder"><span>PROJECT FILE</span><b>{String(index + 1).padStart(2, '0')}</b></span></span>}
          <span className="project-card-copy"><strong>{project.title}</strong><span className="project-description">{project.summary}</span><span className="project-tags">{project.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</span><span className="project-action">OPEN PROJECT FILE <span aria-hidden="true">↗</span></span></span>
        </a>
      </article>)}
    </section> : <section className="projects-empty"><span className="projects-loading-mark">⌁</span><p>NO PROJECT FILES FOUND</p><span>The archive is ready for your first project.</span>{isAdmin && <button type="button" className="ui-button ui-button-primary" onClick={() => openEditor('new')}><UiIcon name="plus" />ADD YOUR FIRST PROJECT</button>}</section>}
    <footer className="projects-footer"><span>PERSONAL ARCHIVE</span><span>✳</span><span>END OF TRANSMISSION</span></footer>

    {selected && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <article className="project-detail-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
        <header className="project-detail-header"><p>{selected.category || 'PROJECT FILE'} <span>///</span> {new Date(selected.publishedAt).toLocaleDateString()}</p><button type="button" className="modal-close-button" aria-label="關閉" onClick={() => setSelected(null)}>×</button></header>
        {selected.coverImage && <CoverImage className="detail-cover" src={selected.coverImage} position={selected.coverImagePosition} scale={selected.coverImageScale} lazy={false} />}
        <h2 id="project-detail-title">{selected.title}</h2><p className="project-detail-summary">{selected.summary}</p>
        {selected.tags.length > 0 && <div className="project-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {selected.description && <div className="project-detail-content"><MarkdownPreview content={selected.description} /></div>}
        <footer className="project-detail-actions">{selected.projectUrl && <a className="ui-button ui-button-secondary ui-button-small" href={selected.projectUrl} target="_blank" rel="noreferrer">OPEN LIVE PROJECT<UiIcon name="external" /></a>}{selected.documentUrl && <a className="ui-button ui-button-secondary ui-button-small" href={selected.documentUrl} target="_blank" rel="noreferrer">VIEW PROJECT PDF<UiIcon name="external" /></a>}{!embedded && <ShareButton kind="p" id={selected.id} label="複製專案連結" />}{isAdmin && <div className="project-detail-admin-actions"><button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={() => openEditor(selected)}><UiIcon name="edit" />編輯</button><button type="button" className="ui-button ui-button-danger" disabled={busy} onClick={() => setProjectToDelete(selected)}><UiIcon name="trash" />刪除</button></div>}</footer>
      </article>
    </div>}

    {editor && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor() }}>
      <section className="project-editor-modal" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
        <header className="project-editor-header">
          <div>
            <p>PROJECT ARCHIVE <span>///</span> EDITOR</p>
            <h2 id="project-editor-title">{editor === 'new' ? '新增專案' : '編輯專案'}</h2>
            <small>整理專案資訊、封面與相關文件。</small>
          </div>
          <button type="button" className="modal-close-button" aria-label="關閉" disabled={busy} onClick={closeEditor}>×</button>
        </header>
        <form className="project-editor-form" onSubmit={saveProject}>
          <section className="project-editor-section" aria-labelledby="project-info-heading">
            <div className="project-editor-section-heading"><h3 id="project-info-heading">基本資料</h3><span>名稱、分類與連結</span></div>
            <label className="project-form-field project-title-field">專案名稱<input required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：個人作品集網站" /></label>
            <div className="project-form-two">
              <label className="project-form-field">分類<input maxLength={80} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Web / Design / Research" /></label>
              <label className="project-form-field">專案連結<input type="url" value={draft.projectUrl} onChange={(event) => setDraft({ ...draft, projectUrl: event.target.value })} placeholder="https://…" /></label>
            </div>
          </section>
          <section className="project-editor-section" aria-labelledby="project-description-heading">
            <div className="project-editor-section-heading"><h3 id="project-description-heading">專案介紹</h3><span>簡介會顯示在專案卡片上</span></div>
            <div className="project-editor-summary-grid">
              <label className="project-form-field">簡短介紹 <small>最多 500 字</small><textarea required rows={3} maxLength={500} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="用幾句話說明這個專案的目的與特色" /></label>
              <label className="project-form-field">標籤 <small>以逗號分隔</small><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="React, Design, Open Source" /></label>
            </div>
            <MarkdownEditor label="詳細內容" value={draft.description} onChange={(description) => setDraft((current) => ({ ...current, description }))} onUploadImage={async (file) => (await uploadArticleImage(file)).url} onUploadingChange={setUploading} onError={setMessage} maxLength={100000} placeholder="記錄專案背景、特色與製作過程…" />
          </section>
          <section className="project-editor-section project-editor-assets" aria-labelledby="project-assets-heading">
            <div className="project-editor-section-heading"><h3 id="project-assets-heading">媒體與文件</h3><span>封面固定寬幅比例（4:1），專案卡片與內頁顯示相同的裁切</span></div>
            <div className="project-form-field">
              <span>封面圖片 <small>JPG / PNG / WebP / GIF，最多 8 MB</small></span>
              <FileDropzone title="上傳專案封面" hint="點擊選取圖片" file={cover} previewUrl={editor === 'new' ? undefined : editor.coverImage} imagePosition={coverPosition} imageScale={coverScale} onImagePositionChange={setCoverPosition} onImageScaleChange={setCoverScale} onFile={setCover} />
            </div>
            <div className="project-form-field">
              <span>專案 PDF <small>最多 25 MB</small></span>
              <div className={`project-pdf-drop${document || (editor !== 'new' && editor.documentUrl && !removeDocument) ? ' has-document' : ''}`} onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) event.currentTarget.querySelector<HTMLInputElement>('input')?.click() }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped?.type === 'application/pdf' || dropped?.name.toLowerCase().endsWith('.pdf')) { setDocument(dropped); setRemoveDocument(false) } }}>
                <input type="file" accept="application/pdf,.pdf" onChange={(event) => { setDocument(event.target.files?.[0] ?? null); setRemoveDocument(false); event.currentTarget.value = '' }} />
                <span className="project-pdf-name">{removeDocument ? 'PDF 將在儲存時移除' : document?.name ?? (editor !== 'new' && editor.documentUrl ? editor.documentName ?? decodeURIComponent(editor.documentUrl.split('/').pop() ?? '已附加 PDF 文件') : '拖曳 PDF 到這裡，或點擊選擇檔案')}</span>
                {(document || (editor !== 'new' && editor.documentUrl && !removeDocument)) && <button type="button" className="project-pdf-remove" aria-label="移除 PDF" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmPdfRemoval(true) }}>×</button>}
              </div>
            </div>
          </section>
          {message && <p className="projects-feedback project-editor-error" role="alert">{message}</p>}
          <footer className="project-editor-actions"><button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={closeEditor}>取消</button><button type="submit" className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : '儲存專案'}</button></footer>
        </form>
      </section>
    </div>}
    <ConfirmDialog
      open={Boolean(projectToDelete)}
      title="刪除這個專案？"
      message={projectToDelete ? `「${projectToDelete.title}」刪除後將無法復原。` : ''}
      busy={busy}
      onConfirm={() => projectToDelete ? removeProject(projectToDelete) : undefined}
      onCancel={() => { if (!busy) setProjectToDelete(null) }}
    />
    <ConfirmDialog
      open={confirmPdfRemoval}
      title="移除這份 PDF？"
      message="移除後，儲存專案時才會套用這項變更。"
      onConfirm={confirmRemovePdf}
      onCancel={() => setConfirmPdfRemoval(false)}
    />
  </main>
}

export default ProjectsPage
