// Доменные типы контента. Соответствуют JSON-схемам в /schemas и файлам в /public/content.

export type Level = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'

export const LEVELS: Level[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

export const LEVEL_LABELS: Record<Level, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
}

export interface CatalogWork {
  id: string
  /** Заголовок испанской адаптации (то, что читает пользователь). */
  title: string
  /** Русский заголовок для узнавания. */
  titleRu: string
  /** Оригинальное название произведения. */
  originalTitle: string
  authorId: string
  authorName: string
  /** Жанры — строки на русском для интерфейса. */
  genres: string[]
  /** Уровни, которые в принципе предусмотрены у произведения. */
  levels: Level[]
  /** Уровни, для которых контент уже подготовлен. */
  availableLevels: Level[]
  /** Количество слов (по испанскому тексту) на каждом доступном уровне. */
  words?: Partial<Record<Level, number>>
  /** Количество глав в произведении. */
  chapters?: number
}

export interface Catalog {
  schemaVersion: string
  works: CatalogWork[]
}

export interface Author {
  schemaVersion: string
  id: string
  name: string
  bioRu: string
}

export interface WorkLevelInfo {
  available: boolean
  chapterCount: number
}

export interface Work {
  schemaVersion: string
  id: string
  title: string
  titleRu: string
  originalTitle: string
  author: { id: string; name: string }
  genres: string[]
  synopsisRu: string
  levels: Record<Level, WorkLevelInfo>
}

export interface ChapterRef {
  id: string
  number: number
  title: string
  sentenceCount: number
}

export interface LevelManifest {
  schemaVersion: string
  workId: string
  level: Level
  chapters: ChapterRef[]
}

export interface Sentence {
  id: string
  text: string
  translationRu: string
}

export interface Paragraph {
  id: string
  sentences: Sentence[]
}

export interface Chapter {
  schemaVersion: string
  workId: string
  level: Level
  chapter: { id: string; number: number; title: string }
  paragraphs: Paragraph[]
}
