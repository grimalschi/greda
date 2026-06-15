// Загрузка статического контента из /public/content.
// Все файлы кэшируются service worker'ом, поэтому офлайн запросы идут из кэша.

import type {
  Author,
  Catalog,
  Chapter,
  Level,
  LevelManifest,
  Work,
} from '../types'

// import.meta.env.BASE_URL === '/greda/' (см. vite.config.ts), всегда оканчивается на '/'.
const CONTENT_BASE = `${import.meta.env.BASE_URL}content/`

async function getJson<T>(relPath: string): Promise<T> {
  const res = await fetch(`${CONTENT_BASE}${relPath}`)
  if (!res.ok) {
    throw new Error(`Не удалось загрузить ${relPath} (HTTP ${res.status})`)
  }
  return (await res.json()) as T
}

export function fetchCatalog(): Promise<Catalog> {
  return getJson<Catalog>('catalog.json')
}

export function fetchAuthor(authorId: string): Promise<Author> {
  return getJson<Author>(`authors/${authorId}.json`)
}

export function fetchWork(workId: string): Promise<Work> {
  return getJson<Work>(`works/${workId}/work.json`)
}

export function fetchManifest(workId: string, level: Level): Promise<LevelManifest> {
  return getJson<LevelManifest>(`works/${workId}/levels/${level}/manifest.json`)
}

export function fetchChapter(
  workId: string,
  level: Level,
  chapterId: string,
): Promise<Chapter> {
  return getJson<Chapter>(`works/${workId}/levels/${level}/${chapterId}.json`)
}
