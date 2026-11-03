import { useEffect, useState } from 'react'
import { unlock } from '../features/fun/achievements'

type Line = { text: string; tone?: 'muted' | 'ok' | 'warn' | 'punch' }

// Plays a fake "successful" SQL injection dump, then reveals that there is no database
// behind this form at all. Purely theatrical: the server only pattern-matched the input.
function SqlInjectionEgg({ username, flag, onBack }: { username: string; flag?: string; onBack: () => void }) {
  const [shown, setShown] = useState(0)
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '…'`
  const script: Line[] = [
    { text: `> ${query}`, tone: 'muted' },
    { text: '[!] 偵測到注入點… 繞過驗證中', tone: 'warn' },
    { text: '[+] Dumping table `users` …', tone: 'ok' },
    { text: '    id | username | password' },
    { text: '     1 | admin    | ********' },
    { text: '     2 | baihu    | ********' },
    { text: '[+] 正在解密密碼…', tone: 'ok' },
    { text: '     1 | admin    | hunter2' },
    { text: '開玩笑的 😏 這個登入框後面根本沒有 SQL。', tone: 'punch' },
    { text: "xkcd 327：Robert'); DROP TABLE Students;-- 向你問好", tone: 'muted' },
  ]

  useEffect(() => { unlock('bobby-tables') }, [])
  useEffect(() => {
    if (shown >= script.length) return
    const timer = window.setTimeout(() => setShown((count) => count + 1), shown < 2 ? 450 : 380)
    return () => window.clearTimeout(timer)
  }, [shown, script.length])

  return <div className="sql-egg" role="status">
    <div className="sql-egg-log">
      {script.slice(0, shown).map((line, index) => <p key={index} className={line.tone ? `is-${line.tone}` : undefined}>{line.text}</p>)}
    </div>
    {shown >= script.length && <>
      <figure className="sql-egg-comic">
        <img src="/eggs/xkcd-327-bobby-tables.jpg" alt="xkcd 327：學校打電話問家長，是不是真的把兒子取名為 Robert'); DROP TABLE Students;--，家長回答：對，我們叫他小 Bobby Tables。" width="700" height="700" />
        <figcaption><a href="https://xkcd.com/327/" target="_blank" rel="noreferrer">xkcd 327 · Exploits of a Mom</a> · Randall Munroe · CC BY-NC 2.5</figcaption>
      </figure>
      {flag && <div className="admin-login-flag"><small>但你還是值得一面旗子</small><code>{flag}</code></div>}
      <button type="button" className="ui-button ui-button-secondary" onClick={onBack}>回到登入</button>
    </>}
  </div>
}

export default SqlInjectionEgg
