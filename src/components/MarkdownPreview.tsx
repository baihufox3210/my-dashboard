import { lazy, Suspense } from 'react'

// react-markdown and its plugins are a large share of the bundle, so they load on first use.
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))

function MarkdownPreview({ content }: { content: string }) {
  return (
    <Suspense fallback={<div className="markdown-preview" aria-busy="true" />}>
      <MarkdownRenderer content={content} />
    </Suspense>
  )
}

export default MarkdownPreview
