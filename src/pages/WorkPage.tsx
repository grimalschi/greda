import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading, ProgressBar } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchManifest, fetchWork } from '../lib/content'
import { useAppState } from '../state/store'
import { LEVELS, LEVEL_ORDER, LEVEL_LABELS } from '../types'
import type { Level } from '../types'
import type { ReadingStatus } from '../lib/progress'

const STATUS_LABELS: Record<ReadingStatus, string> = {
  new: 'Новое',
  started: 'Читаю',
  done: 'Прочитано',
}

function StatusControl({ workId }: { workId: string }) {
  const { store, setWorkStatus } = useAppState()
  const override = store.statusOverrides[workId]
  // Авто-определение (для подсветки, когда ручной пометки нет).
  const levels = store.works[workId]
  let auto: ReadingStatus = 'new'
  if (levels) {
    for (const p of Object.values(levels)) {
      if (!p) continue
      if ((p.completedChapterIds?.length ?? 0) > 0 || (p.progressPercent ?? 0) > 0 || p.currentChapterId)
        auto = 'started'
    }
  }
  const effective: ReadingStatus = override ?? auto
  return (
    <section className="block">
      <h2 className="section-title">Статус</h2>
      <div className="filter" role="group" aria-label="Статус книги">
        <button
          className={`chip-btn chip-btn--sm ${!override ? 'chip-btn--active' : ''}`}
          onClick={() => setWorkStatus(workId, null)}
          title="Определять автоматически по прогрессу"
        >
          Авто{!override ? ` · ${STATUS_LABELS[auto]}` : ''}
        </button>
        {(['new', 'started', 'done'] as ReadingStatus[]).map((st) => (
          <button
            key={st}
            className={`chip-btn chip-btn--sm ${override === st ? 'chip-btn--active' : ''}`}
            onClick={() => setWorkStatus(workId, st)}
          >
            {STATUS_LABELS[st]}
          </button>
        ))}
      </div>
      <div className="muted" style={{ marginTop: '0.4em', fontSize: '0.85em' }}>
        Сейчас: {STATUS_LABELS[effective]}
        {override ? ' (вручную)' : ' (авто)'}
      </div>
    </section>
  )
}

// Текст идёт сплошной (одна «глава» под капотом). Показываем одну кнопку «Читать/Продолжить».
function ReadPanel({ workId, level }: { workId: string; level: Level }) {
  const { data: manifest, error, loading } = useAsync(
    () => fetchManifest(workId, level),
    [workId, level],
  )
  const { getChapterProgress } = useAppState()
  const progress = getChapterProgress(workId, level)
  const first = manifest?.chapters[0]
  const percent = Math.round(progress?.progressPercent ?? 0)
  const started = !!first && progress?.currentChapterId === first.id && percent > 0 && percent < 100

  return (
    <section className="block">
      {loading ? <Loading /> : null}
      {error ? <ErrorView error={error} /> : null}
      {first ? (
        <>
          <Link className="read-cta" to={`/read/${workId}/${level}/${first.id}`}>
            {started ? `Продолжить · ${percent}%` : 'Читать'}
          </Link>
          {started ? <ProgressBar percent={percent} /> : null}
        </>
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

            <StatusControl workId={work.id} />

            {level ? (
              <ReadPanel workId={work.id} level={level} />
            ) : (
              <div className="state">Для этого произведения пока нет готовых уровней.</div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
