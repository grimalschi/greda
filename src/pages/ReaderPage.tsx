import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react'
import Markdown from 'react-markdown'
import { TopBar } from '../components/TopBar'
import { ErrorView, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchChapter, fetchWork } from '../lib/content'
import { explainSentenceStream, peekExplanation } from '../lib/explain'
import { useAppState, useThrottledCallback } from '../state/store'
import { LEVEL_LABELS } from '../types'
import type { Level, Sentence } from '../types'
import type { Settings } from '../lib/storage'

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

type ExplainState = { loading: boolean; text: string; error: string }

/** Содержимое панели/поповера: вкладки «Перевод» и «Объяснение» (GPT). */
function PanelContent({
  sentence,
  settings,
  onClose,
}: {
  sentence: Sentence
  settings: Settings
  onClose: () => void
}) {
  const [tab, setTab] = useState<'translation' | 'original' | 'explain'>('translation')
  const [ex, setEx] = useState<ExplainState>({ loading: false, text: '', error: '' })

  const provider = settings.aiProvider
  const apiKey = provider === 'openai' ? settings.openaiApiKey : settings.openrouterApiKey
  const model = provider === 'openai' ? settings.openaiModel : settings.openrouterModel

  useEffect(() => {
    if (tab !== 'explain') return
    const args = { text: sentence.text, prompt: settings.explainPrompt, provider, apiKey, model }
    if (!apiKey.trim()) {
      setEx({ loading: false, text: '', error: 'no-key' })
      return
    }
    const cached = peekExplanation(args)
    if (cached) {
      setEx({ loading: false, text: cached, error: '' })
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    let acc = ''
    setEx({ loading: true, text: '', error: '' })
    explainSentenceStream(
      args,
      (chunk) => {
        if (cancelled) return
        acc += chunk
        setEx({ loading: false, text: acc, error: '' })
      },
      ctrl.signal,
    )
      .then((full) => !cancelled && setEx({ loading: false, text: full, error: '' }))
      .catch((e) => {
        if (cancelled || e?.name === 'AbortError') return
        setEx({ loading: false, text: '', error: String(e?.message ?? e) })
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [tab, sentence.text, provider, apiKey, model, settings.explainPrompt])

  return (
    <>
      <div className="tpanel__tabs" role="tablist">
        <button
          type="button"
          className={`tpanel__tab ${tab === 'translation' ? 'is-active' : ''}`}
          onClick={() => setTab('translation')}
        >
          Перевод
        </button>
        {sentence.original ? (
          <button
            type="button"
            className={`tpanel__tab ${tab === 'original' ? 'is-active' : ''}`}
            onClick={() => setTab('original')}
          >
            Оригинал
          </button>
        ) : null}
        <button
          type="button"
          className={`tpanel__tab ${tab === 'explain' ? 'is-active' : ''}`}
          onClick={() => setTab('explain')}
        >
          Объяснение
        </button>
        <button type="button" className="tpanel__close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="tpanel__body">
        {tab === 'translation' ? (
          <div className="tpanel__ru">{sentence.translationRu}</div>
        ) : tab === 'original' ? (
          <div className="tpanel__og">{sentence.original}</div>
        ) : ex.loading ? (
          <div className="muted">Загружаем…</div>
        ) : ex.error === 'no-key' ? (
          <div className="muted">Укажите ключ ИИ-провайдера в Настройках, чтобы получать объяснения.</div>
        ) : ex.error ? (
          <div className="muted">Ошибка: {ex.error}</div>
        ) : (
          <div className="tpanel__explain">
            <Markdown>{ex.text}</Markdown>
          </div>
        )}
      </div>
    </>
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

  // Inline-режим: множество раскрытых переводов. Drawer/Popover: одно активное предложение.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [panelSent, setPanelSent] = useState<Sentence | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  // Floating UI держит поповер в границах экрана (flip/shift) и задаёт адекватную высоту (size).
  const { refs, floatingStyles } = useFloating({
    open: translationMode === 'popover' && !!panelSent,
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(160, availableHeight)}px`,
            maxWidth: `${Math.min(380, availableWidth)}px`,
          })
        },
      }),
    ],
    elements: { reference: anchorEl },
    whileElementsMounted: autoUpdate,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const pendingSentenceRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const lastPosRef = useRef<{ id: string; percent: number } | null>(null)

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

  useEffect(() => {
    const prog = storeRef.current.works[workId]?.[level]
    pendingSentenceRef.current =
      prog?.currentChapterId === chapterId ? prog?.lastSentenceId ?? null : null
    restoredRef.current = false
    lastPosRef.current = null
    setOpen(new Set())
    setPanelSent(null)
    recordOpen(workId, level, chapterId)
  }, [workId, level, chapterId, recordOpen])

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

  useEffect(() => {
    const handler = () => persistThrottled()
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('scroll', handler)
      if (topVisibleSentenceId(containerRef.current)) {
        persist()
      } else if (lastPosRef.current) {
        updatePosition(workId, level, {
          chapterId,
          lastSentenceId: lastPosRef.current.id,
          scrollTop: 0,
          progressPercent: lastPosRef.current.percent,
        })
      }
    }
  }, [persistThrottled, persist, workId, level, chapterId, updatePosition])

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

  // Закрыть панель и снять фокус с предложения (чтобы не оставалось подсветки/обводки).
  const closePanel = useCallback(() => {
    setPanelSent(null)
    const el = document.activeElement as HTMLElement | null
    if (el && typeof el.blur === 'function') el.blur()
  }, [])

  // Закрытие по Escape. Клик вне поповера ловит прозрачная подложка (.tpop-backdrop),
  // которая закрывает и НЕ даёт клику по другому предложению открыть новый поповер.
  useEffect(() => {
    if (!panelSent) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelSent, closePanel])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onSentence = useCallback(
    (s: Sentence, el: HTMLElement) => {
      if (translationMode === 'inline') {
        toggle(s.id)
        return
      }
      if (translationMode === 'popover') {
        // Открываем только когда закрыто; пока открыто, клики перехватывает подложка.
        setAnchorEl(el)
        setPanelSent(s)
        return
      }
      // drawer: тап по другому предложению переключает содержимое, по тому же — закрывает.
      setPanelSent((prev) => (prev?.id === s.id ? null : s))
    },
    [translationMode, toggle],
  )

  const progress = getChapterProgress(workId, level)
  const percent = Math.round(progress?.progressPercent ?? 0)
  const bookDone = store.statusOverrides[workId] === 'done'

  const renderSent = useCallback(
    (s: Sentence) => {
      const active = translationMode === 'inline' ? open.has(s.id) : panelSent?.id === s.id
      return (
        <Fragment key={s.id}>
          <span
            className={`sent ${active ? 'sent--active' : ''}`}
            data-sent-id={s.id}
            role="button"
            tabIndex={0}
            onClick={(e) => onSentence(s, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSentence(s, e.currentTarget)
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
    [translationMode, open, panelSent, onSentence, toggle],
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
              if (head) return <h3 className="sent-heading" key={p.id}>{renderSent(head)}</h3>
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

      {translationMode === 'drawer' && panelSent ? (
        <div className="tdrawer tpanel" role="dialog" aria-label="Перевод и объяснение">
          <PanelContent
            key={panelSent.id}
            sentence={panelSent}
            settings={store.settings}
            onClose={closePanel}
          />
        </div>
      ) : null}

      {translationMode === 'popover' && panelSent ? (
        <>
          <div className="tpop-backdrop" onClick={closePanel} />
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="tpop tpanel"
            role="dialog"
            aria-label="Перевод и объяснение"
          >
            <PanelContent
              key={panelSent.id}
              sentence={panelSent}
              settings={store.settings}
              onClose={closePanel}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
