# CLAUDE.md

Guidance for working in this repo (**greda**). Read this first.

## What this is
Offline-first PWA for studying Spanish by reading public-domain works adapted into
graded Spanish (A2/B1/B2/C1) with **per-sentence Russian translations**. UI is in Russian.
No backend and no runtime LLM calls — all content is pre-generated static JSON in
`public/content/`, precached by the service worker for offline use.

## Commands
- `npm run dev` — dev server at http://localhost:5173/greda/
- `npm run validate` — validate all content vs JSON schemas + cross-checks. Run after ANY content change.
- `npm run build` — `tsc -b` typecheck + Vite production build to `dist/`.
- `npm run preview` — serve the built bundle locally.

CI runs validate → build → deploy on every push to `main`.

## Architecture
- Vite + React + TS. `base` is `/greda/` (GitHub Pages project site). Uses **`HashRouter`** so deep links work on Pages.
- PWA via `vite-plugin-pwa` (Workbox). For MVP it **precaches everything** (app shell + all content JSON) — see `workbox.globPatterns` in `vite.config.ts`.
- State (settings + reading progress) lives in `localStorage` under key `greda:v1`, managed by `src/state/store.tsx` (`useAppState()`). Theme and font size are applied via `data-theme` / `data-font-size` on `<html>` + CSS variables in `src/styles.css`.
- Content is fetched at runtime from `public/content/` via `src/lib/content.ts` (uses `import.meta.env.BASE_URL`). Loading/error via `useAsync` (`src/hooks/`).
- Routes (`src/App.tsx`): `/` home · `/work/:workId` · `/read/:workId/:level/:chapterId` · `/settings`. Pages in `src/pages/`.

## Content model
`public/content/`:
- `catalog.json` — home-screen index (1 entry per work; `availableLevels` = levels with real content).
- `authors/<authorId>.json`
- `works/<workId>/work.json` — metadata + `levels.<level>.{available,chapterCount}`.
- `works/<workId>/levels/<level>/manifest.json` — chapter list (`sentenceCount` per chapter).
- `works/<workId>/levels/<level>/chapter-NNN.json` — paragraphs → sentences (`text` = ES, `translationRu` = RU).
- `works/<workId>/source/` — original public-domain text + metadata. **Never shown in the app.**

Schemas in `schemas/`. The validator (`scripts/validate-content.mjs`) enforces them plus:
`workId`/`level` fields match the file location, `sentenceCount` equals the real count,
`catalog.availableLevels` matches `work.json` available levels, ids are unique.

### ID rules (enforced)
- `para-001`, `para-002`, … (3 digits) — sequential within a chapter.
- `sent-001`, … (3 digits) — sequential across the WHOLE chapter (not reset per paragraph).
- `chapter-001`, … (3 digits).

### Adding / changing content
1. Write/edit `chapter-NNN.json` (+ `manifest.json`) under the level.
2. Set `available: true` and the correct `chapterCount` in `work.json`; add the level to `availableLevels` in `catalog.json`.
3. `npm run validate` until clean, then `npm run build`.

Generation guidance: `prompts/adaptation.md`. Soft-shorten only — never drop whole plot scenes.

## Conventions
- TS strict with `verbatimModuleSyntax` → import types with `import type { … }`.
- UI strings are Russian; reading content is Spanish with Russian **sentence** translations only (no word-level glossary/tokens — out of scope).
- Never render original source text.

## Deploy
Push `main` → `.github/workflows/deploy.yml` (validate → build → Pages). Pages is already
enabled (source = GitHub Actions). Live: https://grimalschi.github.io/greda/.

## GitHub access
Use a fine-grained PAT scoped to this repo only, passed **inline per command** as `GH_TOKEN`
(never `gh auth login`, never in the remote URL or `.git/config`). Revoke after use.
