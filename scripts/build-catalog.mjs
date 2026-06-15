#!/usr/bin/env node
// Пересобирает public/content/catalog.json из всех work.json И нормализует каждый
// work.json строго под схему (срезает лишние поля). Запуск: npm run build:catalog.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKS = resolve(ROOT, 'public', 'content', 'works')
const LEVELS = ['a2', 'b1', 'b2', 'c1']

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

  // Нормализация строго под schemas/work.schema.json (срезаем лишние поля агентов).
  const levels = {}
  for (const l of LEVELS) {
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
    levels,
  }
  const normStr = JSON.stringify(norm, null, 2) + '\n'
  if (normStr !== raw) {
    writeFileSync(wp, normStr)
    normalized++
  }

  works.push({
    id: norm.id,
    title: norm.title,
    titleRu: norm.titleRu,
    originalTitle: norm.originalTitle,
    authorId: norm.author.id,
    authorName: norm.author.name,
    genres: norm.genres,
    levels: LEVELS.filter((l) => norm.levels[l]),
    availableLevels: LEVELS.filter((l) => norm.levels[l].available),
  })
}

works.sort(
  (a, b) =>
    (a.authorName < b.authorName ? -1 : a.authorName > b.authorName ? 1 : 0) ||
    (a.title < b.title ? -1 : a.title > b.title ? 1 : 0),
)

writeFileSync(resolve(WORKS, '..', 'catalog.json'), JSON.stringify({ schemaVersion: '1.0', works }, null, 2) + '\n')
console.log(`✓ catalog.json: ${works.length} произведений (нормализовано work.json: ${normalized})`)
