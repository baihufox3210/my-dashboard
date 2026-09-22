import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

type MarkdownPreviewProps = {
  content: string
}

function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content || '*Start writing to see the preview here.*'}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownPreview
