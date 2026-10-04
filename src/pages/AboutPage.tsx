import { useEffect, useState } from 'react'
import MarkdownPreview from '../components/MarkdownPreview'
import SocialLinks from '../components/SocialLinks'
import { fetchHomeProfile, fetchSiteSettings } from '../features/blog/api'
import type { HomeProfile, SiteSettings } from '../features/blog/article'

const emptyProfile: HomeProfile = {
  name: '', introduction: '', quote: '', socials: [], tags: [], avatarMessages: [], updateTitle: '', updateText: '',
}
const emptySettings: SiteSettings = { siteName: '', biography: '', experience: '' }

function AboutPage() {
  const [profile, setProfile] = useState(emptyProfile)
  const [settings, setSettings] = useState(emptySettings)
  const [avatarMessage, setAvatarMessage] = useState('')

  useEffect(() => {
    Promise.all([fetchHomeProfile(), fetchSiteSettings()]).then(([loadedProfile, loadedSettings]) => {
      setProfile(loadedProfile)
      setSettings(loadedSettings)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!avatarMessage) return
    const timer = window.setTimeout(() => setAvatarMessage(''), 3200)
    return () => window.clearTimeout(timer)
  }, [avatarMessage])

  function showAvatarMessage() {
    const messages = profile.avatarMessages.filter(Boolean)
    setAvatarMessage(messages.length ? messages[Math.floor(Math.random() * messages.length)] ?? '' : '(๑•̀ㅂ•́)و✧')
  }

  return <main className="main-page about-page">
    <div className="about-profile-column">
    <section className="about-profile home-profile home-panel">
      <div className="about-avatar-stage home-avatar-stage">
        <button type="button" className="home-avatar-wrap" onClick={showAvatarMessage} aria-label="點擊頭像看一句小語" aria-expanded={Boolean(avatarMessage)}>
          {profile.avatarUrl ? <img className="home-avatar" src={profile.avatarUrl} alt={`${profile.name} 頭像`} /> : <span className="home-avatar home-avatar-placeholder" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>}
        </button>
        {avatarMessage && <span className="home-avatar-message" role="status">{avatarMessage}</span>}
      </div>
      <p className="home-eyebrow">ABOUT ME</p>
      <h1>{profile.name}</h1>
      {profile.quote && <blockquote>{profile.quote}</blockquote>}
    </section>
    <section className="home-tags-card home-panel" aria-label="興趣標籤"><p className="home-eyebrow">INTERESTS</p><div className="home-tags">{profile.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
    <section className="home-contact-card home-panel" aria-label="聯絡方式"><SocialLinks socials={profile.socials} /></section>
    </div>

    <article className="about-biography home-panel">
      <header className="about-section-heading"><div><p className="home-eyebrow">MY STORY</p><h2>關於我</h2></div><span className="about-section-mark" aria-hidden="true">✳</span></header>
      {settings.biography.trim() ? <MarkdownPreview content={settings.biography} /> : <p className="about-empty">還沒有填寫自我介紹。</p>}
    </article>

    <aside className="about-aside">
      <section className="about-intro-card home-panel"><p className="home-eyebrow">A LITTLE ABOUT ME</p><p>{profile.introduction || '還沒有填寫個人簡介。'}</p></section>
      <section className="about-experience-card home-panel"><p className="home-eyebrow">EXPERIENCE</p>{settings.experience.trim() ? <MarkdownPreview content={settings.experience} /> : <p className="about-empty">還沒有新增經歷。</p>}</section>
    </aside>
  </main>
}

export default AboutPage
