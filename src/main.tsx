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

// Автообновление PWA: SPA сама не перезагружается, поэтому свежий код после деплоя
// мог не подхватываться (виделась закэшированная версия). Раз в минуту проверяем
// обновление Service Worker, а когда новый SW берёт управление — перезагружаем
// страницу. Самую первую установку SW пропускаем, чтобы не дёргать новых пользователей.
if ('serviceWorker' in navigator) {
  const wasControlled = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !wasControlled) return
    reloading = true
    window.location.reload()
  })
  navigator.serviceWorker.ready
    .then((reg) => {
      setInterval(() => {
        reg.update().catch(() => {})
      }, 60_000)
    })
    .catch(() => {})
}
