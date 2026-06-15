import { Link, useNavigate } from 'react-router-dom'

interface TopBarProps {
  title: string
  subtitle?: string
  /** Показать кнопку «назад» (history.back). */
  back?: boolean
  /** Явный адрес для «назад» (приоритетнее history.back). */
  backTo?: string
  showSettings?: boolean
}

export function TopBar({ title, subtitle, back, backTo, showSettings }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      <div className="topbar__slot">
        {backTo ? (
          <Link className="topbar__btn" to={backTo} aria-label="Назад">
            ‹
          </Link>
        ) : back ? (
          <button className="topbar__btn" onClick={() => navigate(-1)} aria-label="Назад">
            ‹
          </button>
        ) : null}
      </div>

      <div className="topbar__titles">
        <div className="topbar__title" title={title}>
          {title}
        </div>
        {subtitle ? <div className="topbar__subtitle">{subtitle}</div> : null}
      </div>

      <div className="topbar__slot topbar__slot--right">
        {showSettings ? (
          <Link className="topbar__btn" to="/settings" aria-label="Настройки">
            ⚙
          </Link>
        ) : null}
      </div>
    </header>
  )
}
