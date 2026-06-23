# CLAUDE.md

Guidance for working in this repo (**greda**). Read this first.

## What this is
Offline-first PWA for studying Spanish by reading public-domain short fiction adapted into
graded Spanish at level **B1** with **per-sentence Russian translations**. UI is in Russian. No backend
and no runtime LLM calls — all content is pre-generated static JSON in `public/content/`. The library
holds **58 faithful works**, each a **single-chapter B1 adaptation** by the "simpler-not-shorter" method
(below): 10 Sherlock Holmes stories + `the-yellow-face`, and **47 world short-fiction classics** (Joyce,
Kafka, Chekhov, Tolstoy, O. Henry, Mansfield, Woolf, Akutagawa, Tagore, Bunin, Andreyev, Conrad, Saki,
M. R. James, Blackwood, Dunsany, Fitzgerald, Lovecraft, Twain, Cather, Pirandello, Gorky, …). All from
Project Gutenberg (first published ≤1930 → US public domain).

**History — the great simplification (2026-06-23):** the library previously held **402 works**, but
~344 of them (5 Poe/London originals, ~263 detective & sci-fi, 87 classics added 2026-06-16) used an
earlier *soft-shorten* method that compressed heavily and dropped detail across levels a1–c2. Per the
user's call, **all soft-shortened content was deleted** and the faithful method is now the single
standard: the faithful level (formerly the extra `b1v2`) was renamed to base **`b1`**, and the other
five base levels (a1/a2/b2/c1/c2) are present-but-unavailable on every work. So today **`b1` = the
faithful standard**, and there is no `b1v2` in the live content (the wiring still exists, dormant).
A handful of planned classics were dropped because Anthropic's output content-filter persistently
blocked their core scenes (In the Penal Colony, The Machine Stops, Casting the Runes, Benjamin Button)
or they exceeded ~50 pp (Death in Venice, The Seven Who Were Hanged, The Forged Coupon).

## Commands
- `npm run dev` — dev server at http://localhost:5173/greda/
- `npm run validate` — validate all content vs JSON schemas + cross-checks. Run after ANY content change.
- `npm run build:catalog` — **regenerate `catalog.json` from all `work.json` AND normalize every `work.json` to the schema** (strips stray fields). Run before validate after adding/editing works.
- `npm run build` — `tsc -b` typecheck + Vite production build to `dist/`.
- `npm run preview` — serve the built bundle locally.

CI runs validate → build → deploy on every push to `main`.

## Architecture
- Vite + React + TS. `base` is `/greda/` (GitHub Pages project site). Uses **`HashRouter`** so deep links work on Pages.
- PWA via `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`. **The service worker precaches only the app shell** (JS/CSS/HTML/icons ≈ 200 KB). **Content JSON is served via `NetworkFirst` runtime caching** (`greda-content` cache): fresh from network when online, served from cache offline / for already-opened works. This replaced the old "precache everything" strategy, which at 268 works (~16 MB) made first load heavy and caused the catalog to get stuck in a stale SW cache. See `workbox` in `vite.config.ts`.
- State (settings + reading progress) lives in `localStorage` under key `greda:v1`, managed by `src/state/store.tsx` (`useAppState()`). Theme/font-size applied via `data-theme`/`data-font-size` on `<html>` + CSS variables in `src/styles.css`.
- Content is fetched at runtime from `public/content/` via `src/lib/content.ts` (uses `import.meta.env.BASE_URL`). Loading/error via `useAsync` (`src/hooks/`).
- Routes (`src/App.tsx`): `/` home · `/work/:workId` · `/read/:workId/:level/:chapterId` · `/settings`. Pages in `src/pages/`. The home page has search + genre filter (needed at 268 works).

## Content model
`public/content/`:
- `catalog.json` — home-screen index. **GENERATED** by `npm run build:catalog` from all `work.json`; do NOT hand-edit.
- `authors/<authorId>.json`
- `works/<workId>/work.json` — metadata + `levels.<level>.{available,chapterCount}`.
- `works/<workId>/levels/<level>/manifest.json` — chapter list (`sentenceCount` per chapter).
- `works/<workId>/levels/<level>/chapter-NNN.json` — paragraphs → sentences (`text` = ES, `translationRu` = RU).
- `works/<workId>/source/` — original public-domain text + metadata (only the 5 originals). **Never shown in the app.**

Schemas in `schemas/`. The validator (`scripts/validate-content.mjs`) enforces them plus:
`workId`/`level` fields match the file location, `sentenceCount` equals the real count,
`catalog.availableLevels` matches `work.json` available levels, ids are unique.

### ID rules (enforced)
- `para-001`, `para-002`, … (3 digits) — sequential within a chapter.
- `sent-001`, … (3 digits) — sequential across the WHOLE chapter (not reset per paragraph).
- `chapter-001`, … (3 digits).

### Adding / changing content
1. Write/edit `chapter-NNN.json` (+ `manifest.json`) under the level, and `work.json` (levels available + chapterCount).
2. `npm run build:catalog` (rebuilds `catalog.json`, normalizes `work.json`).
3. `npm run validate` until clean, then `npm run build`.

## Adaptation methodology (IMPORTANT — current standard)
Graded reading here means **simplify the language, not the content**. Keep ALL of the original:
every scene, plot beat, key detail, important dialogue, deduction and emotional turn. Do **not**
summarize or collapse events into a synopsis. Only the *form* is simplified per CEFR level — short
sentences (one idea each), high-frequency vocabulary, simple tenses, long periods broken into several
short ones. The result stays close to the original in coverage (target: **≥80–90 % of the source word
count**; ~1 simplified sentence per ~30–40 source words; a ~6 000-word story → ~150–200 sentences,
**not** ~35). **One sentence = one object:** never put two sentences (two `.`/`!`/`?`) in a single
`text` — split long periods into separate `sent-` objects, each with its own `translationRu`. Sensitive
themes: render the meaning faithfully in respectful modern language; never reproduce archaic slurs, and
keep harsh/violent/frightening scenes sober and non-graphic (this also avoids the output content-filter
blocking generation). Spec: `.plan/spec-faithful.md`.

- **Legacy caveat:** most existing content (original 263 + 87 classics) used an earlier *soft-shorten /
  condense* approach that compressed heavily and dropped detail — it is being migrated to the faithful
  method. The 47 world classics (2026-06-23) are faithful from the start.
- **`b1v2` (optional extra level, label "B1 v2"):** a faithful re-take that coexists with the base 6
  levels — used on the 10 Sherlock Holmes stories + `the-yellow-face` for side-by-side comparison with
  their legacy soft `b1`, AND on the 47 world classics (2026-06-23), which have ONLY `b1v2`
  (`b1.available=false`) so the «B1 v2» filter groups all faithful content. Each b1v2 is
  **single-chapter** (matches the original short-story structure and the sibling levels).
  Non-base levels are wired through `schemas/` (`level` enums + `work.levels.b1v2`),
  `scripts/build-catalog.mjs` (preserves extra levels), `validate-content.mjs`, `src/types.ts`
  (`Level`/`LEVEL_ORDER`/`LEVEL_LABELS`), and `WorkPage`/`WorkCard`/`HomePage` (render b1v2 only where present).
- **Reader (`ReaderPage`):** text reads as **one continuous flow — no chapter navigation** (every work is
  single-chapter; the `chapter` wrapper survives in the data but the UI never paginates it). A future
  section break is just a sentence with `heading: true` (rendered as `.sent-heading`), NOT a separate
  chapter file. Click a Spanish sentence to reveal its Russian translation; setting
  `settings.translationMode` is **inline** (under the line) / **drawer** (bottom sheet) / **popover**
  (next to the sentence). Drawer & popover show tabs **«Перевод»/«Объяснение»**; the Объяснение tab calls
  an LLM (`src/lib/explain.ts`) for a grammar breakdown. Provider is `settings.aiProvider`:
  **OpenRouter** (default — works from the browser: CORS on every response incl. errors; free models exist)
  or **OpenAI** (works on success but `chat/completions` omits CORS on *error* responses → errors surface
  as a bare `TypeError`). Keys/models are per-provider in Settings, stored only in localStorage; the call
  is direct client-side (no backend). The prompt template (`__SENTENCE__` placeholder) is editable.
  Reading **progress = index of the top-visible sentence / total** (layout-timing-proof); position is
  restored by scrolling to the saved `lastSentenceId`. On unmount the position is saved from
  `lastPosRef` (the container ref is already detached, so `topVisibleSentenceId` returns null then — do
  NOT let that overwrite the saved sentence with null). `store` has a `v` (version) for one-time
  migrations + per-work `statusOverrides` (manual new/started/done).

## Content sources & generation (out-of-app, one-time)
- **All sources are public domain from Project Gutenberg** (gutenberg.org, first published ≤1930 → US public domain).
- **`content-sources.json`** (repo root) — manifest mapping every generated work → its Gutenberg URL, author, year, container, raw-text file.
- **`sources/`** (repo root, NOT under `public/`, NOT deployed) — the 67 raw Gutenberg text files, preserved for reproducibility.
- Generation pipeline used: research subagents compiled & verified the Gutenberg list → orchestrator downloaded sources locally → batches of 10 subagents each read a local source and wrote 4 levels + `work.json` → `build:catalog` → `validate` → commit/push per batch. Per-work generation spec/guidance: `prompts/adaptation.md` (legacy soft-shorten) and `.plan/spec-faithful.md` (**current** faithful method — see "Adaptation methodology" above). That existing content was soft-shortened (heavy compression); new/regenerated content must use the faithful method.
- Working files (gitignored): `.gen-plan.json`, `.plan/`.

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
