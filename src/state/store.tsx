import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Level } from '../types'
import {
  defaultStore,
  loadStore,
  saveStore,
  type ChapterProgress,
  type FontSize,
  type ReadingStatus,
  type Store,
  type Theme,
  type TranslationMode,
} from '../lib/storage'

interface PositionUpdate {
  chapterId: string
  lastSentenceId: string | null
  scrollTop: number
  progressPercent: number
}

interface AppState {
  store: Store
  setTheme: (theme: Theme) => void
  setFontSize: (size: FontSize) => void
  setTranslationMode: (mode: TranslationMode) => void
  resetProgress: () => void
  getChapterProgress: (workId: string, level: Level) => ChapterProgress | undefined
  recordOpen: (workId: string, level: Level, chapterId: string) => void
  updatePosition: (workId: string, level: Level, update: PositionUpdate) => void
  markChapterCompleted: (workId: string, level: Level, chapterId: string) => void
  /** Ручная пометка статуса книги; null — сбросить и вернуться к авто-определению. */
  setWorkStatus: (workId: string, status: ReadingStatus | null) => void
}

const AppStateContext = createContext<AppState | null>(null)

function emptyChapterProgress(chapterId: string): ChapterProgress {
  return {
    currentChapterId: chapterId,
    lastSentenceId: null,
    progressPercent: 0,
    completedChapterIds: [],
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() =>
    typeof window === 'undefined' ? defaultStore() : loadStore(),
  )

  // Автосохранение при любом изменении.
  useEffect(() => {
    saveStore(store)
  }, [store])

  // Применение темы к документу (+ реакция на системную тему).
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const theme = store.settings.theme
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme
      root.dataset.theme = resolved
    }
    apply()
    if (store.settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [store.settings.theme])

  // Применение размера шрифта.
  useEffect(() => {
    document.documentElement.dataset.fontSize = store.settings.fontSize
  }, [store.settings.fontSize])

  const setTheme = useCallback((theme: Theme) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, theme } }))
  }, [])

  const setFontSize = useCallback((fontSize: FontSize) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, fontSize } }))
  }, [])

  const setTranslationMode = useCallback((translationMode: TranslationMode) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, translationMode } }))
  }, [])

  const resetProgress = useCallback(() => {
    setStore((s) => ({ ...defaultStore(), settings: s.settings }))
  }, [])

  const getChapterProgress = useCallback(
    (workId: string, level: Level): ChapterProgress | undefined =>
      store.works[workId]?.[level],
    [store.works],
  )

  const recordOpen = useCallback(
    (workId: string, level: Level, chapterId: string) => {
      setStore((s) => {
        const prev = s.works[workId]?.[level] ?? emptyChapterProgress(chapterId)
        return {
          ...s,
          lastOpened: {
            workId,
            level,
            chapterId,
            lastSentenceId: prev.currentChapterId === chapterId ? prev.lastSentenceId : null,
            scrollTop: 0,
            updatedAt: new Date().toISOString(),
          },
          works: {
            ...s.works,
            [workId]: {
              ...s.works[workId],
              [level]: { ...prev, currentChapterId: chapterId },
            },
          },
        }
      })
    },
    [],
  )

  const updatePosition = useCallback(
    (workId: string, level: Level, update: PositionUpdate) => {
      setStore((s) => {
        const prev = s.works[workId]?.[level] ?? emptyChapterProgress(update.chapterId)
        return {
          ...s,
          lastOpened: {
            workId,
            level,
            chapterId: update.chapterId,
            lastSentenceId: update.lastSentenceId,
            scrollTop: update.scrollTop,
            updatedAt: new Date().toISOString(),
          },
          works: {
            ...s.works,
            [workId]: {
              ...s.works[workId],
              [level]: {
                ...prev,
                currentChapterId: update.chapterId,
                lastSentenceId: update.lastSentenceId,
                // Фактическая позиция (не max): отражает, где читатель сейчас,
                // и само-исправляет старые значения, «застрявшие» на 100 %.
                progressPercent: update.progressPercent,
              },
            },
          },
        }
      })
    },
    [],
  )

  const markChapterCompleted = useCallback(
    (workId: string, level: Level, chapterId: string) => {
      setStore((s) => {
        const prev = s.works[workId]?.[level] ?? emptyChapterProgress(chapterId)
        if (prev.completedChapterIds.includes(chapterId)) return s
        return {
          ...s,
          works: {
            ...s.works,
            [workId]: {
              ...s.works[workId],
              [level]: {
                ...prev,
                completedChapterIds: [...prev.completedChapterIds, chapterId],
              },
            },
          },
        }
      })
    },
    [],
  )

  const setWorkStatus = useCallback((workId: string, status: ReadingStatus | null) => {
    setStore((s) => {
      const next = { ...s.statusOverrides }
      if (status == null) delete next[workId]
      else next[workId] = status
      return { ...s, statusOverrides: next }
    })
  }, [])

  const value = useMemo<AppState>(
    () => ({
      store,
      setTheme,
      setFontSize,
      setTranslationMode,
      resetProgress,
      getChapterProgress,
      recordOpen,
      updatePosition,
      markChapterCompleted,
      setWorkStatus,
    }),
    [
      store,
      setTheme,
      setFontSize,
      setTranslationMode,
      resetProgress,
      getChapterProgress,
      recordOpen,
      updatePosition,
      markChapterCompleted,
      setWorkStatus,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState должен использоваться внутри <AppStateProvider>')
  return ctx
}

// Используется в ридере для троттлинга записи позиции.
export function useThrottledCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): (...args: A) => void {
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  return useCallback(
    (...args: A) => {
      const now = Date.now()
      const remaining = delayMs - (now - last.current)
      if (remaining <= 0) {
        last.current = now
        fnRef.current(...args)
      } else {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          last.current = Date.now()
          fnRef.current(...args)
        }, remaining)
      }
    },
    [delayMs],
  )
}
