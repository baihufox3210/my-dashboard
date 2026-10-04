import { useCallback, useEffect, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import FileDropzone from '../components/FileDropzone'
import ConfirmDialog from '../components/ConfirmDialog'
import { createProject, deleteProject, fetchAdminSession, fetchProjects, updateProject } from '../features/blog/api'
import type { Project } from '../features/blog/article'

type ProjectDraft = { title: string; summary: string; description: string; category: string; tags: string; projectUrl: string }
const blankDraft: ProjectDraft = { title: '', summary: '', description: '', category: '', tags: '', projectUrl: '' }

function measureProjectCoverAspectRatio(projectId?: string) {
  const cards = [...document.querySelectorAll<HTMLElement>('.project-card[data-project-id]')]
  const card = cards.find((item) => item.dataset.projectId === projectId) ?? cards[0]
  const frame = card?.querySelector<HTMLElement>('.project-card-art')
  if (frame?.offsetWidth && frame.offsetHeight) return frame.offsetWidth / frame.offsetHeight

  const page = document.querySelector<HTMLElement>('.projects-page')
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const pageWidth = page?.clientWidth || window.innerWidth
  const frameWidth = pageWidth * 0.9 - rem * 2
  const frameHeight = rem * (window.innerWidth <= 768 ? 9 : 10)
  return Math.max(1, frameWidth / frameHeight)
}

function getProjectCardCoverStyle(position = '50% 50%', scale = 1) {
  return {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectPosition: position,
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    willChange: 'transform',
  }
}

function ProjectsPage({ embedded = false }: { embedded?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isAdmin, setIsAdmin] = useState(embedded)
  const [editor, setEditor] = useState<Project | 'new' | null>(null)
  const [selected, setSelected] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [confirmPdfRemoval, setConfirmPdfRemoval] = useState(false)
  const [draft, setDraft] = useState(blankDraft)
  const [cover, setCover] = useState<File | null>(null)
  const [coverPosition, setCoverPosition] = useState('50% 50%')
  const [coverScale, setCoverScale] = useState(1)
  const [coverAspectRatio, setCoverAspectRatio] = useState(16 / 9)
  const [document, setDocument] = useState<File | null>(null)
  const [removeDocument, setRemoveDocument] = useState(false)
  const [busy, setBusy] = useState(false)
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

  useEffect(() => {
    if (!editor && !selected) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setEditor(null); setSelected(null) }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [editor, selected])

  function openEditor(project: Project | 'new') {
    setCoverAspectRatio(measureProjectCoverAspectRatio(project === 'new' ? undefined : project.id))
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
    {loadError && <p className="projects-feedback project-load-error" role="alert">專案載入失敗：{loadError} <button type="button" onClick={() => void loadProjects()}>重新載入</button></p>}
    <div className="projects-toolbar"><span><i /> ARCHIVE INDEX <b>—</b> {String(projects.length).padStart(2, '0')}</span><span className="projects-toolbar-actions">{embedded && <a href="#projects">VIEW PUBLIC PAGE ↗</a>}{isAdmin && <button type="button" className="project-add-button" onClick={() => openEditor('new')}>＋ ADD PROJECT</button>}</span></div>
    {loading ? <div className="projects-empty"><span className="projects-loading-mark">✳</span><p>SYNCING ARCHIVE…</p></div> : loadError ? <div className="projects-empty"><span className="projects-loading-mark">!</span><p>ARCHIVE CONNECTION FAILED</p><span>確認伺服器連線後再試一次。</span><button type="button" className="project-add-button" onClick={() => void loadProjects()}>↻ RETRY</button></div> : orderedProjects.length ? <section className="projects-grid" aria-label="Project archive">
      {orderedProjects.map((project, index) => <article className={`project-card${index === 0 ? ' project-card-featured' : ''}`} data-project-id={project.id} key={project.id}>
        <button type="button" className="project-card-main" onClick={() => setSelected(project)} aria-label={`查看專案：${project.title}`}>
          <span className="project-card-top"><span>{project.category || 'UNCLASSIFIED'}</span><span>PRJ-{String(index + 1).padStart(3, '0')}</span></span>
          <span className={`project-card-art${project.coverImage ? ' has-cover public-article-cover-frame' : ''}`} aria-hidden="true">{project.coverImage ? <img className="public-article-cover" src={project.coverImage} alt="" style={getProjectCardCoverStyle(project.coverImagePosition, project.coverImageScale)} /> : <span className="project-art-placeholder"><span>PROJECT FILE</span><b>{String(index + 1).padStart(2, '0')}</b></span>}</span>
          <span className="project-card-copy"><strong>{project.title}</strong><span className="project-description">{project.summary}</span><span className="project-tags">{project.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</span><span className="project-action">OPEN PROJECT FILE <span aria-hidden="true">↗</span></span></span>
        </button>
      </article>)}
    </section> : <section className="projects-empty"><span className="projects-loading-mark">⌁</span><p>NO PROJECT FILES FOUND</p><span>The archive is ready for your first project.</span>{isAdmin && <button type="button" className="project-add-button" onClick={() => openEditor('new')}>＋ ADD YOUR FIRST PROJECT</button>}</section>}
    <footer className="projects-footer"><span>PERSONAL ARCHIVE</span><span>✳</span><span>END OF TRANSMISSION</span></footer>

    {selected && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <article className="project-detail-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
        <header className="project-detail-header"><p>{selected.category || 'PROJECT FILE'} <span>///</span> {new Date(selected.publishedAt).toLocaleDateString()}</p><button type="button" aria-label="關閉" onClick={() => setSelected(null)}>×</button></header>
        {selected.coverImage && <img className="project-detail-cover" src={selected.coverImage} alt="" style={{ objectPosition: selected.coverImagePosition ?? '50% 50%', transform: `scale(${selected.coverImageScale ?? 1})`, transformOrigin: 'center' }} />}
        <h2 id="project-detail-title">{selected.title}</h2><p className="project-detail-summary">{selected.summary}</p>
        {selected.tags.length > 0 && <div className="project-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {selected.description && <div className="project-detail-content"><MarkdownPreview content={selected.description} /></div>}
        <footer className="project-detail-actions">{selected.projectUrl && <a href={selected.projectUrl} target="_blank" rel="noreferrer">OPEN LIVE PROJECT <span>↗</span></a>}{selected.documentUrl && <a href={selected.documentUrl} target="_blank" rel="noreferrer">VIEW PROJECT PDF <span>↗</span></a>}{isAdmin && <div className="project-detail-admin-actions"><button type="button" disabled={busy} onClick={() => openEditor(selected)}>EDIT</button><button type="button" className="project-delete-button" disabled={busy} onClick={() => setProjectToDelete(selected)}>DELETE</button></div>}</footer>
      </article>
    </div>}

    {editor && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor() }}>
      <section className="project-editor-modal" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
        <header className="project-detail-header"><div><p>PROJECT ARCHIVE <span>///</span> EDITOR</p><h2 id="project-editor-title">{editor === 'new' ? 'ADD NEW PROJECT' : 'UPDATE PROJECT'}</h2></div><button type="button" aria-label="關閉" disabled={busy} onClick={closeEditor}>×</button></header>
        <form onSubmit={saveProject}>
          <label className="project-form-field">PROJECT TITLE<input required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="專案名稱" /></label>
          <div className="project-form-two"><label className="project-form-field">CATEGORY<input maxLength={80} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Web / Design / Research" /></label><label className="project-form-field">PROJECT LINK<input type="url" value={draft.projectUrl} onChange={(event) => setDraft({ ...draft, projectUrl: event.target.value })} placeholder="https://…" /></label></div>
          <label className="project-form-field">SHORT SUMMARY <small>最多 500 字</small><textarea required rows={2} maxLength={500} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="用一句話介紹這個專案" /></label>
          <label className="project-form-field">TAGS <small>用逗號分隔</small><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="React, Design, Open Source" /></label>
          <label className="project-form-field">PROJECT NOTES <small>支援 Markdown</small><textarea rows={6} maxLength={100000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="記錄專案背景、特色、製作過程…" /></label>
          <div className="project-form-two project-file-fields"><div className="project-form-field"><span>COVER IMAGE <small>JPG / PNG / WebP / GIF，最多 8 MB</small></span><FileDropzone title="上傳專案封面" hint="點擊選取圖片" file={cover} previewUrl={editor === 'new' ? undefined : editor.coverImage} imagePosition={coverPosition} imageScale={coverScale} aspectRatio={coverAspectRatio} onImagePositionChange={setCoverPosition} onImageScaleChange={setCoverScale} onFile={setCover} /></div><div className="project-form-field"><span>PROJECT DOCUMENT <small>PDF，最多 25 MB</small></span><div className={`project-pdf-drop${document || (editor !== 'new' && editor.documentUrl && !removeDocument) ? ' has-document' : ''}`} onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) event.currentTarget.querySelector<HTMLInputElement>('input')?.click() }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped?.type === 'application/pdf' || dropped?.name.toLowerCase().endsWith('.pdf')) { setDocument(dropped); setRemoveDocument(false) } }}><input type="file" accept="application/pdf,.pdf" onChange={(event) => { setDocument(event.target.files?.[0] ?? null); setRemoveDocument(false); event.currentTarget.value = '' }} /><span className="project-pdf-name">{removeDocument ? 'PDF 將在儲存時移除' : document?.name ?? (editor !== 'new' && editor.documentUrl ? editor.documentName ?? decodeURIComponent(editor.documentUrl.split('/').pop() ?? '已附加 PDF 文件') : '拖曳 PDF 到這裡，或點擊選擇檔案')}</span>{(document || (editor !== 'new' && editor.documentUrl && !removeDocument)) && <button type="button" className="project-pdf-remove" aria-label="移除 PDF" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmPdfRemoval(true) }}>×</button>}</div></div></div>
          {message && <p className="projects-feedback" role="alert">{message}</p>}
          <footer className="project-editor-actions"><button type="button" disabled={busy} onClick={closeEditor}>CANCEL</button><button type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PROJECT'}</button></footer>
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
