import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { WorkCard } from '../components/WorkCard'
import { ErrorView, Loading, ProgressBar } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchCatalog } from '../lib/content'
import { downloadAllForOffline, getCachedWorkIds, offlineSupported } from '../lib/offline'
import { useAppState } from '../state/store'
import { workReadingStatus } from '../lib/progress'
import type { ReadingStatus } from '../lib/progress'
import { LEVELS, LEVEL_ORDER, LEVEL_LABELS, LANGUAGES, LANGUAGE_LABELS, LANGUAGE_LABELS_PREP } from '../types'
import type { CatalogWork, Level, Language } from '../types'

const workLang = (w: CatalogWork): Language => w.lang ?? 'es'

function matches(w: CatalogWork, q: string): boolean {
  if (!q) return true
  const hay = `${w.title} ${w.titleRu} ${w.originalTitle} ${w.authorName} ${w.genres.join(' ')}`.toLowerCase()
  return hay.includes(q)
}

type Sort = 'default' | 'wordsAsc' | 'wordsDesc'

const STATUS_FILTERS: { value: ReadingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'started', label: 'Читаю' },
  { value: 'done', label: 'Прочитано' },
]

export function HomePage() {
  const { store } = useAppState()
  const { data: catalog, error, loading } = useAsync(fetchCatalog, [])
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string>('all')
  const [level, setLevel] = useState<Level | 'all'>('all')
  const [lang, setLang] = useState<Language | 'all'>('all')
  const [status, setStatus] = useState<ReadingStatus | 'all'>('all')
  // По умолчанию показываем сначала короткие рассказы (по числу слов, по возрастанию).
  const [sort, setSort] = useState<Sort>('wordsAsc')
  // Офлайн: какие работы уже в кэше + прогресс «Скачать всё».
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set())
  const [cacheReady, setCacheReady] = useState(false)
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null)

  const cont = store.lastOpened
  const contWork = cont ? catalog?.works.find((w) => w.id === cont.workId) : undefined
  const contProgress = cont ? store.works[cont.workId]?.[cont.level] : undefined

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const w of catalog?.works ?? []) if (w.genres[0]) set.add(w.genres[0])
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [catalog])

  // Базовые 6 уровней + любые доп. уровни (напр. b1v2), реально присутствующие в каталоге.
  const filterLevels = useMemo(() => {
    const present = new Set<Level>()
    for (const w of catalog?.works ?? []) for (const l of w.availableLevels) present.add(l)
    return LEVEL_ORDER.filter((l) => LEVELS.includes(l) || present.has(l))
  }, [catalog])

  // Языки, реально присутствующие в каталоге (для фильтра по языку и подзаголовка).
  const presentLangs = useMemo(() => {
    const present = new Set<Language>()
    for (const w of catalog?.works ?? []) present.add(workLang(w))
    return LANGUAGES.filter((l) => present.has(l))
  }, [catalog])

  // Сводка прогресса по всей библиотеке.
  const stats = useMemo(() => {
    const s = { done: 0, started: 0, new: 0 }
    for (const w of catalog?.works ?? []) s[workReadingStatus(store, w)]++
    return s
  }, [catalog, store])

  // Узнаём, что уже сохранено офлайн (для пометок на карточках и счётчика).
  useEffect(() => {
    if (!catalog || !offlineSupported()) return
    let cancelled = false
    getCachedWorkIds(catalog.works).then((ids) => {
      if (!cancelled) {
        setCachedIds(ids)
        setCacheReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [catalog])

  const downloadAll = useCallback(async () => {
    if (!catalog || dl) return
    setDl({ done: 0, total: catalog.works.length })
    await downloadAllForOffline(catalog.works, (done, total) => setDl({ done, total }))
    const ids = await getCachedWorkIds(catalog.works)
    setCachedIds(ids)
    setCacheReady(true)
    setDl(null)
  }, [catalog, dl])

  const q = query.trim().toLowerCase()
  const refLevel: Level = level !== 'all' ? level : 'b1'
  const refWords = (w: CatalogWork) =>
    w.words?.[refLevel] ?? w.words?.b1 ?? Object.values(w.words ?? {})[0] ?? 0

  let works = (catalog?.works ?? []).filter(
    (w) =>
      matches(w, q) &&
      (lang === 'all' || workLang(w) === lang) &&
      (genre === 'all' || w.genres.includes(genre)) &&
      (level === 'all' || w.availableLevels.includes(level)) &&
      (status === 'all' || workReadingStatus(store, w) === status),
  )
  if (sort === 'wordsAsc') works = [...works].sort((a, b) => refWords(a) - refWords(b))
  else if (sort === 'wordsDesc') works = [...works].sort((a, b) => refWords(b) - refWords(a))

  return (
    <div className="page">
      <TopBar
        title="Библиотека"
        subtitle={
          presentLangs.length
            ? `Чтение на ${presentLangs.map((l) => LANGUAGE_LABELS_PREP[l]).join(' и ')}`
            : 'Чтение на испанском'
        }
        backTo="/"
        showSettings
      />
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
              <span className="muted">
                {works.length} из {catalog.works.length}
              </span>
            </div>
            <div className="muted lib-stats">
              Прочитано {stats.done} · читаю {stats.started} · впереди {stats.new}
            </div>

            {offlineSupported() ? (
              <div className="offline-bar">
                <span className="muted">
                  Офлайн: {cachedIds.size}/{catalog.works.length}
                </span>
                {dl ? (
                  <span className="muted">
                    Скачивание… {dl.done}/{dl.total}
                  </span>
                ) : cacheReady && cachedIds.size >= catalog.works.length ? (
                  <span className="muted">всё сохранено ✓</span>
                ) : (
                  <button className="btn btn--sm" onClick={downloadAll}>
                    Скачать всё для офлайна
                  </button>
                )}
              </div>
            ) : null}

            <input
              className="search"
              type="search"
              inputMode="search"
              placeholder="Поиск по названию или автору…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск произведений"
            />

            {presentLangs.length > 1 ? (
              <div className="filter" role="group" aria-label="Фильтр по языку">
                <button
                  className={`chip-btn ${lang === 'all' ? 'chip-btn--active' : ''}`}
                  onClick={() => setLang('all')}
                >
                  Все языки
                </button>
                {presentLangs.map((l) => (
                  <button
                    key={l}
                    className={`chip-btn ${lang === l ? 'chip-btn--active' : ''}`}
                    onClick={() => setLang(l)}
                  >
                    {LANGUAGE_LABELS[l]}
                  </button>
                ))}
              </div>
            ) : null}

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

            <div className="filter" role="group" aria-label="Статус чтения">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.value}
                  className={`chip-btn chip-btn--sm ${status === s.value ? 'chip-btn--active' : ''}`}
                  onClick={() => setStatus(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="filter filter--levels" role="group" aria-label="Уровень и сортировка">
              <button
                className={`chip-btn chip-btn--sm ${level === 'all' ? 'chip-btn--active' : ''}`}
                onClick={() => setLevel('all')}
              >
                Все уровни
              </button>
              {filterLevels.map((l) => (
                <button
                  key={l}
                  className={`chip-btn chip-btn--sm ${level === l ? 'chip-btn--active' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
              <label className="sort">
                <span>Сорт.:</span>
                <select
                  className="sort__select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label="Сортировка"
                >
                  <option value="wordsAsc">сначала короткие</option>
                  <option value="wordsDesc">сначала длинные</option>
                  <option value="default">по автору</option>
                </select>
              </label>
            </div>

            {works.length > 0 ? (
              <ul className="work-list">
                {works.map((w) => (
                  <li key={w.id}>
                    <WorkCard
                      work={w}
                      status={workReadingStatus(store, w)}
                      cached={cacheReady ? cachedIds.has(w.id) : undefined}
                    />
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
