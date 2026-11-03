import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from './useEscapeKey'
import { useMusicPlayer } from './MusicPlayerContext'
import { fetchArticles, fetchHomeProfile } from '../features/blog/api'
import { requestGuestbook } from '../features/blog/guestbook'
import { achievements, unlock, unlockedAchievements } from '../features/fun/achievements'
import { getPublicPath, navigate, type PublicPage } from '../routes/routes'

type Line = { text: string; tone?: 'input' | 'muted' | 'accent' | 'error' }

const pages: PublicPage[] = ['home', 'about', 'projects', 'blog', 'friends']
const commands = ['help', 'whoami', 'ls', 'cd', 'blog', 'read', 'guestbook', 'music', 'achievements', 'fortune', 'date', 'echo', 'history', 'clear', 'exit', 'sudo']
const fortunes = [
  '今天適合寫一點 code，也適合什麼都不寫。',
  '保持好奇心，答案通常藏在下一個 commit。',
  'Bug 不是錯誤，是還沒被理解的功能。',
  '大吉：今天的 CI 會一次就綠。',
  '小吉：記得 git push。',
  '你會在意想不到的地方找到 flag。',
  '休息一下，喝杯水，再回來 debug。',
]
const help: Line[] = [
  { text: '可用指令：', tone: 'accent' },
  { text: '  whoami            關於站長' },
  { text: '  ls                列出頁面' },
  { text: '  cd <頁面>          前往頁面（home、about、projects、blog、friends）' },
  { text: '  blog              最新文章；read <編號> 開啟文章' },
  { text: '  guestbook         打開留言板' },
  { text: '  music [play|pause|next|prev]' },
  { text: '  achievements      查看你的成就' },
  { text: '  fortune           今日運勢' },
  { text: '  date · echo · history · clear · exit' },
]

function Terminal({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([
    { text: 'baihu-os v1.0 — 輸入 help 查看指令，Tab 自動補完，Esc 離開。', tone: 'muted' },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const { tracks, currentTrackIndex, isPlaying, toggle, changeTrack } = useMusicPlayer()
  useEscapeKey(true, onClose, 30)

  useEffect(() => { unlock('terminal'); inputRef.current?.focus() }, [])
  useEffect(() => { outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }) }, [lines])

  const print = (...next: Line[]) => setLines((current) => [...current, ...next])
  const go = (path: string) => { navigate(path); onClose() }

  async function run(raw: string) {
    const [command = '', ...args] = raw.trim().split(/\s+/)
    const name = command.toLowerCase()
    print({ text: `baihu@site:~$ ${raw}`, tone: 'input' })
    if (!name) return
    setHistory((current) => [...current, raw])

    switch (name) {
      case 'help': print(...help); break
      case 'whoami': {
        const profile = await fetchHomeProfile().catch(() => null)
        print({ text: profile?.name ?? 'baihu', tone: 'accent' }, { text: profile?.quote ?? '' }, ...(profile?.tags.length ? [{ text: profile.tags.map((tag) => `#${tag}`).join(' '), tone: 'muted' as const }] : []))
        break
      }
      case 'ls': print({ text: [...pages, 'guestbook'].map((page) => `${page}/`).join('  ') }); break
      case 'cd': case 'open': {
        const target = (args[0] ?? 'home').replace(/\/$/, '').toLowerCase()
        if (target === 'guestbook') { requestGuestbook(); go(getPublicPath('home')); break }
        if (target === '..' || target === '~' || target === '/') { go(getPublicPath('home')); break }
        if (pages.includes(target as PublicPage)) go(getPublicPath(target as PublicPage))
        else print({ text: `cd: 找不到頁面：${target}`, tone: 'error' })
        break
      }
      case 'blog': {
        const articles = await fetchArticles().catch(() => [])
        if (!articles.length) { print({ text: '還沒有文章。', tone: 'muted' }); break }
        print(...articles.slice(0, 5).map((article, index) => ({ text: `  [${index + 1}] ${new Date(article.publishedAt).toLocaleDateString('zh-TW')}  ${article.title}` })), { text: '輸入 read <編號> 開啟文章', tone: 'muted' })
        break
      }
      case 'read': {
        const articles = await fetchArticles().catch(() => [])
        const article = articles[Number(args[0]) - 1]
        if (article) go(`${getPublicPath('blog')}/post/${encodeURIComponent(article.id)}`)
        else print({ text: 'read: 請輸入 blog 列出的編號，例如 read 1', tone: 'error' })
        break
      }
      case 'guestbook': requestGuestbook(); go(getPublicPath('home')); break
      case 'music': {
        const action = args[0]?.toLowerCase()
        if (!tracks.length) { print({ text: '還沒有音樂。', tone: 'muted' }); break }
        if (action === 'next') changeTrack(1)
        else if (action === 'prev') changeTrack(-1)
        else if ((action === 'play' && !isPlaying) || (action === 'pause' && isPlaying) || !action) toggle()
        const track = tracks[action === 'next' ? (currentTrackIndex + 1) % tracks.length : action === 'prev' ? (currentTrackIndex - 1 + tracks.length) % tracks.length : currentTrackIndex]
        print({ text: `♫ ${track?.title ?? ''}`, tone: 'accent' })
        break
      }
      case 'achievements': {
        const unlocked = unlockedAchievements()
        print(
          { text: `成就 ${Object.keys(unlocked).length} / ${achievements.length}`, tone: 'accent' },
          ...achievements.map((item) => unlocked[item.id] ? { text: `  ${item.emoji} ${item.title} — ${item.description}` } : { text: '  🔒 ??? — 尚未解鎖', tone: 'muted' as const }),
        )
        break
      }
      case 'fortune': print({ text: `🔮 ${fortunes[Math.floor(Math.random() * fortunes.length)]}`, tone: 'accent' }); break
      case 'date': print({ text: new Date().toLocaleString('zh-TW') }); break
      case 'echo': print({ text: args.join(' ') }); break
      case 'history': print(...history.map((item, index) => ({ text: `  ${index + 1}  ${item}` }))); break
      case 'clear': setLines([]); break
      case 'exit': onClose(); break
      case 'sudo': unlock('sudo'); print({ text: 'visitor is not in the sudoers file. This incident will be reported. 😏', tone: 'error' }); break
      case 'rm': print({ text: 'rm: 這裡沒有東西可以刪…放過這個網站吧 🥺', tone: 'error' }); break
      case 'cat': print({ text: args[0]?.includes('flag') ? 'flag 不在這裡。也許該去登入頁碰碰運氣？' : `cat: ${args[0] ?? ''}: 沒有這個檔案`, tone: args[0]?.includes('flag') ? 'accent' : 'error' }); break
      default: print({ text: `${name}: command not found — 輸入 help 看看能做什麼`, tone: 'error' })
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const value = input
      setInput('')
      setCursor(-1)
      void run(value)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (!history.length) return
      const next = event.key === 'ArrowUp' ? (cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1)) : (cursor < 0 ? -1 : cursor + 1)
      if (next < 0 || next >= history.length) { setCursor(-1); setInput(''); return }
      setCursor(next)
      setInput(history[next] ?? '')
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const [command = '', argument] = input.split(/\s+/)
      const options = argument === undefined ? commands.filter((item) => item.startsWith(command.toLowerCase())) : ['cd', 'open'].includes(command) ? [...pages, 'guestbook'].filter((page) => page.startsWith(argument.toLowerCase())) : []
      if (options.length === 1) setInput(argument === undefined ? `${options[0]} ` : `${command} ${options[0]}`)
      else if (options.length > 1) print({ text: `baihu@site:~$ ${input}`, tone: 'input' }, { text: options.join('  '), tone: 'muted' })
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setLines([])
    }
  }

  return createPortal(
    <div className="terminal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="terminal-window" role="dialog" aria-modal="true" aria-label="終端機" onMouseUp={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus() }}>
        <header className="terminal-titlebar">
          <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
          <strong>visitor@baihu-site — zsh</strong>
          <button type="button" aria-label="關閉終端機" onClick={onClose}>×</button>
        </header>
        <div className="terminal-output" ref={outputRef} aria-live="polite">
          {lines.map((line, index) => <p key={index} className={line.tone ? `is-${line.tone}` : undefined}>{line.text || ' '}</p>)}
          <label className="terminal-prompt">
            <span aria-hidden="true">baihu@site:~$</span>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="輸入指令" />
          </label>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default Terminal
