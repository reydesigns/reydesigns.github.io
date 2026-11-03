import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App'

/* Reload always starts at the top. Left to itself the browser restores the old
   offset some time after load — late enough to land mid-page behind the first
   paint and, on `/`, to look like a scroll and fire the hero -> works glide. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
