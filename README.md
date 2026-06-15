# Greda — офлайн-ридер испанских текстов

Личное offline-first PWA для изучения испанского через чтение адаптированных
public domain произведений. Без бэкенда и без LLM-запросов во время работы: все
адаптации и переводы заранее подготовлены и лежат в репозитории как статические JSON.

**Live:** https://grimalschi.github.io/greda/

- Интерфейс — русский, изучаемый язык — испанский.
- Показывается только испанская адаптация; перевод — на уровне предложений (по тапу).
- Уровни: A2 / B1 / B2 / C1.
- Работает офлайн после первого открытия (Service Worker кэширует приложение и весь контент).

## Стек

React + TypeScript + Vite, PWA (`vite-plugin-pwa` / Workbox), деплой на GitHub Pages
через GitHub Actions. Прогресс и настройки — в `localStorage`.

## Разработка

```bash
npm install
npm run dev        # дев-сервер (http://localhost:5173/greda/)
npm run validate   # проверка контента по JSON-схемам
npm run build      # типы + production-сборка в dist/
npm run preview    # локальный предпросмотр собранного бандла
```

> `base` в [vite.config.ts](vite.config.ts) — `/greda/` (имя репозитория на GitHub Pages).
> Используется `HashRouter`, чтобы прямые ссылки работали без SPA-fallback.

## Структура

```
src/                 приложение (страницы, состояние, доступ к контенту)
public/content/      статический контент, отдаётся как есть и кэшируется SW
  catalog.json       индекс произведений для главной
  authors/<id>.json  авторы
  works/<id>/
    work.json              метаданные произведения + доступность уровней
    source/                исходный public domain текст (НЕ показывается)
    levels/<level>/
      manifest.json        список глав уровня
      chapter-XXX.json     главы: абзацы → предложения → перевод
schemas/             JSON-схемы контента
scripts/             validate-content.mjs (валидация + перекрёстные проверки)
prompts/             шаблон промпта генерации адаптаций
.github/workflows/   деплой на GitHub Pages
```

Форматы данных описаны схемами в [`schemas/`](schemas/) и проверяются `npm run validate`
(запускается и в CI перед сборкой).

## Контент

Генерируется вне приложения по пайплайну из [prompts/adaptation.md](prompts/adaptation.md):
исходный текст → очистка → разбивка на главы/абзацы → испанская адаптация под уровень →
разбивка на предложения → русский перевод → JSON по схемам → валидация → коммит.

Текущий статус наполнения — в `catalog.json` (`availableLevels`) и `work.json`
(`levels.<level>.available`). Уровни без контента в интерфейсе помечаются «скоро».

## Деплой

Любой push в `main` запускает [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
`npm ci` → валидация контента → сборка → публикация `dist/` на GitHub Pages
(Pages включается автоматически через `actions/configure-pages`).
