// Доменные типы контента. Соответствуют JSON-схемам в /schemas и файлам в /public/content.

export type Level = 'a1' | 'a2' | 'b1' | 'b1v2' | 'b2' | 'c1' | 'c2'

/** Базовые 6 уровней — всегда показываются в выборе уровня. */
export const LEVELS: Level[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

/** Полный порядок, включая b1v2 (подробная B1-адаптация: язык проще, но содержание полнее). */
export const LEVEL_ORDER: Level[] = ['a1', 'a2', 'b1', 'b1v2', 'b2', 'c1', 'c2']

export const LEVEL_LABELS: Record<Level, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b1v2: 'B1 v2',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
}

/** Язык адаптации (то, что читает пользователь). По умолчанию испанский. */
export type Language = 'es' | 'ro'
export const LANGUAGES: Language[] = ['es', 'ro']
export const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Испанский',
  ro: 'Румынский',
}
/** Предложный падеж для подзаголовков «Чтение на …». */
export const LANGUAGE_LABELS_PREP: Record<Language, string> = {
  es: 'испанском',
  ro: 'румынском',
}
export const DEFAULT_LANGUAGE: Language = 'es'

export interface CatalogWork {
  id: string
  /** Язык адаптации (то, что читает пользователь). По умолчанию 'es'. */
  lang?: Language
  /** Заголовок адаптации (то, что читает пользователь). */
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
  /** Источник (для подкастов и т.п.): название + ссылка на оригинал. */
  source?: { name: string; url: string }
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
  lang?: Language
  title: string
  titleRu: string
  originalTitle: string
  author: { id: string; name: string }
  genres: string[]
  synopsisRu: string
  /** Источник (для подкастов и т.п.): название + ссылка на оригинал. */
  source?: { name: string; url: string }
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
  /** Если true — это заголовок раздела внутри сплошного текста (рендерится крупно). */
  heading?: boolean
  /** Оригинальный текст источника, соответствующий этому предложению (вкладка «Оригинал»). */
  original?: string
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
