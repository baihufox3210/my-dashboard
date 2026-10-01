import type { HomeProfile } from '../features/blog/article'

function SocialLinks({ socials }: { socials: HomeProfile['socials'] }) {
  return <nav className="home-socials" aria-label="社群連結">
    {socials.map((social) => <a key={social.name} href={social.url} target="_blank" rel="noreferrer" aria-label={social.name} title={social.name}>
      {social.name === 'Instagram' ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle className="social-icon-dot" cx="17.65" cy="6.55" r="1"/></svg> : social.name === 'Discord' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M19.7 5.4a17.7 17.7 0 0 0-4.35-1.35l-.54 1.1a16 16 0 0 0-5.62 0l-.55-1.1A17.8 17.8 0 0 0 4.3 5.4C1.55 9.45.8 13.4 1.18 17.3a17.9 17.9 0 0 0 5.35 2.7l1.15-1.87c-.63-.23-1.23-.52-1.8-.86l.44-.35c3.47 1.6 7.23 1.6 10.66 0l.45.35c-.57.34-1.17.63-1.8.86l1.14 1.87a17.9 17.9 0 0 0 5.36-2.7c.45-4.53-.77-8.45-3.43-11.9ZM8.8 14.95c-1.04 0-1.9-.96-1.9-2.13s.84-2.14 1.9-2.14 1.91.97 1.9 2.14c0 1.17-.84 2.13-1.9 2.13Zm6.4 0c-1.05 0-1.9-.96-1.9-2.13s.84-2.14 1.9-2.14 1.9.97 1.9 2.14c0 1.17-.83 2.13-1.9 2.13Z"/></svg> : social.name === 'GitHub' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.31-3.76-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3.01 0 4.27-2.6 5.21-5.08 5.49.4.35.76 1.02.76 2.06v3.07c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg> : <span>{social.name.slice(0, 2).toUpperCase()}</span>}
      <span className="social-link-name">{social.name}</span>
    </a>)}
  </nav>
}

export default SocialLinks
