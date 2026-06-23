// Запрос объяснения грамматики предложения в ИИ-провайдера (прямой клиентский вызов
// с пользовательским ключом). Стримит ответ по мере прихода токенов (SSE).
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

/** Синхронно отдаёт закэшированный ответ, если он уже есть (чтобы не стримить заново). */
export function peekExplanation(opts: ExplainOpts): string | undefined {
  return cache.get(cacheKey(opts))
}

/** Стримит объяснение: вызывает onToken на каждый пришедший фрагмент, возвращает весь текст. */
export async function explainSentenceStream(
  opts: ExplainOpts,
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const key = cacheKey(opts)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.apiKey}`,
  }
  if (opts.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://grimalschi.github.io/greda/'
    headers['X-Title'] = 'Greda'
  }

  let res: Response
  try {
    res = await fetch(ENDPOINTS[opts.provider], {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: 'user', content: fillPrompt(opts.prompt, opts.text) }],
        temperature: 0.3,
        stream: true,
      }),
    })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    const hint =
      opts.provider === 'openai'
        ? ' OpenAI скрывает детали ошибок из-за CORS — попробуйте провайдера OpenRouter, он показывает причину.'
        : ''
    throw new Error(`Запрос не прошёл. Проверьте ключ API, баланс и название модели.${hint}`)
  }

  if (!res.ok || !res.body) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ? `: ${err.error.message}` : ''
    } catch {
      /* пусто */
    }
    throw new Error(`${opts.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} ${res.status}${detail}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta: string | undefined = json?.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onToken(delta)
        }
      } catch {
        /* частичный/служебный chunk — пропускаем */
      }
    }
  }
  full = full.trim()
  if (full) cache.set(key, full)
  return full
}
