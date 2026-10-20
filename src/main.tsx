import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './styles/live.css'
import './styles/controls.css'
import './styles/dashboard.css'
import './styles/air-quality.css'
import './styles/maps.css'
import './styles/locations.css'
import './styles/refinement.css'
import { ToastProvider } from './components/shared/Feedback'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><ToastProvider><App /></ToastProvider></ErrorBoundary>
  </StrictMode>,
)
