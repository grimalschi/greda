#!/usr/bin/env node
// Пересобирает public/content/catalog.json из всех work.json И нормализует каждый
// work.json строго под схему (срезает лишние поля). Запуск: npm run build:catalog.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKS = resolve(ROOT, 'public', 'content', 'works')
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

// Считает слова (по испанскому тексту `text`) во всех главах уровня.
function levelWordCount(workId, level) {
  const dir = resolve(WORKS, workId, 'levels', level)
  const mp = resolve(dir, 'manifest.json')
  if (!existsSync(mp)) return 0
  let total = 0
  for (const ch of JSON.parse(readFileSync(mp, 'utf8')).chapters) {
    const cp = resolve(dir, `${ch.id}.json`)
    if (!existsSync(cp)) continue
    for (const p of JSON.parse(readFileSync(cp, 'utf8')).paragraphs) {
      for (const s of p.sentences) {
        const t = (s.text || '').trim()
        if (t) total += t.split(/\s+/).length
      }
    }
  }
  return total
}

const works = []
let normalized = 0

for (const id of readdirSync(WORKS)) {
  const dir = resolve(WORKS, id)
  if (!statSync(dir).isDirectory()) continue
  const wp = resolve(dir, 'work.json')
  if (!existsSync(wp)) {
    console.warn('пропуск (нет work.json):', id)
    continue
  }
  const raw = readFileSync(wp, 'utf8')
  const w = JSON.parse(raw)

  // Базовые уровни + любые доп. уровни, реально присутствующие в work.json (напр. b1v2).
  const levelKeys = [...LEVELS, ...Object.keys(w.levels || {}).filter((l) => !LEVELS.includes(l))]

  // Нормализация строго под schemas/work.schema.json (срезаем лишние поля агентов).
  const levels = {}
  for (const l of levelKeys) {
    const li = w.levels?.[l] || {}
    const available = !!li.available
    levels[l] = {
      available,
      chapterCount: Number.isInteger(li.chapterCount) ? li.chapterCount : available ? 1 : 0,
    }
  }
  const norm = {
    schemaVersion: w.schemaVersion || '1.0',
    id: w.id,
    title: w.title,
    titleRu: w.titleRu,
    originalTitle: w.originalTitle,
    author: { id: w.author.id, name: w.author.name },
    genres: w.genres,
    synopsisRu: w.synopsisRu,
    ...(w.proofread ? { proofread: w.proofread } : {}),
    levels,
  }
  const normStr = JSON.stringify(norm, null, 2) + '\n'
  if (normStr !== raw) {
    writeFileSync(wp, normStr)
    normalized++
  }

  const availableLevels = levelKeys.filter((l) => norm.levels[l].available)
  const words = {}
  for (const l of availableLevels) words[l] = levelWordCount(norm.id, l)
  const chapters = availableLevels.length
    ? Math.max(...availableLevels.map((l) => norm.levels[l].chapterCount))
    : 0

  works.push({
    id: norm.id,
    title: norm.title,
    titleRu: norm.titleRu,
    originalTitle: norm.originalTitle,
    authorId: norm.author.id,
    authorName: norm.author.name,
    genres: norm.genres,
    levels: levelKeys.filter((l) => norm.levels[l]),
    availableLevels,
    chapters,
    words,
  })
}

works.sort(
  (a, b) =>
    (a.authorName < b.authorName ? -1 : a.authorName > b.authorName ? 1 : 0) ||
    (a.title < b.title ? -1 : a.title > b.title ? 1 : 0),
)

writeFileSync(resolve(WORKS, '..', 'catalog.json'), JSON.stringify({ schemaVersion: '1.0', works }, null, 2) + '\n')
console.log(`✓ catalog.json: ${works.length} произведений (нормализовано work.json: ${normalized})`)
