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

function replaceSpoilerText(node: MarkdownNode): MarkdownNode[] {
  if (node.type !== 'text' || typeof node.value !== 'string') {
    if (node.type === 'inlineCode' || node.type === 'code' || !node.children) return [node]
    node.children = node.children.flatMap(replaceSpoilerText)
    return [node]
  }

  const pattern = /\|\|([\s\S]+?)\|\|/g
  const parts: MarkdownNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(node.value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > cursor) parts.push({ type: 'text', value: node.value.slice(cursor, start) })
    parts.push({
      type: 'emphasis',
      data: { hName: 'span', hProperties: { className: ['markdown-spoiler'] } },
      children: [{ type: 'text', value: match[1] ?? '' }],
    })
    cursor = end
  }

  if (cursor === 0) return [node]
  if (cursor < node.value.length) parts.push({ type: 'text', value: node.value.slice(cursor) })
  return parts
}

function remarkSpoilers() {
  return (tree: MarkdownNode) => {
    if (tree.children) tree.children = tree.children.flatMap(replaceSpoilerText)
  }
}

function SpoilerText({ children }: { children?: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
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
    aria-label={revealed ? '隱藏暴雷內容' : '顯示暴雷內容'}
    onClick={toggle}
    onKeyDown={handleKeyDown}
  >{children}</span>
}

function MarkdownPreview({ content }: MarkdownPreviewProps) {
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

export default MarkdownPreview
