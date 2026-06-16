import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchManifest, fetchWork } from '../lib/content'
import { useAppState } from '../state/store'
import { LEVELS, LEVEL_ORDER, LEVEL_LABELS } from '../types'
import type { Level } from '../types'

function ChapterList({ workId, level }: { workId: string; level: Level }) {
  const { data: manifest, error, loading } = useAsync(
    () => fetchManifest(workId, level),
    [workId, level],
  )
  const { getChapterProgress } = useAppState()
  const progress = getChapterProgress(workId, level)

  return (
    <section className="block">
      <h2 className="section-title">Главы</h2>
      {loading ? <Loading /> : null}
      {error ? <ErrorView error={error} /> : null}
      {manifest ? (
        <ul className="chapter-list">
          {manifest.chapters.map((ch) => {
            const done = progress?.completedChapterIds.includes(ch.id)
            const current = progress?.currentChapterId === ch.id && !done
            return (
              <li key={ch.id}>
                <Link className="chapter-row" to={`/read/${workId}/${level}/${ch.id}`}>
                  <span className="chapter-row__num">{ch.number}</span>
                  <span className="chapter-row__title">{ch.title}</span>
                  <span
                    className={`chapter-row__status ${done ? 'is-done' : current ? 'is-current' : ''}`}
                    aria-hidden="true"
                  >
                    {done ? '✓' : current ? '•' : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

export function WorkPage() {
  const { workId = '' } = useParams()
  const { data: work, error, loading } = useAsync(() => fetchWork(workId), [workId])
  const [level, setLevel] = useState<Level | null>(null)

  useEffect(() => {
    if (!work) return
    const available = LEVELS.filter((l) => work.levels[l]?.available)
    setLevel((prev) =>
      prev && work.levels[prev]?.available ? prev : available[0] ?? null,
    )
  }, [work])

  return (
    <div className="page">
      <TopBar title={work?.title ?? 'Произведение'} back showSettings />
      <main className="container">
        {loading ? <Loading /> : null}
        {error ? <ErrorView error={error} /> : null}

        {work ? (
          <>
            <header className="work-head">
              <h1 className="work-head__title">{work.title}</h1>
              <div className="work-head__ru">{work.titleRu}</div>
              <div className="work-head__author">{work.author.name}</div>
              {work.genres.length > 0 ? (
                <div className="work-head__genres">
                  {work.genres.map((g) => (
                    <span key={g} className="chip">
                      {g}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <section className="block">
              <h2 className="section-title">Уровень</h2>
              <div className="filter" role="group" aria-label="Выбор уровня">
                {LEVEL_ORDER.filter((l) => LEVELS.includes(l) || work.levels[l]?.available).map((l) => {
                  const available = work.levels[l]?.available
                  return (
                    <button
                      key={l}
                      disabled={!available}
                      className={`chip-btn ${level === l ? 'chip-btn--active' : ''} ${
                        available ? '' : 'chip-btn--off'
                      }`}
                      onClick={() => available && setLevel(l)}
                    >
                      {LEVEL_LABELS[l]}
                      {available ? '' : ' · скоро'}
                    </button>
                  )
                })}
              </div>
            </section>

            {level ? (
              <ChapterList workId={work.id} level={level} />
            ) : (
              <div className="state">Для этого произведения пока нет готовых уровней.</div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
