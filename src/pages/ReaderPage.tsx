import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchChapter, fetchManifest, fetchWork } from '../lib/content'
import { useAppState, useThrottledCallback } from '../state/store'
import { LEVEL_LABELS } from '../types'
import type { Level, LevelManifest } from '../types'

interface Sentence {
  id: string
  text: string
  translationRu: string
}

function isLevel(value: string): value is Level {
  return value in LEVEL_LABELS
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

  const { store, recordOpen, updatePosition, markChapterCompleted, getChapterProgress, setWorkStatus } =
    useAppState()
  const translationMode = store.settings.translationMode

  const { data: chapter, error, loading } = useAsync(
    () => fetchChapter(workId, level, chapterId),
    [workId, level, chapterId],
  )
  const { data: work } = useAsync(() => fetchWork(workId), [workId])
  const { data: manifest } = useAsync(() => fetchManifest(workId, level), [workId, level])

  // Inline-режим: множество раскрытых переводов. Drawer-режим: одно активное предложение.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [drawerSent, setDrawerSent] = useState<Sentence | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const pendingSentenceRef = useRef<string | null>(null)
  const restoredRef = useRef(false)

  // Плоский список id предложений главы + индекс id→позиция — основа прогресса.
  const sentenceIds = useMemo(() => {
    const ids: string[] = []
    if (chapter) for (const p of chapter.paragraphs) for (const s of p.sentences) ids.push(s.id)
    return ids
  }, [chapter])
  const indexOf = useMemo(() => {
    const m = new Map<string, number>()
    sentenceIds.forEach((id, i) => m.set(id, i))
    return m
  }, [sentenceIds])

  // Открытие главы: запоминаем предложение, к которому надо вернуться.
  useEffect(() => {
    const prog = storeRef.current.works[workId]?.[level]
    pendingSentenceRef.current =
      prog?.currentChapterId === chapterId ? prog?.lastSentenceId ?? null : null
    restoredRef.current = false
    setOpen(new Set())
    setDrawerSent(null)
    recordOpen(workId, level, chapterId)
  }, [workId, level, chapterId, recordOpen])

  // Прогресс считаем по предложению, которое сейчас вверху экрана (а не по высоте
  // прокрутки — та «врёт» на длинных главах до завершения вёрстки). «Прочитано» —
  // только при реальном докручивании до конца главы.
  const persist = useCallback(() => {
    const el = document.scrollingElement ?? document.documentElement
    const scrollable = el.scrollHeight - el.clientHeight
    const atEnd = scrollable > 40 && el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    const topId = topVisibleSentenceId(containerRef.current)
    const n = sentenceIds.length
    const idx = topId ? indexOf.get(topId) ?? 0 : 0
    const percent = atEnd || n <= 1 ? 100 : Math.round((idx / (n - 1)) * 100)
    updatePosition(workId, level, {
      chapterId,
      lastSentenceId: topId,
      scrollTop: el.scrollTop,
      progressPercent: percent,
    })
    if (atEnd) markChapterCompleted(workId, level, chapterId)
  }, [workId, level, chapterId, sentenceIds.length, indexOf, updatePosition, markChapterCompleted])

  const persistThrottled = useThrottledCallback(persist, 300)

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

  // Восстановление позиции по id предложения после отрисовки + немедленный пересчёт прогресса
  // (чтобы полоса не показывала устаревшее значение, даже если событие scroll не сработает).
  useEffect(() => {
    if (!chapter || restoredRef.current) return
    restoredRef.current = true
    const lastId = pendingSentenceRef.current
    requestAnimationFrame(() => {
      if (lastId) {
        const target = containerRef.current?.querySelector<HTMLElement>(
          `[data-sent-id="${CSS.escape(lastId)}"]`,
        )
        if (target) {
          const y = target.getBoundingClientRect().top + window.scrollY - 80
          window.scrollTo(0, Math.max(0, y))
        } else {
          window.scrollTo(0, 0)
        }
      } else {
        window.scrollTo(0, 0)
      }
      persist()
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

  const onSentence = useCallback(
    (s: Sentence) => {
      if (translationMode === 'drawer') {
        setDrawerSent((prev) => (prev?.id === s.id ? null : s))
      } else {
        toggle(s.id)
      }
    },
    [translationMode, toggle],
  )

  const progress = getChapterProgress(workId, level)
  const percent = Math.round(progress?.progressPercent ?? 0)

  const chapters = manifest?.chapters ?? []
  const isLastChapter = chapters.length > 0 && chapters[chapters.length - 1].id === chapterId
  const bookDone = store.statusOverrides[workId] === 'done'

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
          <article className={`chapter ${translationMode === 'drawer' ? 'chapter--drawer' : ''}`}>
            <h1 className="chapter__title">{chapter.chapter.title}</h1>
            {chapter.paragraphs.map((p) => (
              <p className="para" key={p.id}>
                {p.sentences.map((s) => {
                  const active =
                    translationMode === 'drawer' ? drawerSent?.id === s.id : open.has(s.id)
                  return (
                    <Fragment key={s.id}>
                      <span
                        className={`sent ${active ? 'sent--active' : ''}`}
                        data-sent-id={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSentence(s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSentence(s)
                          }
                        }}
                      >
                        {s.text}
                      </span>{' '}
                      {translationMode === 'inline' && open.has(s.id) ? (
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
                  )
                })}
              </p>
            ))}

            {isLastChapter ? (
              <div className="reader__finish">
                {bookDone ? (
                  <button
                    type="button"
                    className="btn-finish btn-finish--done"
                    onClick={() => setWorkStatus(workId, null)}
                  >
                    ✓ Книга прочитана — снять отметку
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-finish"
                    onClick={() => setWorkStatus(workId, 'done')}
                  >
                    Пометить книгу прочитанной
                  </button>
                )}
              </div>
            ) : null}

            <ChapterNav
              manifest={manifest}
              workId={workId}
              level={level}
              chapterId={chapterId}
            />
          </article>
        ) : null}
      </main>

      {translationMode === 'drawer' && drawerSent ? (
        <div className="tdrawer" role="dialog" aria-label="Перевод">
          <button
            type="button"
            className="tdrawer__close"
            aria-label="Закрыть перевод"
            onClick={() => setDrawerSent(null)}
          >
            ×
          </button>
          <div className="tdrawer__es">{drawerSent.text}</div>
          <div className="tdrawer__ru">{drawerSent.translationRu}</div>
        </div>
      ) : null}
    </div>
  )
}
