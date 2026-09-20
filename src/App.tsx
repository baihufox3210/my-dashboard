import './App.css'
import TopBar from './components/TopBar'
import Footer from './components/Footer'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <DashboardPage />
      <Footer />
    </div>
  )
}

export default App