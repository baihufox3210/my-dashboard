import { useEffect, useState } from 'react'
import FileDropzone from '../../components/FileDropzone'
import { fetchHomeProfile, updateHomeProfile } from '../../features/blog/api'
import type { HomeProfile } from '../../features/blog/article'

type SectionProps = { onMessage: (message: string) => void }

const blankProfile: HomeProfile = { name: '', introduction: '', quote: '', socials: [], tags: [], avatarMessages: [], updateTitle: '', updateText: '' }

function HomeProfileSection({ onMessage }: SectionProps) {
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState(blankProfile)
  const [socials, setSocials] = useState('')
  const [tags, setTags] = useState('')
  const [avatarMessages, setAvatarMessages] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)

  useEffect(() => {
    fetchHomeProfile().then((loadedProfile) => {
      setProfile(loadedProfile)
      setSocials(loadedProfile.socials.map((item) => `${item.name} | ${item.url}`).join('\n'))
      setTags(loadedProfile.tags.join(', '))
      setAvatarMessages(loadedProfile.avatarMessages.join('\n'))
    }).catch((error: unknown) => onMessage(error instanceof Error ? error.message : '無法載入後台資料。'))
  }, [onMessage])

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); onMessage('')
    const form = new FormData()
    form.set('name', profile.name); form.set('introduction', profile.introduction); form.set('quote', profile.quote)
    form.set('socials', JSON.stringify(socials.split('\n').map((line) => { const [name = '', ...url] = line.split('|'); return { name: name.trim(), url: url.join('|').trim() } }).filter((item) => item.name && item.url)))
    form.set('tags', JSON.stringify(tags.split(',').map((tag) => tag.trim()).filter(Boolean)))
    form.set('avatarMessages', JSON.stringify(avatarMessages.split('\n').map((item) => item.trim()).filter(Boolean)))
    form.set('updateTitle', profile.updateTitle); form.set('updateText', profile.updateText)
    if (avatar) form.set('avatar', avatar)
    try { const result = await updateHomeProfile(form); setProfile(result); setAvatar(null); onMessage('首頁內容已儲存。') }
    catch (error) { onMessage(error instanceof Error ? error.message : '儲存失敗。') }
    finally { setBusy(false) }
  }

  return <form className="admin-form-card" onSubmit={saveProfile}><div className="admin-form-intro"><div><h2>首頁個人介紹</h2><p>這些內容會顯示在網站首頁。</p></div><button className="ui-button ui-button-primary" disabled={busy}>{busy ? '儲存中…' : '儲存變更'}</button></div>
          <div className="admin-form-grid"><div className="admin-form-section span-two"><span>個人介紹</span></div><div className="admin-field span-two">頭像<FileDropzone title="上傳首頁頭像" file={avatar} previewUrl={profile.avatarUrl} onFile={setAvatar} /></div>
            <label className="admin-field span-two avatar-messages-field">點擊頭像時顯示的文字 <small>每行一則，點擊頭像時隨機顯示一則</small><textarea rows={8} maxLength={3200} value={avatarMessages} onChange={(event) => setAvatarMessages(event.target.value)} placeholder={'嗨，歡迎來逛逛！ (｡•̀ᴗ-)✧\n今天也要保持好奇心！ (ง •̀_•́)ง'} /></label>
            <label className="admin-field">顯示名稱<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="admin-field">首頁短句<input value={profile.quote} onChange={(event) => setProfile({ ...profile, quote: event.target.value })} /></label>
            <label className="admin-field span-two">個人介紹<textarea rows={4} value={profile.introduction} onChange={(event) => setProfile({ ...profile, introduction: event.target.value })} /></label><label className="admin-field span-two">社群連結 <small>每行一筆：名稱 | 網址</small><textarea rows={3} value={socials} onChange={(event) => setSocials(event.target.value)} placeholder={'Instagram | https://…\nGitHub | https://…'} /></label>
            <label className="admin-field span-two">個人標籤 <small>以逗號分隔</small><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="設計, 開發, 日常" /></label><div className="admin-form-section span-two"><span>首頁動態</span></div><label className="admin-field span-two">區塊標題<input value={profile.updateTitle} onChange={(event) => setProfile({ ...profile, updateTitle: event.target.value })} /></label><label className="admin-field span-two">動態內容<textarea rows={3} value={profile.updateText} onChange={(event) => setProfile({ ...profile, updateText: event.target.value })} /></label>
          </div>
        </form>
}

export default HomeProfileSection
