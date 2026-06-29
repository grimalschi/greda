// Управление офлайн-кэшем контента и ручной вызов обновления приложения.
//
// Тексты не прекэшируются — их кладёт в Cache Storage 'greda-content' стратегия
// NetworkFirst (см. workbox в vite.config.ts) по мере открытия работ. Здесь мы:
//  • смотрим, что уже лежит в этом кэше (для пометок «загружено / нет»);
//  • можем заранее скачать всю библиотеку в тот же кэш («Скачать всё для офлайна»);
//  • вручную дёргаем обновление Service Worker.

import type { CatalogWork } from '../types'

const CONTENT_CACHE = 'greda-content'
const BASE = import.meta.env.BASE_URL // '/greda/'

export function offlineSupported(): boolean {
  return typeof caches !== 'undefined'
}

// Файлы, нужные для офлайн-чтения работы. Все работы одноглавные (chapter-001),
// поэтому достаточно work.json + по каждому доступному уровню manifest + глава.
export function workContentUrls(w: CatalogWork): string[] {
  const urls = [`${BASE}content/works/${w.id}/work.json`]
  for (const level of w.availableLevels) {
    urls.push(`${BASE}content/works/${w.id}/levels/${level}/manifest.json`)
    urls.push(`${BASE}content/works/${w.id}/levels/${level}/chapter-001.json`)
  }
  return urls
}

const pathOf = (u: string) => new URL(u, location.href).pathname

// id работ, чьи файлы целиком лежат в кэше (доступны офлайн).
export async function getCachedWorkIds(works: CatalogWork[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (!offlineSupported()) return out
  try {
    const cache = await caches.open(CONTENT_CACHE)
    const have = new Set((await cache.keys()).map((r) => pathOf(r.url)))
    for (const w of works) {
      if (workContentUrls(w).every((u) => have.has(pathOf(u)))) out.add(w.id)
    }
  } catch {
    /* нет доступа к Cache Storage — вернём пусто */
  }
  return out
}

// Скачивает все работы в офлайн-кэш. onProgress(done, total) — по числу работ.
export async function downloadAllForOffline(
  works: CatalogWork[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number; total: number }> {
  const total = works.length
  if (!offlineSupported()) return { ok: 0, failed: 0, total }
  const cache = await caches.open(CONTENT_CACHE)
  let done = 0
  let ok = 0
  let failed = 0
  let idx = 0

  async function cacheWork(w: CatalogWork): Promise<boolean> {
    let good = true
    for (const u of workContentUrls(w)) {
      try {
        if (await cache.match(u)) continue
        const res = await fetch(u, { cache: 'no-cache' })
        if (res.ok) await cache.put(u, res.clone())
        else good = false
      } catch {
        good = false
      }
    }
    return good
  }

  async function worker() {
    while (idx < works.length) {
      const w = works[idx++]
      if (await cacheWork(w)) ok++
      else failed++
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, works.length || 1) }, worker))
  return { ok, failed, total }
}

// Ручная проверка обновления. Если найден новый Service Worker, он активируется
// (autoUpdate из vite-plugin-pwa), а main.tsx перезагрузит страницу по 'controllerchange'.
export async function checkForAppUpdate(): Promise<'updating' | 'current' | 'unsupported'> {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return 'unsupported'
    await reg.update()
    return reg.installing || reg.waiting ? 'updating' : 'current'
  } catch {
    return 'unsupported'
  }
}
