// Запрос объяснения грамматики предложения в OpenAI (прямой клиентский вызов с
// пользовательским ключом). Ключ нигде не логируется и не уходит, кроме api.openai.com.

interface ExplainOpts {
  text: string
  prompt: string
  apiKey: string
  model: string
}

const cache = new Map<string, string>()

function fillPrompt(prompt: string, text: string): string {
  // Функция-замена, чтобы $ в тексте (напр. «$30,000») не толковался как спецсимвол.
  return prompt.includes('__SENTENCE__')
    ? prompt.replace(/__SENTENCE__/g, () => text)
    : `${prompt}\n\n${text}`
}

function cacheKey({ text, prompt, model }: ExplainOpts): string {
  return `${model} ${fillPrompt(prompt, text)}`
}

/** Синхронно отдаёт закэшированный ответ, если он уже есть (чтобы не мигало «загрузка»). */
export function peekExplanation(opts: ExplainOpts): string | undefined {
  return cache.get(cacheKey(opts))
}

export async function explainSentence(opts: ExplainOpts): Promise<string> {
  const key = cacheKey(opts)
  const hit = cache.get(key)
  if (hit) return hit

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: fillPrompt(opts.prompt, opts.text) }],
        temperature: 0.3,
      }),
    })
  } catch {
    // OpenAI не шлёт CORS-заголовки на ответах-ошибках, поэтому браузер отдаёт fetch
    // как TypeError без деталей. Чаще всего это неверный ключ / нет средств / нет доступа к модели.
    throw new Error(
      'Запрос к OpenAI не прошёл. Проверьте ключ API, баланс счёта и название модели. ' +
        '(Детали ошибки браузер скрывает из-за CORS у OpenAI.)',
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ? `: ${err.error.message}` : ''
    } catch {
      /* пусто */
    }
    throw new Error(`OpenAI ${res.status}${detail}`)
  }

  const data = await res.json()
  const answer: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
  if (answer) cache.set(key, answer)
  return answer
}
