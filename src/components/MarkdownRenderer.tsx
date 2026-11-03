import { useState, type KeyboardEvent, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

type MarkdownPreviewProps = {
  content: string
}

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

const spoilerSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'markdown-spoiler']],
  },
}

const marker = '||' as const
const skipped = new Set(['code', 'inlineCode', 'html'])

// Split text nodes at every `||` so a spoiler can wrap formatted content such as
// `||**bold** and ~~struck~~||` or one that spans a line break.
function splitMarkers(children: MarkdownNode[]): (MarkdownNode | typeof marker)[] {
  return children.flatMap((child): (MarkdownNode | typeof marker)[] => {
    if (child.type !== 'text' || !child.value?.includes(marker)) return [child]
    return child.value.split(marker).flatMap((text, index) => [
      ...(index > 0 ? [marker] as const : []),
      ...(text ? [{ type: 'text', value: text } satisfies MarkdownNode] : []),
    ])
  })
}

function wrapSpoilers(node: MarkdownNode) {
  if (skipped.has(node.type) || !node.children) return
  node.children.forEach(wrapSpoilers)
  const pieces = splitMarkers(node.children)
  if (!pieces.includes(marker)) return

  const result: MarkdownNode[] = []
  let open: MarkdownNode[] | null = null
  const literal = (text: string) => {
    const target = open ?? result
    const last = target[target.length - 1]
    if (last?.type === 'text') last.value += text
    else target.push({ type: 'text', value: text })
  }
  for (const piece of pieces) {
    if (piece !== marker) { (open ?? result).push(piece); continue }
    if (!open) { open = []; continue }
    const content: MarkdownNode[] = open
    open = null
    // `||||` stays as typed.
    if (content.length === 0) { literal(marker + marker); continue }
    result.push({ type: 'emphasis', data: { hName: 'span', hProperties: { className: ['markdown-spoiler'] } }, children: content })
  }
  // An unmatched `||` is just text.
  if (open) {
    const rest: MarkdownNode[] = open
    open = null
    literal(marker)
    rest.forEach((piece) => (piece.type === 'text' ? literal(piece.value ?? '') : result.push(piece)))
  }
  node.children = result
}

function remarkSpoilers() {
  return (tree: MarkdownNode) => { wrapSpoilers(tree) }
}

function SpoilerText({ children, className }: { children?: ReactNode; className?: string }) {
  const [revealed, setRevealed] = useState(false)
  if (!className?.includes('markdown-spoiler')) return <span className={className}>{children}</span>
  const toggle = () => setRevealed((current) => !current)
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return <span
    className={`markdown-spoiler${revealed ? ' is-revealed' : ''}`}
    role="button"
    tabIndex={0}
    aria-expanded={revealed}
    aria-label={revealed ? undefined : '顯示暴雷內容'}
    title={revealed ? '再點一下藏起來' : '點我偷看 👀'}
    // Once revealed, links inside work normally instead of hiding the text again.
    onClick={(event) => { if (!revealed || !(event.target as Element).closest('a')) toggle() }}
    onKeyDown={handleKeyDown}
  >{children}</span>
}

function MarkdownRenderer({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, spoilerSchema]]}
        remarkPlugins={[remarkGfm, remarkBreaks, remarkSpoilers]}
        components={{ span: SpoilerText }}
      >
        {content || '*Start writing to see the preview here.*'}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
