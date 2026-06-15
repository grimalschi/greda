#!/usr/bin/env node
// Детерминированно пересобирает public/content/catalog.json из всех work.json.
// Запуск: npm run build:catalog  (после добавления/изменения произведений).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKS = resolve(ROOT, 'public', 'content', 'works')
const LEVELS = ['a2', 'b1', 'b2', 'c1']

const works = []
for (const id of readdirSync(WORKS)) {
  const dir = resolve(WORKS, id)
  if (!statSync(dir).isDirectory()) continue
  const wp = resolve(dir, 'work.json')
  if (!existsSync(wp)) {
    console.warn('пропуск (нет work.json):', id)
    continue
  }
  const w = JSON.parse(readFileSync(wp, 'utf8'))
  works.push({
    id: w.id,
    title: w.title,
    titleRu: w.titleRu,
    originalTitle: w.originalTitle,
    authorId: w.author.id,
    authorName: w.author.name,
    genres: w.genres,
    levels: LEVELS.filter((l) => w.levels?.[l]),
    availableLevels: LEVELS.filter((l) => w.levels?.[l]?.available),
  })
}

// Стабильный порядок: автор → название.
works.sort(
  (a, b) =>
    (a.authorName < b.authorName ? -1 : a.authorName > b.authorName ? 1 : 0) ||
    (a.title < b.title ? -1 : a.title > b.title ? 1 : 0),
)

const catalog = { schemaVersion: '1.0', works }
writeFileSync(resolve(WORKS, '..', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`✓ catalog.json пересобран: ${works.length} произведений`)
