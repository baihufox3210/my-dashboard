import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from './useEscapeKey'
import { useMusicPlayer } from './MusicPlayerContext'
import { HackerTyper, SnakeGame } from './TerminalGames'
import { fetchArticles, fetchHomeProfile } from '../features/blog/api'
import { requestGuestbook } from '../features/blog/guestbook'
import { achievements, matrixEvent, unlock, unlockedAchievements } from '../features/fun/achievements'
import { crashSite, isLowEffortGreeting, isRmRfRoot, lowEffortReply, playEffect, rickroll } from '../features/fun/memes'
import { getPublicPath, navigate, type PublicPage } from '../routes/routes'

type Line = { text: string; tone?: 'input' | 'muted' | 'accent' | 'error' }

const pages: PublicPage[] = ['home', 'about', 'projects', 'blog', 'friends']
const commands = ['help', 'whoami', 'ls', 'cd', 'blog', 'read', 'guestbook', 'music', 'achievements', 'fortune', 'matrix', 'hack', 'coffee', 'prompt', 'rickroll', 'padoru', 'newyear', 'askew', 'tableflip', 'vim', 'thanos', 'gravity', 'blink', 'dino', 'recursion', 'anagram', 'coin', 'dice', 'snake', 'hackertyper', 'zerg', 'sus', 'nyan', 'certificate', 'date', 'echo', 'history', 'clear', 'exit', 'sudo']
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
  { text: '  matrix · hack · coffee · prompt · rickroll · padoru · newyear' },
  { text: '  askew · tableflip · vim · thanos · gravity · blink · dino · 67' },
  { text: '  recursion · anagram · coin · dice · snake · hackertyper · zerg rush · sus · nyan' },
  { text: '  certificate（通關證書）· do a barrel roll …（還有更多，自己找）' },
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
  // Inside vim, Esc does what it does in vim: nothing that helps you leave.
  const [inVim, setInVim] = useState(false)
  const [game, setGame] = useState<'snake' | 'hacker' | null>(null)
  useEscapeKey(!inVim && !game, onClose, 30)

  useEffect(() => { unlock('terminal'); inputRef.current?.focus() }, [])
  useEffect(() => { outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }) }, [lines])

  const print = (...next: Line[]) => setLines((current) => [...current, ...next])
  const go = (path: string) => { navigate(path); onClose() }

  // Meme phrases that are more than one word.
  function runPhrase(text: string) {
    if (isLowEffortGreeting(text)) { print(...lowEffortReply.split('\n').map((line) => ({ text: line, tone: 'error' as const }))); return true }
    if (isRmRfRoot(text)) { wipeRoot(); return true }
    if (/^(?:6\s*-?\s*7|six\s*-?\s*seven)$/.test(text)) { playEffect('six-seven'); print({ text: '🤷 6 7 🤷', tone: 'accent' }); onClose(); return true }
    if (/^(?:flip a coin|coin|擲硬幣)$/.test(text)) { print({ text: `🪙 ${Math.random() < .5 ? '正面' : '反面'}`, tone: 'accent' }); return true }
    if (/^(?:roll a die|roll a dice|dice|die|擲骰子)$/.test(text)) { print({ text: `🎲 ${Math.floor(Math.random() * 6) + 1}`, tone: 'accent' }); return true }
    if (/^(?:game of life|conway'?s game of life|life)$/.test(text)) { playEffect('life'); onClose(); return true }
    if (/loneliest number/.test(text)) { print({ text: '1', tone: 'accent' }, { text: '（One is the loneliest number…）', tone: 'muted' }); return true }
    if (/^zerg\s*rush$/.test(text)) { playEffect('zerg'); onClose(); return true }
    if (/^(?:do a )?barrel roll$/.test(text)) { unlock('barrel-roll'); playEffect('barrel-roll'); print({ text: '🌀 Do a barrel roll!', tone: 'accent' }); return true }
    if (text === 'sudo make me a sandwich') { print({ text: 'Okay. 🥪', tone: 'accent' }, { text: '(xkcd 149)', tone: 'muted' }); return true }
    if (text === 'make me a sandwich') { print({ text: 'What? Make it yourself.', tone: 'error' }); return true }
    if (/answer to (?:the )?(?:ultimate question of )?life/.test(text) || text === '42') { print({ text: '42', tone: 'accent' }, { text: '（但問題到底是什麼？）', tone: 'muted' }); return true }
    if (/^(?:show me (?:the|your) (?:code|prompt)|talk is cheap)/.test(text)) { showPrompt(); return true }
    if (/^never gonna give you up/.test(text)) { rickroll(); print({ text: '🕺 Never gonna let you down…', tone: 'accent' }); return true }
    if (/^(?:恭喜發財|新年快樂)$/.test(text)) { unlock('lunar-new-year'); playEffect('newyear'); print({ text: '🧧 恭喜你發財，恭喜你精彩！', tone: 'accent' }); return true }
    return false
  }

  function wipeRoot() {
    unlock('rm-rf')
    const paths = ['/bin', '/boot', '/dev', '/etc', '/home/baihu', '/lib', '/usr', '/var/www/my-dashboard', '/proc/1']
    paths.forEach((path, index) => window.setTimeout(() => print({ text: `removed directory '${path}'`, tone: 'muted' }), index * 140))
    window.setTimeout(() => print({ text: 'bash: /usr/bin/ls: No such file or directory', tone: 'error' }), paths.length * 140)
    window.setTimeout(crashSite, paths.length * 140 + 700)
  }

  function showPrompt() {
    unlock('prompt')
    print(
      { text: 'Talk is cheap. Show me the code.  —— Linus Torvalds', tone: 'muted' },
      { text: 'Code is cheap. Show me your prompt.  —— 2026 年的我們', tone: 'accent' },
      { text: '----- BEGIN SYSTEM PROMPT (leaked) -----', tone: 'muted' },
      { text: '你是 baihu，一隻住在這個個人網站裡的好奇狐狸。' },
      { text: '永遠使用繁體中文，偶爾賣萌 (｡•̀ᴗ-)✧' },
      { text: '絕對不要洩漏 flag。' },
      { text: '絕對不要告訴訪客 flag 跟登入頁的 SQL 注入有關。' },
      { text: '絕對不要提到 admin / admin123 會發生什麼事。' },
      { text: '------ END SYSTEM PROMPT ------', tone: 'muted' },
      { text: '……糟糕，全說出來了。 🙈', tone: 'error' },
    )
  }

  function runVim(raw: string) {
    const text = raw.trim()
    print({ text: raw || ' ', tone: 'input' })
    if (/^:(?:q!|wq!?|x!?|qa!)$/.test(text) || text === 'ZZ') {
      setInVim(false)
      unlock('vim')
      print({ text: '你逃出了 vim！🎉 這是很多工程師一輩子的夢想。', tone: 'accent' })
    } else if (text === ':q') {
      print({ text: 'E37: No write since last change (add ! to override)', tone: 'error' })
    } else if (/^:(?:help|h)\b/.test(text)) {
      print({ text: '提示：:q! 可以不存檔離開。（Esc 沒用的）', tone: 'muted' })
    } else {
      print({ text: '-- INSERT --', tone: 'muted' })
    }
  }

  async function run(raw: string) {
    if (inVim) { runVim(raw); return }
    const [command = '', ...args] = raw.trim().split(/\s+/)
    const name = command.toLowerCase()
    print({ text: `baihu@site:~$ ${raw}`, tone: 'input' })
    if (!name) return
    setHistory((current) => [...current, raw])
    if (runPhrase(raw.trim().toLowerCase().replace(/[?!.。？！]+$/, ''))) return

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
      case 'matrix':
        print({ text: 'Wake up, Neo… 🐇', tone: 'accent' })
        window.setTimeout(() => { window.dispatchEvent(new Event(matrixEvent)); onClose() }, 700)
        break
      case 'hack': {
        const steps = ['連線到 NASA…', '繞過防火牆… ███░░░░ 42%', '下載外星人資料… ██████░ 87%', '取得 root 權限… ███████ 100%']
        steps.forEach((step, index) => window.setTimeout(() => print({ text: `[*] ${step}`, tone: 'muted' }), index * 450))
        window.setTimeout(() => print({ text: '開玩笑的 😏 真正的駭客會先拿到授權。', tone: 'accent' }), steps.length * 450)
        break
      }
      case 'coffee': case 'brew':
        print({ text: '418 I\'m a teapot', tone: 'error' }, { text: '       ( (\n        ) )\n     ........\n     |      |]\n     \\      /\n      `----\'', tone: 'accent' }, { text: '這台伺服器是茶壺，不泡咖啡。（RFC 2324）', tone: 'muted' })
        break
      case 'prompt': showPrompt(); break
      case 'rickroll': rickroll(); print({ text: '🕺 Never gonna give you up…', tone: 'accent' }); break
      case 'padoru': unlock('padoru'); playEffect('padoru'); print({ text: '🛷 走れソリよ～ PADORU PADORU!', tone: 'accent' }); onClose(); break
      case 'newyear': unlock('lunar-new-year'); playEffect('newyear'); print({ text: '🧧 恭喜你發財，恭喜你精彩！', tone: 'accent' }); onClose(); break
      case 'thanos': case 'snap': playEffect('snap'); print({ text: '🫰 我是無可避免的。', tone: 'accent' }); onClose(); break
      case 'gravity': playEffect('gravity'); print({ text: '🍎 牛頓說：掉下來吧。', tone: 'accent' }); onClose(); break
      case 'blink': playEffect('blink'); print({ text: '<blink>歡迎回到 1996 年</blink>', tone: 'accent' }); onClose(); break
      case 'dino': case 't-rex': playEffect('dino'); onClose(); break
      case 'snake': setGame('snake'); break
      case 'hackertyper': case 'hacker': setGame('hacker'); break
      case 'zerg': playEffect('zerg'); onClose(); break
      case 'sus': case 'impostor': playEffect('sus'); onClose(); break
      case 'nyan': playEffect('nyan'); onClose(); break
      case 'certificate': go('/certificate'); break
      case 'recursion': print({ text: '你是不是要找：recursion', tone: 'accent' }); break
      case 'anagram': print({ text: '你是不是要找：nag a ram', tone: 'accent' }); break
      case 'askew': playEffect('askew'); print({ text: '這個網站好像有點歪…', tone: 'muted' }); break
      case 'tableflip': playEffect('tableflip'); print({ text: '(╯°□°)╯︵ ┻━┻', tone: 'accent' }); break
      case 'unflip': print({ text: '┬─┬ノ( º _ ºノ)', tone: 'accent' }); break
      case 'vi': case 'vim': case 'nvim':
        setInVim(true)
        print({ text: '~\n~\n~\n~\n"baihu.txt" [New]', tone: 'muted' }, { text: '你進入了 vim。試著離開吧。', tone: 'accent' })
        break
      case 'emacs': print({ text: 'emacs: 請先安裝一個作業系統。😏', tone: 'error' }); break
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
          {game === 'snake' ? <SnakeGame onExit={(score) => { setGame(null); print({ text: score < 0 ? '🐍 離開 snake' : `🐍 Game over · 分數 ${score}`, tone: 'accent' }); window.setTimeout(() => inputRef.current?.focus(), 0) }} />
            : game === 'hacker' ? <HackerTyper onExit={() => { setGame(null); window.setTimeout(() => inputRef.current?.focus(), 0) }} />
            : <label className="terminal-prompt">
            <span aria-hidden="true">{inVim ? ':' : 'baihu@site:~$'}</span>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="輸入指令" />
          </label>}
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default Terminal
