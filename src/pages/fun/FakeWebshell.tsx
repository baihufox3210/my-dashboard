import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import useEscapeKey from '../../components/useEscapeKey'

// A pretend webshell on the parody scam server. Nothing is executed or sent anywhere:
// the "filesystem" is the object below, and the uploaded file is only displayed as text.
type Line = { text: string; tone?: 'muted' | 'accent' | 'error' | 'ok' }

const home = '/var/www/html'

function buildFiles(fileName: string, content: string): Record<string, string> {
  return {
    [`${home}/index.php`]: '<?php\n// 假冒物流「包裹待領」的釣魚頁\n// 網址看起來像官方，其實多了一個字母\nrequire "config.php";\n?>',
    [`${home}/config.php`]: "<?php\n$db_host = 'localhost';\n$db_user = 'scam_boss';\n$db_pass = 'call_165_now';   // 真的別學\n?>",
    [`${home}/victims.csv`]: 'time,template,phone,code\n2026-11-03 21:45,7號 中獎通知,09**-***-243,(空)\n2026-11-03 21:39,3號 包裹待領,09**-***-676,不給你\n2026-11-03 21:31,1號 帳戶異常,09**-***-113,165165\n# 以上全是假的。但真實的詐騙後台，就是這樣一筆一筆收你的驗證碼。',
    [`${home}/${fileName}`]: content,
    '/home/boss/money.txt': '帳上餘額：0 元\n狀態：已被警方凍結 🧊',
    '/home/boss/README_POLICE.txt': '給看到這裡的你：\n1. 簡訊驗證碼不給任何人。\n2. 「解除分期」「監管帳戶」「保證獲利」= 詐騙。\n3. 有疑問撥 165，或先打給家人。\n4. 不要自己駭回去 —— 未經授權入侵別人的系統一樣違法。',
    '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nboss:x:1000:1000:詐騙集團老闆（已落網）:/home/boss:/bin/bash',
    '/root/flag.txt': '',
  }
}

const help: Line[] = [
  { text: '可用指令：ls  cd  pwd  cat  whoami  id  uname -a  ps  rm  sudo  wget  curl  clear  exit', tone: 'muted' },
]

function FakeWebshell({ fileName, content, onClose }: { fileName: string; content: string; onClose: () => void }) {
  const [files] = useState(() => buildFiles(fileName, content))
  const [cwd, setCwd] = useState(home)
  const [wiped, setWiped] = useState(false)
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { text: `[+] 已上傳 ${fileName}（${content.length} bytes）`, tone: 'ok' },
    { text: '[+] 後門植入成功，取得 www-data 權限 😈', tone: 'ok' },
    { text: '[i] 放心：這個 shell 只活在你的瀏覽器裡，什麼都沒被執行。輸入 help。', tone: 'muted' },
  ])
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  useEscapeKey(true, onClose, 50)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }) }, [lines])

  const print = (...next: Line[]) => setLines((current) => [...current, ...next])
  const resolve = (target = '.') => {
    if (target === '~') return '/home/boss'
    const parts = (target.startsWith('/') ? target : `${cwd}/${target}`).split('/')
    const stack: string[] = []
    for (const part of parts) {
      if (!part || part === '.') continue
      if (part === '..') stack.pop()
      else stack.push(part)
    }
    return `/${stack.join('/')}`
  }
  const isDirectory = (path: string) => Object.keys(files).some((file) => file.startsWith(`${path === '/' ? '' : path}/`))
  const exists = (path: string) => !wiped || !path.startsWith(home)

  function run(raw: string) {
    const [command = '', ...args] = raw.trim().split(/\s+/)
    print({ text: `www-data@scam-hq:${cwd}$ ${raw}` })
    switch (command) {
      case '': return
      case 'help': print(...help); return
      case 'whoami': print({ text: 'www-data' }); return
      case 'id': print({ text: 'uid=33(www-data) gid=33(www-data) groups=33(www-data),165(watched-by-police)' }); return
      case 'pwd': print({ text: cwd }); return
      case 'uname': print({ text: 'Linux scam-hq 6.6.6-fraud #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' }); return
      case 'ps': print({ text: '  PID CMD\n    1 /sbin/init\n  165 police-monitor --watching=you\n  420 php-fpm: pool scam\n  666 sms-blaster --target=everyone' }); return
      case 'ls': {
        const path = resolve(args.find((arg) => !arg.startsWith('-')))
        const prefix = `${path === '/' ? '' : path}/`
        const entries = new Set(Object.keys(files).filter((file) => file.startsWith(prefix) && exists(file)).map((file) => file.slice(prefix.length).split('/')[0]))
        print({ text: entries.size ? [...entries].join('  ') : (wiped && path.startsWith(home) ? '(空的，詐騙資料已被清除)' : `ls: ${path}: 沒有這個目錄`), tone: entries.size ? undefined : 'muted' })
        return
      }
      case 'cd': {
        const path = resolve(args[0] ?? '~')
        if (path.startsWith('/root')) { print({ text: 'cd: /root: Permission denied（你只是 www-data）', tone: 'error' }); return }
        if (isDirectory(path) || path === '/') setCwd(path)
        else print({ text: `cd: ${args[0]}: 沒有這個目錄`, tone: 'error' })
        return
      }
      case 'cat': case 'less': case 'head': {
        const path = resolve(args[0])
        if (path.startsWith('/root')) { print({ text: `cat: ${path}: Permission denied。想要 flag？試試首頁的終端機 🦊`, tone: 'error' }); return }
        const file = exists(path) ? files[path] : undefined
        if (file === undefined) print({ text: `cat: ${args[0] ?? ''}: 沒有這個檔案`, tone: 'error' })
        else print({ text: file || '(空檔案)', tone: path.endsWith('README_POLICE.txt') ? 'accent' : undefined })
        return
      }
      case 'rm': {
        if (!args.some((arg) => arg.includes('r'))) { print({ text: 'rm: 加上 -rf 試試看？', tone: 'muted' }); return }
        setWiped(true)
        print(
          { text: '正在刪除被害人資料…', tone: 'muted' },
          { text: '✅ 詐騙集團的資料已清除！', tone: 'ok' },
          { text: '⚠ 但現實中請「蒐證後報警」，不要自己駭回去：未經授權入侵他人系統一樣違法。', tone: 'accent' },
        )
        return
      }
      case 'sudo': print({ text: 'www-data is not in the sudoers file. This incident will be reported to 165. 🚓', tone: 'error' }); return
      case 'wget': case 'curl': case 'nc': case 'bash': case 'python': case 'python3': case 'php':
        print({ text: `${command}: 連線被拒絕 —— 這個 shell 活在你的瀏覽器沙箱裡，伸不出去 🦊`, tone: 'error' })
        return
      case 'clear': setLines([]); return
      case 'exit': onClose(); return
      default: print({ text: `${command}: command not found`, tone: 'error' })
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const value = input
    setInput('')
    run(value)
  }

  return createPortal(
    <div className="terminal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="terminal-window webshell-window" role="dialog" aria-modal="true" aria-label="模擬 webshell" onMouseUp={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus() }}>
        <header className="terminal-titlebar">
          <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
          <strong>{fileName} — uid=33(www-data) — 模擬環境</strong>
          <button type="button" aria-label="關閉" onClick={onClose}>×</button>
        </header>
        <div className="terminal-output" ref={outputRef} aria-live="polite">
          {lines.map((line, index) => <p key={index} className={line.tone ? `is-${line.tone}` : undefined}>{line.text}</p>)}
          <label className="terminal-prompt">
            <span aria-hidden="true">www-data@scam-hq:{cwd}$</span>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="輸入指令" />
          </label>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default FakeWebshell
