import { escapeHtml } from './origin.js'

// The pages are rendered in the browser, so a crawler that does not run scripts would see
// an empty page. This turns an article's Markdown into plain HTML (headings, paragraphs,
// images) that is placed inside #root; React replaces it as soon as the app starts.
// Spoilers are blanked so they do not leak into search results.
function inline(text: string) {
  return escapeHtml(text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`|\*)/g, ''))
}

export function crawlerHtml(markdown: string, absolute: (url: string) => string) {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/\|\|[\s\S]+?\|\|/g, '▒▒▒').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let fenced = false
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.join(' ')}</p>`)
    paragraph = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('```')) { flush(); fenced = !fenced; continue }
    if (fenced) { if (line) blocks.push(`<p>${escapeHtml(line)}</p>`); continue }
    if (!line) { flush(); continue }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      // The page's own <h1> is the title, so the Markdown headings start at <h2>.
      const level = Math.max(2, Math.min((heading[1] ?? '#').length, 6))
      blocks.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`)
      continue
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(line)
    if (image) {
      flush()
      blocks.push(`<img src="${escapeHtml(absolute(image[2] ?? ''))}" alt="${escapeHtml(image[1] ?? '')}" />`)
      continue
    }
    if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes('-')) continue
    const cells = /^\|(.+)\|$/.exec(line)
    const text = cells ? (cells[1] ?? '').split('|').map((cell) => cell.trim()).filter(Boolean).join(' ') : line.replace(/^(?:>\s?|[-*+]\s+|\d+\.\s+)/, '')
    if (text) paragraph.push(inline(text))
  }
  flush()
  return blocks.join('\n')
}
