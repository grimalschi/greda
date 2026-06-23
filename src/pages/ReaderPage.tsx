import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchChapter, fetchWork } from '../lib/content'
import { useAppState, useThrottledCallback } from '../state/store'
import { LEVEL_LABELS } from '../types'
import type { Level, Sentence } from '../types'

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

  // Inline-режим: множество раскрытых переводов. Drawer-режим: одно активное предложение.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [drawerSent, setDrawerSent] = useState<Sentence | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const pendingSentenceRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const lastPosRef = useRef<{ id: string; percent: number } | null>(null)

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

  // Открытие: запоминаем предложение, к которому надо вернуться.
  useEffect(() => {
    const prog = storeRef.current.works[workId]?.[level]
    pendingSentenceRef.current =
      prog?.currentChapterId === chapterId ? prog?.lastSentenceId ?? null : null
    restoredRef.current = false
    lastPosRef.current = null
    setOpen(new Set())
    setDrawerSent(null)
    recordOpen(workId, level, chapterId)
  }, [workId, level, chapterId, recordOpen])

  // Прогресс — по предложению вверху экрана (надёжно на длинных текстах). «Прочитано» —
  // только при докручивании до конца. ВАЖНО: если контейнер уже размонтирован (кнопка
  // «назад»), topVisibleSentenceId == null — НЕ затираем сохранённую позицию.
  const persist = useCallback(() => {
    const topId = topVisibleSentenceId(containerRef.current)
    if (!topId) return
    const el = document.scrollingElement ?? document.documentElement
    const scrollable = el.scrollHeight - el.clientHeight
    const atEnd = scrollable > 40 && el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    const n = sentenceIds.length
    const idx = indexOf.get(topId) ?? 0
    const percent = atEnd || n <= 1 ? 100 : Math.round((idx / (n - 1)) * 100)
    lastPosRef.current = { id: topId, percent }
    updatePosition(workId, level, {
      chapterId,
      lastSentenceId: topId,
      scrollTop: el.scrollTop,
      progressPercent: percent,
    })
    if (atEnd) markChapterCompleted(workId, level, chapterId)
  }, [workId, level, chapterId, sentenceIds.length, indexOf, updatePosition, markChapterCompleted])

  const persistThrottled = useThrottledCallback(persist, 300)

  // Слушаем скролл документа; при уходе сохраняем последнюю известную позицию.
  useEffect(() => {
    const handler = () => persistThrottled()
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('scroll', handler)
      if (topVisibleSentenceId(containerRef.current)) {
        persist()
      } else if (lastPosRef.current) {
        // контейнер уже размонтирован — пишем последнюю запомненную позицию
        updatePosition(workId, level, {
          chapterId,
          lastSentenceId: lastPosRef.current.id,
          scrollTop: 0,
          progressPercent: lastPosRef.current.percent,
        })
      }
    }
  }, [persistThrottled, persist, workId, level, chapterId, updatePosition])

  // Восстановление позиции по id предложения + немедленный пересчёт прогресса.
  useEffect(() => {
    if (!chapter || restoredRef.current) return
    restoredRef.current = true
    const lastId = pendingSentenceRef.current
    requestAnimationFrame(() => {
      const target = lastId
        ? containerRef.current?.querySelector<HTMLElement>(`[data-sent-id="${CSS.escape(lastId)}"]`)
        : null
      if (target) {
        const y = target.getBoundingClientRect().top + window.scrollY - 80
        window.scrollTo(0, Math.max(0, y))
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
      if (translationMode === 'drawer') setDrawerSent((prev) => (prev?.id === s.id ? null : s))
      else toggle(s.id)
    },
    [translationMode, toggle],
  )

  const progress = getChapterProgress(workId, level)
  const percent = Math.round(progress?.progressPercent ?? 0)
  const bookDone = store.statusOverrides[workId] === 'done'

  const renderSent = useCallback(
    (s: Sentence) => {
      const active = translationMode === 'drawer' ? drawerSent?.id === s.id : open.has(s.id)
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
    },
    [translationMode, drawerSent, open, onSentence, toggle],
  )

  return (
    <div className="page reader">
      <TopBar title={work?.title ?? 'Чтение'} subtitle={LEVEL_LABELS[level]} back />
      <div className="reader__progress" aria-hidden="true">
        <div className="reader__progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <main className="container reader__body" ref={containerRef}>
        {loading ? <Loading label="Загрузка…" /> : null}
        {error ? <ErrorView error={error} /> : null}

        {chapter ? (
          <article className={`chapter ${translationMode === 'drawer' ? 'chapter--drawer' : ''}`}>
            {chapter.paragraphs.map((p) => {
              const head = p.sentences.length === 1 && p.sentences[0].heading ? p.sentences[0] : null
              if (head) {
                return (
                  <h3 className="sent-heading" key={p.id}>
                    {renderSent(head)}
                  </h3>
                )
              }
              return (
                <p className="para" key={p.id}>
                  {p.sentences.map(renderSent)}
                </p>
              )
            })}

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
          <div className="tdrawer__ru">{drawerSent.translationRu}</div>
        </div>
      ) : null}
    </div>
  )
}
