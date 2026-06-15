// Локальное хранилище настроек и прогресса (localStorage).
// Структура повторяет ТЗ §9.

import type { Level } from '../types'

export type Theme = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge'

export interface Settings {
  theme: Theme
  fontSize: FontSize
}

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
  lastOpened: LastOpened | null
  works: WorksProgress
  settings: Settings
}

const STORAGE_KEY = 'greda:v1'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'medium',
}

export function defaultStore(): Store {
  return { lastOpened: null, works: {}, settings: { ...DEFAULT_SETTINGS } }
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      lastOpened: parsed.lastOpened ?? null,
      works: parsed.works ?? {},
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
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
