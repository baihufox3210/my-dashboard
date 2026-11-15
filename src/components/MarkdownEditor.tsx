import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import MarkdownPreview from './MarkdownPreview'
import useEscapeKey from './useEscapeKey'
import { prepareImageUpload } from '../features/blog/media'

// Markdown editor shared by Blog articles and Project descriptions. It looks like a
// code editor (line numbers, current-line highlight) and works like Notion: type `/`
// for the block menu, select text for the format bar, paste or drop images.

type Mode = 'edit' | 'split' | 'preview'
type Point = { left: number; top: number; bottom: number }

type MarkdownEditorProps = {
  label: string
  value: string
  onChange: (value: string) => void
  // Uploads an image and resolves to its URL. Without it, images cannot be inserted.
  onUploadImage?: (file: File) => Promise<string>
  onUploadingChange?: (count: number) => void
  onError?: (message: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  size?: 'normal' | 'tall'
  previewHeader?: ReactNode
}

type BlockId = 'text' | 'h1' | 'h2' | 'h3' | 'quote' | 'list' | 'numbered' | 'todo'
type CommandId = BlockId | 'image' | 'code' | 'divider' | 'table' | 'spoiler' | 'link'

const blockPrefix: Record<BlockId, string> = { text: '', h1: '# ', h2: '## ', h3: '### ', quote: '> ', list: '- ', numbered: '1. ', todo: '- [ ] ' }
const anyPrefix = /^(?:#{1,6} |> |- \[[ xX]\] |[-*+] |\d+\. )/

const commands: { id: CommandId; icon: string; label: string; hint: string; keys: string }[] = [
  { id: 'image', icon: '🖼', label: '圖片', hint: '上傳並插入圖片', keys: 'image img picture photo tupian 圖 照片' },
  { id: 'text', icon: 'T', label: '內文', hint: '一般段落文字', keys: 'text paragraph 文字 段落' },
  { id: 'h1', icon: 'H1', label: '標題 1', hint: '最大的標題', keys: 'h1 heading title 大標' },
  { id: 'h2', icon: 'H2', label: '標題 2', hint: '中標題', keys: 'h2 heading 中標' },
  { id: 'h3', icon: 'H3', label: '標題 3', hint: '小標題', keys: 'h3 heading 小標' },
  { id: 'list', icon: '•', label: '項目清單', hint: '簡單的條列', keys: 'list bullet ul 清單 條列' },
  { id: 'numbered', icon: '1.', label: '編號清單', hint: '有順序的條列', keys: 'numbered ordered ol 編號 數字' },
  { id: 'todo', icon: '☑', label: '待辦清單', hint: '可勾選的項目', keys: 'todo task check 待辦 勾選' },
  { id: 'quote', icon: '❝', label: '引用', hint: '引述一段話', keys: 'quote blockquote 引用 引言' },
  { id: 'code', icon: '</>', label: '程式碼區塊', hint: '等寬字與語法區塊', keys: 'code block 程式 代碼' },
  { id: 'divider', icon: '—', label: '分隔線', hint: '水平線分開段落', keys: 'divider hr line 分隔 分割' },
  { id: 'table', icon: '▦', label: '表格', hint: '兩欄的表格範本', keys: 'table 表格' },
  { id: 'spoiler', icon: '░', label: '暴雷', hint: '點了才看得到的文字', keys: 'spoiler hide 暴雷 爆雷 隱藏' },
  { id: 'link', icon: '🔗', label: '連結', hint: '插入超連結', keys: 'link url 連結 網址' },
]

const isImageFile = (file: File) => file.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(file.name)

// Whole-line tint, like syntax colouring. Colour only: weights stay equal so the
// text behind the caret lines up exactly with what is typed.
function lineKind(line: string, inCode: boolean) {
  if (inCode || line.startsWith('```')) return 'code'
  if (/^#{1,6} /.test(line)) return 'heading'
  if (line.startsWith('> ')) return 'quote'
  if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) return 'image'
  if (/^(?:- \[[ xX]\] |[-*+] |\d+\. )/.test(line)) return 'list'
  return ''
}

// Memoised per line: typing re-renders only the line that changed, not the whole file.
const Line = memo(function Line({ number, text, kind }: { number: number; text: string; kind: string }) {
  return <div className={`md-line${kind ? ` is-${kind}` : ''}`}><span className="md-ln" aria-hidden="true">{number}</span><span className="md-ghost">{text || '\u200b'}</span></div>
})

function MarkdownEditor({ label, value, onChange, onUploadImage, onUploadingChange, onError, placeholder, maxLength, disabled, size = 'normal', previewHeader }: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('edit')
  const [roomy, setRoomy] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0, focused: false })
  const [dragging, setDragging] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState(-1)
  const [bubbleHidden, setBubbleHidden] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  const pendingSelection = useRef<[number, number] | null>(null)
  const uploads = useRef(0)
  const shownMenuAt = useRef<number | undefined>(undefined)
  const lastSelection = useRef({ start: 0, end: 0, focused: false })
  useEffect(() => { valueRef.current = value })

  const lines = useMemo(() => value.split('\n'), [value])
  // Rendering Markdown is the slow part; it follows the typing instead of blocking it.
  const previewValue = useDeferredValue(value)
  const rows = useMemo(() => {
    const result: ReactNode[] = []
    let inCode = false
    for (const [index, line] of lines.entries()) {
      const kind = lineKind(line, inCode)
      if (line.startsWith('```')) inCode = !inCode
      result.push(<Line key={index} number={index + 1} text={line} kind={kind} />)
    }
    return result
  }, [lines])

  // Side-by-side needs room; it is offered only while the editor is wide enough.
  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setRoomy(element.clientWidth >= 820))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const shownMode: Mode = mode === 'split' && !roomy ? 'edit' : mode

  const readSelection = useCallback(() => {
    const element = textRef.current
    if (!element) return
    const next = { start: element.selectionStart, end: element.selectionEnd, focused: document.activeElement === element }
    const last = lastSelection.current
    if (last.start === next.start && last.end === next.end && last.focused === next.focused) return
    lastSelection.current = next
    setSelection(next)
    // A format bar closed with Esc comes back only for a new selection.
    setBubbleHidden(false)
  }, [])

  // `/` menu: open while the caret sits right after "/query" at the start of a word.
  const slash = useMemo(() => {
    if (!selection.focused || selection.start !== selection.end || disabled) return null
    const lineStart = value.lastIndexOf('\n', selection.start - 1) + 1
    const match = /(?:^|\s)\/([^\s/]{0,14})$/.exec(value.slice(lineStart, selection.start))
    if (!match) return null
    const query = (match[1] ?? '').toLowerCase()
    const at = selection.start - query.length - 1
    const items = commands.filter((item) => (item.id !== 'image' || onUploadImage) && (!query || item.label.toLowerCase().includes(query) || item.keys.includes(query)))
    return items.length && at !== dismissedAt ? { at, items } : null
  }, [value, selection, dismissedAt, disabled, onUploadImage])
  const activeItem = slash ? Math.min(menuIndex, slash.items.length - 1) : 0
  const showBubble = selection.focused && selection.end > selection.start && !dragging && !bubbleHidden && !disabled

  useEscapeKey(Boolean(slash) || showBubble, () => { if (slash) setDismissedAt(slash.at); else setBubbleHidden(true) }, 60)

  // Where a character sits, measured on the mirrored text behind the textarea.
  const pointAt = useCallback((index: number): Point | undefined => {
    const inner = innerRef.current
    if (!inner) return undefined
    const before = valueRef.current.slice(0, index)
    const lineIndex = before.split('\n').length - 1
    const column = index - (before.lastIndexOf('\n') + 1)
    const node = inner.children[lineIndex]?.querySelector('.md-ghost')?.firstChild
    if (!node) return undefined
    const length = node.textContent?.length ?? 0
    const range = document.createRange()
    range.setStart(node, Math.min(column, length))
    range.setEnd(node, Math.min(column + 1, length))
    const rect = range.getClientRects()[0] ?? (node.parentElement as HTMLElement).getBoundingClientRect()
    const origin = inner.getBoundingClientRect()
    return { left: rect.left - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top }
  }, [])

  // Current-line highlight, set directly so moving the caret does not re-render every row.
  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    inner.querySelector('.md-line.is-current')?.classList.remove('is-current')
    if (selection.focused) inner.children[value.slice(0, selection.start).split('\n').length - 1]?.classList.add('is-current')
  }, [value, selection, rows])

  // Popups are placed after layout, next to the character they belong to, and kept
  // inside the scrolling pane: they flip to the other side when there is no room.
  const slashAt = slash?.at
  useLayoutEffect(() => {
    const pane = scrollRef.current
    const inner = innerRef.current
    if (!pane || !inner) return
    const position = (element: HTMLElement | null, point: Point | undefined, prefer: 'below' | 'above') => {
      if (!element || !point) return
      const height = element.offsetHeight
      const roomBelow = pane.scrollTop + pane.clientHeight - point.bottom
      const roomAbove = point.top - pane.scrollTop
      const below = prefer === 'below' ? roomBelow >= height + 8 || roomBelow >= roomAbove : roomAbove < height + 8
      element.style.left = `${Math.max(4, Math.min(point.left, inner.clientWidth - element.offsetWidth - 4))}px`
      element.style.top = `${below ? point.bottom + 6 : Math.max(pane.scrollTop + 4, point.top - height - 6)}px`
      element.style.visibility = 'visible'
    }
    if (slashAt !== undefined) {
      position(menuRef.current, pointAt(slashAt), 'below')
      // Bring a freshly opened menu fully into view (the dialog around the editor scrolls too).
      if (shownMenuAt.current !== slashAt) menuRef.current?.scrollIntoView({ block: 'nearest' })
    }
    shownMenuAt.current = slashAt
    if (showBubble) {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      position(bubbleRef.current, pointAt(coarse ? selection.end - 1 : selection.start), coarse ? 'below' : 'above')
    }
  })

  // Programmatic edits (an upload placeholder swapped for its URL) keep the caret in place.
  useLayoutEffect(() => {
    const next = pendingSelection.current
    if (!next || !textRef.current) return
    pendingSelection.current = null
    if (document.activeElement === textRef.current) textRef.current.setSelectionRange(next[0], next[1])
  }, [value])

  function replaceRange(from: number, to: number, text: string, selectFrom = text.length, selectTo = selectFrom) {
    const element = textRef.current
    if (!element) return
    element.focus()
    element.setSelectionRange(from, to)
    // execCommand keeps the browser's undo history; fall back where it is unavailable.
    if (!document.execCommand('insertText', false, text)) {
      element.setRangeText(text, from, to, 'end')
      onChange(element.value)
    }
    element.setSelectionRange(from + selectFrom, from + selectTo)
    readSelection()
  }

  function wrap(before: string, after: string, fallback: string) {
    const element = textRef.current
    if (!element) return
    const { selectionStart: start, selectionEnd: end } = element
    const text = element.value.slice(start, end)
    // Pressing the same format again takes it off.
    if (text.startsWith(before) && text.endsWith(after) && text.length >= before.length + after.length) {
      const inner = text.slice(before.length, text.length - after.length)
      replaceRange(start, end, inner, 0, inner.length)
      return
    }
    const body = text || fallback
    replaceRange(start, end, `${before}${body}${after}`, before.length, before.length + body.length)
  }

  function setBlock(block: BlockId) {
    const element = textRef.current
    if (!element) return
    const text = element.value
    const from = text.lastIndexOf('\n', element.selectionStart - 1) + 1
    const endIndex = text.indexOf('\n', Math.max(element.selectionEnd - (element.selectionEnd > element.selectionStart ? 1 : 0), from))
    const to = endIndex === -1 ? text.length : endIndex
    const { selectionStart: start, selectionEnd: end } = element
    const old = text.slice(from, to).split('\n')
    const changed = old.map((line, index) => `${block === 'numbered' ? `${index + 1}. ` : blockPrefix[block]}${line.replace(anyPrefix, '')}`)
    const next = changed.join('\n')
    // Keep the same words selected, so another type or format can be applied right away.
    const firstShift = (changed[0] ?? '').length - (old[0] ?? '').length
    const newStart = Math.max(0, start + firstShift - from)
    const newEnd = Math.max(newStart, end + next.length - (to - from) - from)
    replaceRange(from, to, next, newStart, newEnd)
  }

  function run(id: CommandId) {
    const element = textRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = element.value.slice(start, end)
    const lineStart = element.value.lastIndexOf('\n', start - 1) + 1
    const lead = start === lineStart ? '' : '\n'
    switch (id) {
      case 'image': fileRef.current?.click(); break
      case 'code': {
        const body = selected || ''
        replaceRange(start, end, `${lead}\`\`\`\n${body}\n\`\`\`\n`, lead.length + 4, lead.length + 4 + body.length)
        break
      }
      case 'divider': replaceRange(start, end, `${lead}\n---\n\n`); break
      case 'table': replaceRange(start, end, `${lead}| 欄位 | 內容 |\n| --- | --- |\n| 項目 | 說明 |\n`, lead.length + 2, lead.length + 4); break
      case 'spoiler': wrap('||', '||', '暴雷內容'); break
      case 'link': {
        const text = selected || '連結文字'
        replaceRange(start, end, `[${text}](https://)`, text.length + 3, text.length + 11)
        break
      }
      default: setBlock(id)
    }
  }

  function pickCommand(id: CommandId) {
    if (!slash) return
    const element = textRef.current
    if (!element) return
    // Take the typed "/query" out first, then run the command at that spot.
    replaceRange(slash.at, element.selectionStart, '')
    setMenuIndex(0)
    run(id)
  }

  function swapToken(token: string, url: string | null) {
    const element = textRef.current
    const current = valueRef.current
    const pattern = url === null ? new RegExp(`!\\[[^\\]]*\\]\\(${token}\\)\\n{0,2}`) : new RegExp(`\\(${token}\\)`)
    const match = pattern.exec(current)
    if (!match) return
    const inserted = url === null ? '' : `(${url})`
    const next = current.slice(0, match.index) + inserted + current.slice(match.index + match[0].length)
    const delta = inserted.length - match[0].length
    const shift = (position: number) => position > match.index ? Math.max(match.index, position + delta) : position
    if (element) pendingSelection.current = [shift(element.selectionStart), shift(element.selectionEnd)]
    valueRef.current = next
    onChange(next)
  }

  // Images go in at the caret, each on its own line. A placeholder marks the spot
  // (shown as "uploading" in the preview) until the real URL comes back.
  async function insertImages(files: File[]) {
    const images = files.filter(isImageFile)
    const element = textRef.current
    if (!images.length || !element || !onUploadImage) return
    const tokens = images.map(() => `uploading-${Math.random().toString(36).slice(2, 10)}`)
    const before = element.value.slice(0, element.selectionStart)
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    replaceRange(element.selectionStart, element.selectionEnd, `${lead}${tokens.map((token) => `![](${token})`).join('\n\n')}\n\n`)
    const count = (change: number) => { uploads.current += change; onUploadingChange?.(uploads.current) }
    count(images.length)
    await Promise.all(images.map(async (file, index) => {
      const token = tokens[index] as string
      try {
        swapToken(token, await onUploadImage(await prepareImageUpload(file)))
      } catch (error) {
        swapToken(token, null)
        onError?.(error instanceof Error ? error.message : '圖片上傳失敗。')
      } finally {
        count(-1)
      }
    }))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (slash) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setMenuIndex((activeItem + (event.key === 'ArrowDown' ? 1 : slash.items.length - 1)) % slash.items.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        pickCommand((slash.items[activeItem] ?? slash.items[0])!.id)
        return
      }
    }
    const element = event.currentTarget
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const format = ({ b: ['**', '**', '粗體文字'], i: ['*', '*', '斜體文字'], e: ['`', '`', 'code'] } as Record<string, [string, string, string]>)[event.key.toLowerCase()]
      if (format) { event.preventDefault(); wrap(...format) }
      else if (event.key.toLowerCase() === 'k') { event.preventDefault(); run('link') }
      return
    }
    // Enter continues a list or quote; on an empty item it ends the list instead.
    if (event.key === 'Enter' && !event.shiftKey && element.selectionStart === element.selectionEnd) {
      const caret = element.selectionStart
      const lineStart = element.value.lastIndexOf('\n', caret - 1) + 1
      const line = element.value.slice(lineStart, caret)
      const marker = /^(> |- \[[ xX]\] |[-*+] |(\d+)\. )/.exec(line)
      if (!marker) return
      event.preventDefault()
      if (line.length === marker[0].length) { replaceRange(lineStart, caret, ''); return }
      const next = marker[2] ? `${Number(marker[2]) + 1}. ` : marker[0].startsWith('- [') ? '- [ ] ' : marker[0]
      replaceRange(caret, caret, `\n${next}`)
    }
  }

  const syncPreview = () => {
    const source = scrollRef.current
    const target = previewRef.current
    if (shownMode !== 'split' || !source || !target) return
    target.scrollTop = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight) * (target.scrollHeight - target.clientHeight)
  }

  function format(id: string) {
    if (id === 'b') wrap('**', '**', '粗體文字')
    else if (id === 'i') wrap('*', '*', '斜體文字')
    else if (id === 's') wrap('~~', '~~', '刪除線文字')
    else if (id === 'c') wrap('`', '`', 'code')
    else if (id === 'l') run('link')
    else run('spoiler')
  }
  const formats: { id: string; label: ReactNode; title: string }[] = [
    { id: 'b', label: <b>B</b>, title: '粗體（⌘B）' }, { id: 'i', label: <i>I</i>, title: '斜體（⌘I）' }, { id: 's', label: <s>S</s>, title: '刪除線' },
    { id: 'c', label: '</>', title: '程式碼（⌘E）' }, { id: 'l', label: '🔗', title: '連結（⌘K）' }, { id: 'p', label: '░', title: '暴雷' },
  ]
  const blocks: { id: BlockId; label: string; title: string }[] = [
    { id: 'text', label: '內文', title: '一般文字' }, { id: 'h1', label: 'H1', title: '標題 1（最大）' }, { id: 'h2', label: 'H2', title: '標題 2' }, { id: 'h3', label: 'H3', title: '標題 3' },
    { id: 'quote', label: '❝', title: '引用' }, { id: 'list', label: '•', title: '項目清單' },
  ]

  return <div ref={rootRef} className={`md-editor is-${shownMode} is-${size}${disabled ? ' is-disabled' : ''}`}>
    <header className="md-editor-bar">
      <strong>{label}</strong>
      <span className="md-editor-tip">輸入 <kbd>/</kbd> 插入圖片或區塊，選取文字可調整格式</span>
      <div className="md-editor-tabs" role="group" aria-label="檢視模式">
        <button type="button" className={shownMode === 'edit' ? 'active' : ''} aria-pressed={shownMode === 'edit'} onClick={() => setMode('edit')}>編輯</button>
        {roomy && <button type="button" className={shownMode === 'split' ? 'active' : ''} aria-pressed={shownMode === 'split'} onClick={() => setMode('split')}>並排</button>}
        <button type="button" className={shownMode === 'preview' ? 'active' : ''} aria-pressed={shownMode === 'preview'} onClick={() => setMode('preview')}>預覽</button>
      </div>
    </header>
    <div className="md-editor-panes">
      {shownMode !== 'preview' && <div
        ref={scrollRef}
        className={`md-code${dropping ? ' is-dropping' : ''}`}
        onScroll={syncPreview}
        onMouseDown={(event) => { if (event.target === event.currentTarget || (event.target as Element).classList.contains('md-code-fill')) { event.preventDefault(); textRef.current?.focus() } }}
        onDragOver={(event) => { if (onUploadImage && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropping(true) } }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false) }}
        onDrop={(event) => {
          setDropping(false)
          const files = [...event.dataTransfer.files]
          if (!onUploadImage || !files.some(isImageFile)) return
          event.preventDefault()
          void insertImages(files)
        }}
      >
        <div ref={innerRef} className="md-code-inner" style={{ '--md-ln': `${String(lines.length).length}ch` } as React.CSSProperties}>
          {rows}
          <textarea
            ref={textRef}
            className="md-input"
            value={value}
            onChange={(event) => { onChange(event.target.value); readSelection() }}
            onSelect={readSelection}
            onFocus={readSelection}
            onBlur={() => { lastSelection.current = { ...lastSelection.current, focused: false }; setSelection(lastSelection.current) }}
            onPointerDown={() => {
              setDragging(true)
              const done = () => { window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); window.removeEventListener('blur', done); setDragging(false); readSelection() }
              window.addEventListener('pointerup', done)
              window.addEventListener('pointercancel', done)
              window.addEventListener('blur', done)
            }}
            onKeyDown={handleKeyDown}
            onPaste={(event) => {
              const files = [...event.clipboardData.files]
              if (!onUploadImage || !files.some(isImageFile)) return
              event.preventDefault()
              void insertImages(files)
            }}
            placeholder={placeholder}
            aria-label={label}
            maxLength={maxLength}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="off"
          />
          {slash && <div ref={menuRef} className="md-menu" role="listbox" aria-label="插入區塊" onMouseDown={(event) => event.preventDefault()}>
            <small>插入區塊</small>
            {slash.items.map((item, index) => <button key={item.id} type="button" role="option" aria-selected={index === activeItem} className={index === activeItem ? 'active' : ''} ref={index === activeItem ? (element) => element?.scrollIntoView({ block: 'nearest' }) : undefined} onMouseMove={() => { if (index !== activeItem) setMenuIndex(index) }} onClick={() => pickCommand(item.id)}>
              <i aria-hidden="true">{item.icon}</i><span><b>{item.label}</b><em>{item.hint}</em></span>
            </button>)}
          </div>}
          {showBubble && <div ref={bubbleRef} className="md-bubble" role="toolbar" aria-label="文字格式" onMouseDown={(event) => event.preventDefault()}>
            {blocks.map((block) => <button key={block.id} type="button" title={block.title} aria-label={block.title} onClick={() => setBlock(block.id)}>{block.label}</button>)}
            <span aria-hidden="true" />
            {formats.map((item) => <button key={item.id} type="button" title={item.title} aria-label={item.title} onClick={() => format(item.id)}>{item.label}</button>)}
          </div>}
        </div>
        <div className="md-code-fill" />
      </div>}
      {shownMode !== 'edit' && <div ref={previewRef} className="md-preview">
        {previewHeader}
        {previewValue.trim() ? <MarkdownPreview content={previewValue} /> : <p className="md-preview-empty">內容會在這裡預覽。</p>}
      </div>}
    </div>
    {onUploadImage && <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.avif" multiple hidden onChange={(event) => { void insertImages([...(event.target.files ?? [])]); event.currentTarget.value = '' }} />}
  </div>
}

export default MarkdownEditor
