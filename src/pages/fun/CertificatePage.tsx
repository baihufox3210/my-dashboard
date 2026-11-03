import { useEffect, useRef, useState } from 'react'
import { achievements, requiredAchievements, unlockedAchievements } from '../../features/fun/achievements'
import { getPublicPath } from '../../routes/routes'

const nameKey = 'certificate-name'

function token(name: string, fallback: string) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback
}

// Draws the completion certificate; colors come from the current theme.
function drawCertificate(canvas: HTMLCanvasElement, name: string, unlockedCount: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  const width = canvas.width
  const height = canvas.height
  const primary = token('--theme-primary', '#806348')
  const strong = token('--theme-primary-strong', '#5f482f')
  const ink = token('--theme-card-ink', '#29231e')
  const font = token('--font-ui', 'sans-serif')
  context.fillStyle = '#fffdf9'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = primary
  context.lineWidth = 14
  context.strokeRect(36, 36, width - 72, height - 72)
  context.lineWidth = 2
  context.strokeRect(62, 62, width - 124, height - 124)
  context.textAlign = 'center'
  context.fillStyle = strong
  context.font = `700 30px ${font}`
  context.fillText('CERTIFICATE OF COMPLETION', width / 2, 170)
  context.font = '120px sans-serif'
  context.fillText('🦊', width / 2, 330)
  context.fillStyle = ink
  context.font = `800 64px ${font}`
  context.fillText('白狐網站通關證書', width / 2, 450)
  context.font = `400 30px ${font}`
  context.fillStyle = strong
  context.fillText('茲證明', width / 2, 530)
  context.fillStyle = ink
  context.font = `800 72px ${font}`
  context.fillText(name || '神秘的訪客', width / 2, 630)
  context.fillStyle = strong
  context.font = `400 30px ${font}`
  context.fillText(`找到了白狐網站的所有彩蛋，解鎖 ${unlockedCount} / ${achievements.length} 個成就`, width / 2, 710)
  context.font = `400 24px ${font}`
  context.fillText(`${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} · baihu 🦊 簽發`, width / 2, 840)
}

function CertificatePage() {
  const [name, setName] = useState(() => { try { return localStorage.getItem(nameKey) ?? '' } catch { return '' } })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [unlocked] = useState(unlockedAchievements)
  const required = requiredAchievements()
  const done = required.filter((item) => unlocked[item.id]).length
  const complete = done === required.length

  useEffect(() => {
    if (complete && canvasRef.current) drawCertificate(canvasRef.current, name.trim(), Object.keys(unlocked).length)
    try { localStorage.setItem(nameKey, name) } catch { /* storage unavailable */ }
  }, [complete, name, unlocked])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'baihu-certificate.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return <main className="main-page honeypot-page">
    <section className="home-panel honeypot-card certificate-card">
      <p className="home-eyebrow">CERTIFICATE</p>
      {complete ? <>
        <h1>🏆 恭喜通關！</h1>
        <p>輸入你的名字，下載專屬的通關證書。</p>
        <input className="certificate-name" value={name} maxLength={20} placeholder="你的名字" aria-label="證書上的名字" onChange={(event) => setName(event.target.value)} />
        <canvas ref={canvasRef} className="certificate-canvas" width={1400} height={960} aria-label="通關證書預覽" />
        <button type="button" className="ui-button ui-button-primary" onClick={download}>下載證書 PNG</button>
      </> : <>
        <h1>還差一點點</h1>
        <p>通關證書要解鎖全部成就（隱藏加分成就除外）才能領取。</p>
        <div className="certificate-progress" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={done}><i style={{ width: `${done / required.length * 100}%` }} /></div>
        <p><strong>{done} / {required.length}</strong>{'\u3000'}在網站上按 <code>`</code> 打開終端機，輸入 <code>achievements</code> 看看還缺什麼。</p>
        <a className="ui-button ui-button-secondary" href={getPublicPath('home')}>繼續探索</a>
      </>}
    </section>
  </main>
}

export default CertificatePage
