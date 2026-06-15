export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorView({ error }: { error: Error }) {
  return (
    <div className="state state--error" role="alert">
      Не удалось загрузить данные.
      <span className="state__detail">{error.message}</span>
    </div>
  )
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="progress" aria-label={`Прогресс ${p}%`}>
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${p}%` }} />
      </div>
      <span className="progress__label">{p}%</span>
    </div>
  )
}
