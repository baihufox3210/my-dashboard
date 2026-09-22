import { useEffect } from 'react'
import './App.css'
import { fetchSiteSettings } from './features/blog/api'
import SiteLayout from './layouts/SiteLayout'
import PageRouter from './routes/PageRouter'

function App() {
  useEffect(() => {
    fetchSiteSettings()
      .then((settings) => {
        if (settings.backgroundUrl) {
          document.body.style.setProperty('--site-background-image', `url('${settings.backgroundUrl}')`)
        }
      })
      .catch(() => undefined)
  }, [])

  return (
    <SiteLayout>
      <PageRouter />
    </SiteLayout>
  )
}

export default App