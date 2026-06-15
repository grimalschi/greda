import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { AppStateProvider } from './state/store'
import './styles.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Не найден #root')

createRoot(rootEl).render(
  <StrictMode>
    {/* HashRouter — чтобы прямые ссылки/обновление работали на GitHub Pages без SPA-fallback. */}
    <HashRouter>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </HashRouter>
  </StrictMode>,
)
