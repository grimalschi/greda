// Локальное хранилище настроек и прогресса (localStorage).
// Структура повторяет ТЗ §9.

import type { Level } from '../types'

export type Theme = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge'
export type ReadingStatus = 'new' | 'started' | 'done'
/** Как показывать перевод: под строкой (inline), в панели снизу (drawer) или в поповере у предложения. */
export type TranslationMode = 'inline' | 'drawer' | 'popover'

/** Провайдер ИИ для функции «Объяснение». OpenRouter работает из браузера надёжнее
 * (CORS на всех ответах, видны ошибки, есть бесплатные модели). */
export type AiProvider = 'openai' | 'openrouter'

export interface Settings {
  theme: Theme
  fontSize: FontSize
  translationMode: TranslationMode
  /** Какой провайдер использовать для объяснений. */
  aiProvider: AiProvider
  /** Ключи провайдеров (хранятся локально в браузере). */
  openaiApiKey: string
  openrouterApiKey: string
  /** Модели на каждого провайдера. */
  openaiModel: string
  openrouterModel: string
  /** Шаблон промпта; __SENTENCE__ заменяется на предложение. */
  explainPrompt: string
}

export const DEFAULT_EXPLAIN_PROMPT =
  'Кратко объясни грамматику и структуру предложения на испанском: __SENTENCE__'

export interface LastOpened {
  workId: string
  level: Level
  chapterId: string
  lastSentenceId: string | null
  scrollTop: number
  updatedAt: string
}

export interface ChapterProgress {
  currentChapterId: string
  lastSentenceId: string | null
  progressPercent: number
  completedChapterIds: string[]
}

/** works[workId][level] -> прогресс. */
export type WorksProgress = Record<string, Partial<Record<Level, ChapterProgress>>>

export interface Store {
  /** Версия структуры — для одноразовых миграций (см. loadStore). */
  v: number
  lastOpened: LastOpened | null
  works: WorksProgress
  settings: Settings
  /** Ручная пометка статуса книги пользователем (перекрывает авто-определение). */
  statusOverrides: Record<string, ReadingStatus>
}

const STORAGE_KEY = 'greda:v1'
const STORE_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'medium',
  translationMode: 'inline',
  aiProvider: 'openrouter',
  openaiApiKey: '',
  openrouterApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openrouterModel: 'openai/gpt-4o-mini',
  explainPrompt: DEFAULT_EXPLAIN_PROMPT,
}

export function defaultStore(): Store {
  return { v: STORE_VERSION, lastOpened: null, works: {}, settings: { ...DEFAULT_SETTINGS }, statusOverrides: {} }
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Partial<Store> & { v?: number }
    const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    const works = parsed.works ?? {}
    if (parsed.v !== STORE_VERSION) {
      // Одноразовая миграция: ранний баг прогресса помечал главы «прочитано» уже при
      // открытии. Снимаем ложные отметки завершения, сохраняя позицию чтения и настройки.
      for (const wid in works) {
        const byLevel = works[wid]
        if (!byLevel) continue
        for (const lv of Object.keys(byLevel) as Level[]) {
          const p = byLevel[lv]
          if (p) p.completedChapterIds = []
        }
      }
    }
    return {
      v: STORE_VERSION,
      lastOpened: parsed.lastOpened ?? null,
      works,
      settings,
      statusOverrides: parsed.statusOverrides ?? {},
    }
  } catch {
    // Повреждённые данные не должны ронять приложение.
    return defaultStore()
  }
}

export function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Переполнение квоты / приватный режим — молча игнорируем.
  }
}
