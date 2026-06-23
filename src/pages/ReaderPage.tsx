import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchChapter, fetchManifest, fetchWork } from '../lib/content'
import { useAppState, useThrottledCallback } from '../state/store'
import { LEVEL_LABELS } from '../types'
import type { Level, LevelManifest } from '../types'

function isLevel(value: string): value is Level {
  return value in LEVEL_LABELS
}

function scrollMetrics() {
  const el = document.scrollingElement ?? document.documentElement
  const scrollTop = el.scrollTop
  const maxScroll = el.scrollHeight - el.clientHeight
  const percent = maxScroll <= 0 ? 100 : Math.min(100, (scrollTop / maxScroll) * 100)
  return { scrollTop, maxScroll, percent }
}

/** id предложения, верхняя кромка которого ближе всего к верху области чтения. */
function topVisibleSentenceId(container: HTMLElement | null): string | null {
  if (!container) return null
  const spans = container.querySelectorAll<HTMLElement>('[data-sent-id]')
  for (const span of Array.from(spans)) {
    if (span.getBoundingClientRect().bottom > 96) {
      return span.dataset.sentId ?? null
    }
  }
  return null
}

function ChapterNav({
  manifest,
  workId,
  level,
  chapterId,
}: {
  manifest: LevelManifest | null
  workId: string
  level: Level
  chapterId: string
}) {
  const navigate = useNavigate()
  if (!manifest) return null
  const idx = manifest.chapters.findIndex((c) => c.id === chapterId)
  const prev = idx > 0 ? manifest.chapters[idx - 1] : null
  const next = idx >= 0 && idx < manifest.chapters.length - 1 ? manifest.chapters[idx + 1] : null

  // Листание глав заменяет запись в истории (replace), чтобы кнопка «назад»
  // всегда возвращала к списку глав, а не к предыдущей главе.
  return (
    <nav className="chapter-nav">
      {prev ? (
        <Link replace className="chapter-nav__btn" to={`/read/${workId}/${level}/${prev.id}`}>
          ‹ {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          replace
          className="chapter-nav__btn chapter-nav__btn--next"
          to={`/read/${workId}/${level}/${next.id}`}
        >
          {next.title} ›
        </Link>
      ) : (
        <button
          type="button"
          className="chapter-nav__btn chapter-nav__btn--next"
          onClick={() => navigate(-1)}
        >
          К списку глав ›
        </button>
      )}
    </nav>
  )
}

export function ReaderPage() {
  const params = useParams()
  const workId = params.workId ?? ''
  const level: Level = params.level && isLevel(params.level) ? params.level : 'b1'
  const chapterId = params.chapterId ?? ''

  const { store, recordOpen, updatePosition, markChapterCompleted, getChapterProgress } =
    useAppState()

  const { data: chapter, error, loading } = useAsync(
    () => fetchChapter(workId, level, chapterId),
    [workId, level, chapterId],
  )
  const { data: work } = useAsync(() => fetchWork(workId), [workId])
  const { data: manifest } = useAsync(() => fetchManifest(workId, level), [workId, level])

  const [open, setOpen] = useState<Set<string>>(() => new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const pendingScrollRef = useRef(0)
  const restoredRef = useRef(false)

  // Открытие главы: фиксируем позицию для восстановления ДО перезаписи, отмечаем последнюю позицию.
  useEffect(() => {
    const last = storeRef.current.lastOpened
    pendingScrollRef.current =
      last && last.workId === workId && last.level === level && last.chapterId === chapterId
        ? last.scrollTop
        : 0
    restoredRef.current = false
    setOpen(new Set())
    recordOpen(workId, level, chapterId)
  }, [workId, level, chapterId, recordOpen])

  const persist = useCallback(() => {
    const { scrollTop, maxScroll, percent } = scrollMetrics()
    updatePosition(workId, level, {
      chapterId,
      lastSentenceId: topVisibleSentenceId(containerRef.current),
      scrollTop,
      progressPercent: percent,
    })
    if (percent >= 98 || maxScroll <= 4) {
      markChapterCompleted(workId, level, chapterId)
    }
  }, [workId, level, chapterId, updatePosition, markChapterCompleted])

  const persistThrottled = useThrottledCallback(persist, 400)

  // Слушаем скролл документа.
  useEffect(() => {
    const handler = () => persistThrottled()
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('scroll', handler)
      // Финальное сохранение при уходе со страницы.
      persist()
    }
  }, [persistThrottled, persist])

  // Восстановление позиции после отрисовки главы.
  useEffect(() => {
    if (!chapter || restoredRef.current) return
    restoredRef.current = true
    const target = pendingScrollRef.current
    requestAnimationFrame(() => {
      window.scrollTo(0, target)
      // Короткая глава целиком на экране — считаем прочитанной и фиксируем 100%.
      const { maxScroll } = scrollMetrics()
      if (maxScroll <= 4) persist()
    })
  }, [chapter, persist])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const progress = getChapterProgress(workId, level)
  const percent = Math.round(progress?.progressPercent ?? 0)

  return (
    <div className="page reader">
      <TopBar
        title={work?.title ?? 'Чтение'}
        subtitle={chapter ? `${LEVEL_LABELS[level]} · ${chapter.chapter.title}` : LEVEL_LABELS[level]}
        back
      />
      <div className="reader__progress" aria-hidden="true">
        <div className="reader__progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <main className="container reader__body" ref={containerRef}>
        {loading ? <Loading label="Загрузка главы…" /> : null}
        {error ? <ErrorView error={error} /> : null}

        {chapter ? (
          <article className="chapter">
            <h1 className="chapter__title">{chapter.chapter.title}</h1>
            {chapter.paragraphs.map((p) => (
              <p className="para" key={p.id}>
                {p.sentences.map((s) => (
                  <Fragment key={s.id}>
                    <span
                      className={`sent ${open.has(s.id) ? 'sent--active' : ''}`}
                      data-sent-id={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggle(s.id)
                        }
                      }}
                    >
                      {s.text}
                    </span>{' '}
                    {open.has(s.id) ? (
                      <span
                        className="translation"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggle(s.id)
                          }
                        }}
                      >
                        {s.translationRu}
                      </span>
                    ) : null}
                  </Fragment>
                ))}
              </p>
            ))}

            <ChapterNav
              manifest={manifest}
              workId={workId}
              level={level}
              chapterId={chapterId}
            />
          </article>
        ) : null}
      </main>
    </div>
  )
}
