import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { useAppState } from '../state/store'
import type { AiProvider, FontSize, Theme, TranslationMode } from '../lib/storage'

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
]

const TRANSLATION_OPTIONS: { value: TranslationMode; label: string; hint: string }[] = [
  { value: 'inline', label: 'В тексте', hint: 'Перевод появляется прямо под предложением' },
  { value: 'drawer', label: 'Панель снизу', hint: 'Перевод и объяснение во всплывающей панели внизу' },
  { value: 'popover', label: 'Поповер', hint: 'Перевод и объяснение в окошке у самого предложения' },
]

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Системная' },
]

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Маленький' },
  { value: 'medium', label: 'Средний' },
  { value: 'large', label: 'Крупный' },
  { value: 'xlarge', label: 'Очень крупный' },
]

export function SettingsPage() {
  const { store, setTheme, setFontSize, setTranslationMode, updateSettings, resetProgress } =
    useAppState()
  const [confirming, setConfirming] = useState(false)
  const tMode = store.settings.translationMode
  const s = store.settings
  const provider = s.aiProvider
  const aiKey = provider === 'openai' ? s.openaiApiKey : s.openrouterApiKey
  const aiModel = provider === 'openai' ? s.openaiModel : s.openrouterModel
  const setAiKey = (v: string) =>
    updateSettings(provider === 'openai' ? { openaiApiKey: v } : { openrouterApiKey: v })
  const setAiModel = (v: string) =>
    updateSettings(provider === 'openai' ? { openaiModel: v } : { openrouterModel: v })

  return (
    <div className="page">
      <TopBar title="Настройки" back />
      <main className="container">
        <section className="block">
          <h2 className="section-title">Тема</h2>
          <div className="filter" role="group" aria-label="Тема оформления">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip-btn ${store.settings.theme === opt.value ? 'chip-btn--active' : ''}`}
                onClick={() => setTheme(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="section-title">Размер шрифта</h2>
          <div className="filter" role="group" aria-label="Размер шрифта">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip-btn ${store.settings.fontSize === opt.value ? 'chip-btn--active' : ''}`}
                onClick={() => setFontSize(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="settings-preview para">
            La Muerte Roja había devastado el país durante mucho tiempo.
          </p>
        </section>

        <section className="block">
          <h2 className="section-title">Перевод предложений</h2>
          <div className="filter" role="group" aria-label="Как открывать перевод">
            {TRANSLATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip-btn ${tMode === opt.value ? 'chip-btn--active' : ''}`}
                onClick={() => setTranslationMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: '0.4em', fontSize: '0.85em' }}>
            {TRANSLATION_OPTIONS.find((o) => o.value === tMode)?.hint}
          </p>
        </section>

        <section className="block">
          <h2 className="section-title">Объяснение грамматики (ИИ)</h2>
          <div className="filter" role="group" aria-label="Провайдер ИИ">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip-btn ${provider === opt.value ? 'chip-btn--active' : ''}`}
                onClick={() => updateSettings({ aiProvider: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field__label">
              Ключ API {provider === 'openai' ? 'OpenAI (sk-…)' : 'OpenRouter (sk-or-…)'}
            </span>
            <input
              className="field__input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={provider === 'openai' ? 'sk-…' : 'sk-or-…'}
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Модель</span>
            <input
              className="field__input"
              type="text"
              spellCheck={false}
              placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini'}
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Промпт (плейсхолдер __SENTENCE__)</span>
            <textarea
              className="field__input field__textarea"
              rows={3}
              value={s.explainPrompt}
              onChange={(e) => updateSettings({ explainPrompt: e.target.value })}
            />
          </label>
          <p className="muted" style={{ fontSize: '0.85em' }}>
            Ключ хранится только в этом браузере; запрос идёт напрямую к провайдеру при открытии
            вкладки «Объяснение» (режимы «Панель снизу» и «Поповер»). <code>__SENTENCE__</code>{' '}
            заменяется на предложение.{' '}
            {provider === 'openrouter' ? (
              <>
                <b>OpenRouter</b> работает из браузера надёжнее (видны ошибки, есть бесплатные модели —
                с суффиксом <code>:free</code>). Ключ — на openrouter.ai/keys.
              </>
            ) : (
              <>
                <b>OpenAI</b> из браузера скрывает причину ошибок (показывает «TypeError»); если не
                работает — переключись на OpenRouter.
              </>
            )}
          </p>
        </section>

        <section className="block">
          <h2 className="section-title">Прогресс</h2>
          {confirming ? (
            <div className="confirm">
              <span>Удалить весь прогресс чтения? Настройки сохранятся.</span>
              <div className="confirm__row">
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    resetProgress()
                    setConfirming(false)
                  }}
                >
                  Да, сбросить
                </button>
                <button className="btn" onClick={() => setConfirming(false)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--danger" onClick={() => setConfirming(true)}>
              Сбросить прогресс чтения
            </button>
          )}
        </section>

        <section className="block">
          <p className="muted">Greda · офлайн-ридер · версия 0.2.0</p>
        </section>
      </main>
    </div>
  )
}
