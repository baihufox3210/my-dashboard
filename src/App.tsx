import './App.css'
import SiteLayout from './layouts/SiteLayout'
import PageRouter from './routes/PageRouter'

function App() {
  return (
    <SiteLayout>
      <PageRouter />
    </SiteLayout>
  )
}

export default App