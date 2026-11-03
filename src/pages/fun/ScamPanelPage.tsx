import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import useEscapeKey from '../../components/useEscapeKey'
import { unlock } from '../../features/fun/achievements'
import { rickroll } from '../../features/fun/memes'
import { navigate } from '../../routes/routes'

// A satirical copy of a phishing gang's back-office. Everything is generated in the
// browser and fake (phone numbers are random and masked); every control explains how
// the real thing scams people instead of doing anything.
const FakeWebshell = lazy(() => import('./FakeWebshell'))

type Status = 'done' | 'failed' | 'pending'
type Row = { id: number; at: Date; template: string; status: Status; note: string; phone: string; code: string; clicked: boolean; visits: number; missed: number; views: number }

const templates = ['7號 中獎通知', '3號 包裹待領', '1號 帳戶異常', '5號 飆股群組', '2號 健保退費', '4號 交友聊天']
const notes = ['', '', '', '阿嬤說要先問孫子', '對方回：我在 165 上班', '對方把話術截圖貼上 Dcard', '對方反問我們要不要買保險', '對方說驗證碼是 123456（騙你的）', '對方開始傳長輩圖', '對方已加入防詐 LINE 官方帳號', '對方要我們先匯 100 元表達誠意']
const codes = ['', '', '不給你', '165165', '000000', '這是假的']
const lessons: Record<string, { title: string; body: string }[]> = {
  done: [
    { title: '「已完成」= 又一個人交出了驗證碼', body: '真實的詐騙後台就是這樣即時看著被害人輸入資料。銀行、電商、物流與政府機關都不會用簡訊連結要你輸入驗證碼。' },
    { title: '驗證碼就是你家鑰匙', body: '簡訊驗證碼一旦交出去，對方就能登入你的帳號、綁定支付或盜刷。任何人跟你要，都直接掛掉。' },
  ],
  view: [
    { title: '你點了幾次，他們都知道', body: '釣魚連結會記錄你點擊的次數、時間與輸入的每一個字。收到不明連結時，別點，直接到官方 App 或網站查詢。' },
  ],
  wrong: [
    { title: '「驗證碼錯誤，請再輸入一次」', body: '這是詐騙集團最愛的招數：謊稱錯誤讓你重複輸入，其實每一次都被用來登入不同的帳號或付款。' },
  ],
  delete: [
    { title: '刪不掉的 🚓', body: '資料已經被 165 全民防騙網備份了。真實世界裡，蒐證（截圖、保留簡訊與通話紀錄）比刪除重要。' },
  ],
  note: [
    { title: '備註：本系統已被監控', body: '詐騙集團會在備註裡記錄被害人的弱點：獨居、急著用錢、怕麻煩。陌生來電講到「監管帳戶」「解除分期」，就是詐騙。' },
  ],
  search: [
    { title: '查無資料 🎉', body: '你的手機號碼不在這裡，請繼續保持！記得：不明來電、+886 以外的國際號碼、要求操作 ATM 的，一律掛斷。' },
  ],
  notify: [
    { title: '我們不會真的跟你要通知權限 😉', body: '詐騙網站常要求你「允許通知」，接著就狂推假中獎、假中毒的訊息。不認識的網站，按「封鎖」。' },
  ],
  status: [
    { title: '在線人數：0', body: '其實線上的是 165 的值班人員。遇到可疑訊息，撥 165 反詐騙諮詢專線，或用「165 全民防騙網」查證。' },
  ],
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] as T
}

function maskedPhone() {
  return `09${Math.floor(Math.random() * 90 + 10)}-***-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
}

let nextId = 1
function makeRow(at: Date): Row {
  const status: Status = Math.random() < .08 ? 'done' : Math.random() < .05 ? 'failed' : 'pending'
  const clicked = Math.random() < .55
  return { id: nextId++, at, template: randomItem(templates), status, note: randomItem(notes), phone: maskedPhone(), code: clicked ? randomItem(codes) : '', clicked, visits: Math.floor(Math.random() * 7), missed: Math.random() < .08 ? 1 : 0, views: Math.floor(Math.random() * 14) + 1 }
}

function initialRows() {
  const now = Date.now()
  return Array.from({ length: 18 }, (_unused, index) => makeRow(new Date(now - (index * 3 + Math.random() * 3) * 60_000)))
}

function formatTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Two-tone siren, only after the visitor ticks the sound box.
function playSiren() {
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    gain.gain.value = .05
    for (let step = 0; step < 6; step++) oscillator.frequency.setValueAtTime(step % 2 ? 660 : 880, context.currentTime + step * .22)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 1.3)
    oscillator.onended = () => { void context.close() }
  } catch { /* audio unavailable */ }
}

function ScamPanelPage() {
  const [rows, setRows] = useState(initialRows)
  const [lesson, setLesson] = useState<{ title: string; body: string } | null>(null)
  const [takenOver, setTakenOver] = useState(false)
  const [sound, setSound] = useState(false)
  const [webshell, setWebshell] = useState<{ name: string; content: string } | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const clicks = useRef(0)
  useEscapeKey(Boolean(lesson), () => setLesson(null), 40)

  useEffect(() => { unlock('scam-buster') }, [])

  // "實時動態": a new fake victim appears every few seconds until the 165 takeover.
  useEffect(() => {
    if (takenOver) return
    const timer = window.setInterval(() => setRows((current) => [makeRow(new Date()), ...current].slice(0, 60)), 4200)
    return () => window.clearInterval(timer)
  }, [takenOver])

  useEffect(() => {
    if (takenOver) return
    const timer = window.setTimeout(() => { setLesson(null); setTakenOver(true) }, 45_000)
    return () => window.clearTimeout(timer)
  }, [takenOver])

  useEffect(() => {
    if (takenOver && sound) playSiren()
  }, [takenOver, sound])

  const teach = useCallback((kind: keyof typeof lessons) => {
    clicks.current += 1
    // After enough poking around, "165" takes the panel over (instead of another lesson).
    if (clicks.current >= 8) { clicks.current = 0; setLesson(null); setTakenOver(true); return }
    setLesson(randomItem(lessons[kind] ?? lessons.delete))
  }, [])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // Read locally only; the file never leaves the browser and is never executed.
    const content = (await file.slice(0, 64 * 1024).text()).replace(/\r\n/g, '\n')
    if (/<\?php/i.test(content)) {
      unlock('webshell')
      setWebshell({ name: file.name.replace(/[^\w.-]/g, '_').slice(0, 40) || 'shell.php', content })
    } else {
      setLesson({ title: '模板格式錯誤', body: '只接受「.php 模板」（誤）。真實的詐騙集團會上傳仿冒的物流、銀行網頁當作模板，網址常長得很像但多一個字母。' })
    }
  }

  const counts = { done: rows.filter((row) => row.status === 'done').length, failed: rows.filter((row) => row.status === 'failed').length, pending: rows.filter((row) => row.status === 'pending').length + 620 }

  return <main className="scam-panel">
    <header className="scam-topbar">
      <div><strong>实时动态 · 记录管理</strong><button type="button" className="scam-online" onClick={() => teach('status')}><i />在线 0</button></div>
      <nav><button type="button" onClick={() => navigate('/')}>← 返回首页</button><button type="button" onClick={() => setRows(initialRows())}>刷新</button></nav>
    </header>

    <section className="scam-toolbar">
      <button type="button" className="scam-stat is-done" onClick={() => teach('done')}>已完成 <b>{counts.done}</b></button>
      <button type="button" className="scam-stat is-failed" onClick={() => teach('wrong')}>未完成 <b>{counts.failed}</b></button>
      <button type="button" className="scam-stat" onClick={() => teach('view')}>待定 <b>{counts.pending}</b></button>
      <button type="button" className="scam-danger" onClick={() => teach('delete')}>批量删除</button>
      <input type="date" aria-label="日期" />
      <select aria-label="模板" defaultValue=""><option value="">全部模板</option>{templates.map((template) => <option key={template}>{template}</option>)}</select>
      <input placeholder="搜索手機號" aria-label="搜索手機號" />
      <button type="button" className="scam-primary" onClick={() => teach('search')}>搜索</button>
      <button type="button" onClick={() => setRows(initialRows())}>重置</button>
      <button type="button" onClick={() => uploadRef.current?.click()}>上传模板</button>
      <button type="button" onClick={rickroll}>下载受害者名单.zip</button>
      <input ref={uploadRef} type="file" hidden accept=".php,.txt,.html" onChange={(event) => void handleUpload(event)} />
      <span className="scam-toolbar-right">
        <label><input type="checkbox" checked={sound} onChange={(event) => { setSound(event.target.checked); if (event.target.checked) playSiren() }} /> 声音提醒</label>
        <button type="button" className="scam-link" onClick={() => teach('notify')}>开启浏览器通知</button>
        <span>· 数据保留 720 小时</span>
      </span>
    </section>

    <div className="scam-table-wrap">
      <table className="scam-table">
        <tbody>{rows.map((row) => <tr key={row.id} className={row.id === nextId - 1 && !takenOver ? 'is-new' : undefined}>
          <td>{formatTime(row.at)}</td>
          <td>{row.template}</td>
          <td className="scam-status">
            {(['done', 'failed', 'pending'] as const).map((status) => <button key={status} type="button" className={row.status === status ? `is-active is-${status}` : ''} onClick={() => teach(status === 'done' ? 'done' : status === 'failed' ? 'wrong' : 'view')}>{status === 'done' ? '已完成' : status === 'failed' ? '未完成' : '待定'}</button>)}
          </td>
          <td><button type="button" className="scam-link" onClick={() => teach('note')}>添加備註</button>{row.note && <span className="scam-note">{row.note}</span>}</td>
          <td className="scam-mono">{row.phone}</td>
          <td className="scam-mono scam-code">{row.code || '(空)'}</td>
          <td>{row.clicked ? '已點擊' : '未點擊'}</td>
          <td>{row.visits}</td>
          <td>{row.missed ? `未收到 ${row.missed}` : 0}</td>
          <td><button type="button" className="scam-link" onClick={() => teach('view')}>查看({row.views})</button></td>
          <td className="scam-actions">
            <button type="button" onClick={() => teach('wrong')}>手機號碼錯誤</button>
            <button type="button" onClick={() => teach('wrong')}>驗證碼錯誤</button>
            <button type="button" className="is-danger" onClick={() => teach('delete')}>刪除</button>
          </td>
        </tr>)}</tbody>
      </table>
    </div>

    <p className="scam-ribbon">🦊 這是諷刺彩蛋 · 所有資料皆為隨機產生的假資料 · 遇到可疑來電或簡訊請撥 <b>165</b> 反詐騙諮詢專線</p>

    {lesson && <div className="scam-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLesson(null) }}>
      <section className="scam-modal" role="dialog" aria-modal="true" aria-labelledby="scam-lesson-title">
        <small>反詐騙小教室</small>
        <h2 id="scam-lesson-title">{lesson.title}</h2>
        <p>{lesson.body}</p>
        <button type="button" className="scam-primary" onClick={() => setLesson(null)}>我知道了</button>
      </section>
    </div>}

    {takenOver && <div className="scam-takeover" role="alertdialog" aria-labelledby="scam-takeover-title">
      <div className="scam-takeover-lights" aria-hidden="true" />
      <section>
        <span aria-hidden="true">🚓</span>
        <h2 id="scam-takeover-title">本後台已由 165 全民防騙網接管</h2>
        <p>開玩笑的，這只是彩蛋。但真實的詐騙後台確實長這樣：他們看著被害人一筆一筆輸入手機號碼與驗證碼。</p>
        <ul>
          <li>簡訊驗證碼不給任何人，包括自稱客服、警察、檢察官的人。</li>
          <li>不點簡訊裡的「包裹待領」「帳戶異常」「中獎」連結。</li>
          <li>有疑問先掛斷，撥 165 或打給家人確認。</li>
        </ul>
        <div><button type="button" className="scam-primary" onClick={() => navigate('/')}>回到首頁</button><button type="button" onClick={() => setTakenOver(false)}>繼續逛逛（彩蛋）</button></div>
      </section>
    </div>}

    {webshell && <Suspense fallback={null}><FakeWebshell fileName={webshell.name} content={webshell.content} onClose={() => setWebshell(null)} /></Suspense>}
  </main>
}

export default ScamPanelPage
