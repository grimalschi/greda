// Запрос объяснения грамматики предложения в ИИ-провайдера (прямой клиентский вызов
// с пользовательским ключом). Ключ нигде не логируется и не уходит, кроме API провайдера.
import type { AiProvider } from './storage'

interface ExplainOpts {
  text: string
  prompt: string
  provider: AiProvider
  apiKey: string
  model: string
}

const ENDPOINTS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

const cache = new Map<string, string>()

function fillPrompt(prompt: string, text: string): string {
  // Функция-замена, чтобы $ в тексте (напр. «$30,000») не толковался как спецсимвол.
  return prompt.includes('__SENTENCE__')
    ? prompt.replace(/__SENTENCE__/g, () => text)
    : `${prompt}\n\n${text}`
}

function cacheKey({ provider, text, prompt, model }: ExplainOpts): string {
  return `${provider} ${model} ${fillPrompt(prompt, text)}`
}

/** Синхронно отдаёт закэшированный ответ, если он уже есть (чтобы не мигало «загрузка»). */
export function peekExplanation(opts: ExplainOpts): string | undefined {
  return cache.get(cacheKey(opts))
}

export async function explainSentence(opts: ExplainOpts): Promise<string> {
  const key = cacheKey(opts)
  const hit = cache.get(key)
  if (hit) return hit

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.apiKey}`,
  }
  // OpenRouter рекомендует эти заголовки (необязательно, для статистики/рейтинга).
  if (opts.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://grimalschi.github.io/greda/'
    headers['X-Title'] = 'Greda'
  }

  let res: Response
  try {
    res = await fetch(ENDPOINTS[opts.provider], {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: 'user', content: fillPrompt(opts.prompt, opts.text) }],
        temperature: 0.3,
      }),
    })
  } catch {
    // Сетевой сбой или (для OpenAI) ответ-ошибка без CORS-заголовков → браузер отдаёт
    // голый TypeError. Чаще всего это неверный ключ / нет средств / нет доступа к модели.
    const hint =
      opts.provider === 'openai'
        ? ' OpenAI скрывает детали ошибок из-за CORS — попробуйте провайдера OpenRouter, он показывает причину.'
        : ''
    throw new Error(`Запрос не прошёл. Проверьте ключ API, баланс и название модели.${hint}`)
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ? `: ${err.error.message}` : ''
    } catch {
      /* пусто */
    }
    throw new Error(`${opts.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} ${res.status}${detail}`)
  }

  const data = await res.json()
  const answer: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
  if (answer) cache.set(key, answer)
  return answer
}
