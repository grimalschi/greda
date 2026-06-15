import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { WorkCard } from '../components/WorkCard'
import { ErrorView, Loading, ProgressBar } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchCatalog } from '../lib/content'
import { useAppState } from '../state/store'
import { LEVELS, LEVEL_LABELS } from '../types'
import type { Level } from '../types'

export function HomePage() {
  const { store } = useAppState()
  const { data: catalog, error, loading } = useAsync(fetchCatalog, [])
  const [filter, setFilter] = useState<Level | 'all'>('all')

  const cont = store.lastOpened
  const contWork = cont ? catalog?.works.find((w) => w.id === cont.workId) : undefined
  const contProgress = cont ? store.works[cont.workId]?.[cont.level] : undefined

  const works =
    catalog?.works.filter((w) =>
      filter === 'all' ? true : w.availableLevels.includes(filter),
    ) ?? []

  return (
    <div className="page">
      <TopBar title="Greda" subtitle="Чтение на испанском" showSettings />
      <main className="container">
        {loading ? <Loading /> : null}
        {error ? <ErrorView error={error} /> : null}

        {cont && contWork ? (
          <section className="block">
            <h2 className="section-title">Продолжить чтение</h2>
            <Link
              className="continue"
              to={`/read/${cont.workId}/${cont.level}/${cont.chapterId}`}
            >
              <div className="continue__title">{contWork.title}</div>
              <div className="continue__meta">
                {LEVEL_LABELS[cont.level]} · {contWork.titleRu}
              </div>
              <ProgressBar percent={contProgress?.progressPercent ?? 0} />
            </Link>
          </section>
        ) : null}

        {catalog ? (
          <section className="block">
            <h2 className="section-title">Произведения</h2>
            <div className="filter" role="group" aria-label="Фильтр по уровню">
              <button
                className={`chip-btn ${filter === 'all' ? 'chip-btn--active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Все
              </button>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  className={`chip-btn ${filter === l ? 'chip-btn--active' : ''}`}
                  onClick={() => setFilter(l)}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>

            {works.length > 0 ? (
              <ul className="work-list">
                {works.map((w) => (
                  <li key={w.id}>
                    <WorkCard work={w} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="state">Нет произведений для выбранного уровня.</div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
