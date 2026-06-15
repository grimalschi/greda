#!/usr/bin/env node
// Валидация контента: JSON-схемы + перекрёстные проверки целостности.
// Запуск: npm run validate  (используется и локально, и в CI перед сборкой).

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMAS = resolve(ROOT, 'schemas')
const CONTENT = resolve(ROOT, 'public', 'content')
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

const errors = []
const error = (where, msg) => errors.push(`${where}: ${msg}`)

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })
addFormats(ajv)

const validators = {}
for (const name of ['catalog', 'author', 'work', 'manifest', 'chapter']) {
  validators[name] = ajv.compile(readJson(resolve(SCHEMAS, `${name}.schema.json`)))
}

function checkSchema(name, where, data) {
  const validate = validators[name]
  if (!validate(data)) {
    for (const e of validate.errors ?? []) {
      error(where, `схема: ${e.instancePath || '/'} ${e.message}`)
    }
    return false
  }
  return true
}

function arraysEqualAsSets(a, b) {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

// ---- catalog ----
const catalogPath = resolve(CONTENT, 'catalog.json')
if (!existsSync(catalogPath)) {
  error('catalog.json', 'файл не найден')
  finish()
}
const catalog = readJson(catalogPath)
checkSchema('catalog', 'catalog.json', catalog)

const seenWorkIds = new Set()
const referencedAuthors = new Set()

for (const cw of catalog.works ?? []) {
  const where = `catalog.works[${cw.id}]`
  if (seenWorkIds.has(cw.id)) error(where, 'дублирующийся id произведения')
  seenWorkIds.add(cw.id)
  referencedAuthors.add(cw.authorId)

  // availableLevels должен быть подмножеством levels
  for (const l of cw.availableLevels ?? []) {
    if (!(cw.levels ?? []).includes(l)) {
      error(where, `availableLevels содержит "${l}", которого нет в levels`)
    }
  }

  // ---- work.json ----
  const workPath = resolve(CONTENT, 'works', cw.id, 'work.json')
  if (!existsSync(workPath)) {
    error(where, `нет work.json (${workPath})`)
    continue
  }
  const work = readJson(workPath)
  const ww = `works/${cw.id}/work.json`
  if (!checkSchema('work', ww, work)) continue

  if (work.id !== cw.id) error(ww, `work.id "${work.id}" ≠ id в каталоге "${cw.id}"`)
  if (work.author.id !== cw.authorId) {
    error(ww, `author.id "${work.author.id}" ≠ authorId в каталоге "${cw.authorId}"`)
  }

  const availInWork = LEVELS.filter((l) => work.levels[l]?.available)
  if (!arraysEqualAsSets(availInWork, cw.availableLevels ?? [])) {
    error(
      ww,
      `availableLevels в каталоге [${cw.availableLevels}] ≠ доступным в work.json [${availInWork}]`,
    )
  }

  // ---- уровни и главы ----
  for (const level of LEVELS) {
    const info = work.levels[level]
    if (!info?.available) continue

    const manifestPath = resolve(CONTENT, 'works', cw.id, 'levels', level, 'manifest.json')
    const mw = `works/${cw.id}/levels/${level}/manifest.json`
    if (!existsSync(manifestPath)) {
      error(mw, 'уровень помечен available, но manifest.json не найден')
      continue
    }
    const manifest = readJson(manifestPath)
    if (!checkSchema('manifest', mw, manifest)) continue

    if (manifest.workId !== cw.id) error(mw, `workId "${manifest.workId}" ≠ "${cw.id}"`)
    if (manifest.level !== level) error(mw, `level "${manifest.level}" ≠ "${level}"`)
    if (manifest.chapters.length !== info.chapterCount) {
      error(mw, `chapterCount=${info.chapterCount}, а глав в манифесте ${manifest.chapters.length}`)
    }

    const chapterIds = new Set()
    for (const ref of manifest.chapters) {
      if (chapterIds.has(ref.id)) error(mw, `дублирующийся chapter id "${ref.id}"`)
      chapterIds.add(ref.id)

      const chapterPath = resolve(CONTENT, 'works', cw.id, 'levels', level, `${ref.id}.json`)
      const ch = `works/${cw.id}/levels/${level}/${ref.id}.json`
      if (!existsSync(chapterPath)) {
        error(ch, 'глава из манифеста не найдена')
        continue
      }
      const chapter = readJson(chapterPath)
      if (!checkSchema('chapter', ch, chapter)) continue

      if (chapter.workId !== cw.id) error(ch, `workId "${chapter.workId}" ≠ "${cw.id}"`)
      if (chapter.level !== level) error(ch, `level "${chapter.level}" ≠ "${level}"`)
      if (chapter.chapter.id !== ref.id) error(ch, `chapter.id "${chapter.chapter.id}" ≠ "${ref.id}"`)
      if (chapter.chapter.number !== ref.number) {
        error(ch, `number ${chapter.chapter.number} ≠ ${ref.number} в манифесте`)
      }

      const paraIds = new Set()
      const sentIds = new Set()
      let sentenceCount = 0
      for (const para of chapter.paragraphs) {
        if (paraIds.has(para.id)) error(ch, `дублирующийся paragraph id "${para.id}"`)
        paraIds.add(para.id)
        for (const sent of para.sentences) {
          if (sentIds.has(sent.id)) error(ch, `дублирующийся sentence id "${sent.id}"`)
          sentIds.add(sent.id)
          sentenceCount += 1
        }
      }
      if (sentenceCount !== ref.sentenceCount) {
        error(ch, `sentenceCount=${ref.sentenceCount} в манифесте, а реально предложений ${sentenceCount}`)
      }
    }
  }
}

// ---- авторы ----
for (const authorId of referencedAuthors) {
  const authorPath = resolve(CONTENT, 'authors', `${authorId}.json`)
  const aw = `authors/${authorId}.json`
  if (!existsSync(authorPath)) {
    error(aw, 'автор упомянут в каталоге, но файла нет')
    continue
  }
  const author = readJson(authorPath)
  if (checkSchema('author', aw, author) && author.id !== authorId) {
    error(aw, `id "${author.id}" ≠ имени файла "${authorId}"`)
  }
}

finish()

function finish() {
  if (errors.length === 0) {
    const works = catalog?.works?.length ?? 0
    console.log(`✓ Контент валиден. Произведений в каталоге: ${works}.`)
    process.exit(0)
  }
  console.error(`✗ Найдено проблем: ${errors.length}\n`)
  for (const e of errors) console.error('  • ' + e)
  process.exit(1)
}
