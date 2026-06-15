import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { WorkCard } from '../components/WorkCard'
import { ErrorView, Loading, ProgressBar } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchCatalog } from '../lib/content'
import { useAppState } from '../state/store'
import { LEVELS, LEVEL_LABELS } from '../types'
import type { CatalogWork, Level } from '../types'

function matches(w: CatalogWork, q: string): boolean {
  if (!q) return true
  const hay = `${w.title} ${w.titleRu} ${w.originalTitle} ${w.authorName} ${w.genres.join(' ')}`.toLowerCase()
  return hay.includes(q)
}

export function HomePage() {
  const { store } = useAppState()
  const { data: catalog, error, loading } = useAsync(fetchCatalog, [])
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string>('all')
  const [level, setLevel] = useState<Level | 'all'>('all')

  const cont = store.lastOpened
  const contWork = cont ? catalog?.works.find((w) => w.id === cont.workId) : undefined
  const contProgress = cont ? store.works[cont.workId]?.[cont.level] : undefined

  // Набор «широких» жанров (первый тег каждого произведения) для чипов фильтра.
  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const w of catalog?.works ?? []) if (w.genres[0]) set.add(w.genres[0])
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [catalog])

  const q = query.trim().toLowerCase()
  const works = (catalog?.works ?? []).filter(
    (w) =>
      matches(w, q) &&
      (genre === 'all' || w.genres.includes(genre)) &&
      (level === 'all' || w.availableLevels.includes(level)),
  )

  return (
    <div className="page">
      <TopBar title="Greda" subtitle="Чтение на испанском" showSettings />
      <main className="container">
        {loading ? <Loading /> : null}
        {error ? <ErrorView error={error} /> : null}

        {cont && contWork ? (
          <section className="block">
            <h2 className="section-title">Продолжить чтение</h2>
            <Link className="continue" to={`/read/${cont.workId}/${cont.level}/${cont.chapterId}`}>
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
            <div className="section-row">
              <h2 className="section-title">Произведения</h2>
              <span className="muted">{works.length} из {catalog.works.length}</span>
            </div>

            <input
              className="search"
              type="search"
              inputMode="search"
              placeholder="Поиск по названию или автору…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск произведений"
            />

            {genres.length > 1 ? (
              <div className="filter" role="group" aria-label="Фильтр по жанру">
                <button
                  className={`chip-btn ${genre === 'all' ? 'chip-btn--active' : ''}`}
                  onClick={() => setGenre('all')}
                >
                  Все жанры
                </button>
                {genres.map((g) => (
                  <button
                    key={g}
                    className={`chip-btn ${genre === g ? 'chip-btn--active' : ''}`}
                    onClick={() => setGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="filter filter--levels" role="group" aria-label="Фильтр по уровню">
              <button
                className={`chip-btn chip-btn--sm ${level === 'all' ? 'chip-btn--active' : ''}`}
                onClick={() => setLevel('all')}
              >
                Все уровни
              </button>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  className={`chip-btn chip-btn--sm ${level === l ? 'chip-btn--active' : ''}`}
                  onClick={() => setLevel(l)}
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
              <div className="state">Ничего не найдено. Измените запрос или фильтры.</div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
