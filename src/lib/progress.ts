import type { CatalogWork } from '../types'
import type { ReadingStatus, Store } from './storage'

export type { ReadingStatus }

/**
 * Статус чтения произведения по всем уровням:
 * - ручная пометка пользователя (`statusOverrides`) имеет приоритет;
 * - `done` — на каком-то уровне прочитаны все главы;
 * - `started` — есть прогресс, но не дочитано;
 * - `new` — не открывалось.
 */
export function workReadingStatus(store: Store, work: CatalogWork): ReadingStatus {
  const override = store.statusOverrides?.[work.id]
  if (override) return override
  const levels = store.works[work.id]
  if (!levels) return 'new'
  const need = work.chapters ?? 1
  let started = false
  for (const p of Object.values(levels)) {
    if (!p) continue
    if ((p.completedChapterIds?.length ?? 0) >= need) return 'done'
    if ((p.progressPercent ?? 0) > 0 || p.currentChapterId) started = true
  }
  return started ? 'started' : 'new'
}
