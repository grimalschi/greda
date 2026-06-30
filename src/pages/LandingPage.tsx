import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { fetchCatalog } from '../lib/content'
import { useAppState } from '../state/store'
import { LEVEL_LABELS } from '../types'

/** Демо-фрагменты для интерактивной мини-демонстрации в герое:
 *  кликаешь по испанской фразе — под ней появляется русский перевод,
 *  ровно как в самом ридере. */
const DEMO = [
  { es: 'El padre Andréi, arcipreste de la catedral,', ru: 'Отец Андрей, протоиерей собора,' },
  { es: 'hablaba con la madre de Nadya', ru: 'разговаривал с матерью Нади' },
  { es: 'en voz baja,', ru: 'вполголоса,' },
  { es: 'mientras el samovar cantaba sobre la mesa.', ru: 'пока самовар пел на столе.' },
] as const

const FEATURES = [
  {
    icon: '👆',
    title: 'Перевод по клику',
    text: 'Кликни по испанской фразе — под ней появится точный русский перевод. Пофразовый, не пословный: видишь, как устроена живая речь.',
  },
  {
    icon: '🎚️',
    title: 'Свой уровень',
    text: 'Тексты адаптированы по шкале CEFR. Стандарт — честный B1: упрощается язык, а не содержание. Ни одна сцена не выброшена.',
  },
  {
    icon: '🧠',
    title: 'Объяснение от ИИ',
    text: 'Не понял грамматику в предложении? Вкладка «Объяснение» разберёт времена, конструкции и слова прямо в контексте.',
  },
  {
    icon: '✍️',
    title: 'Оригинал автора',
    text: 'Рядом — подлинный текст в языке автора: английский Дойла, немецкий Кафки, русский Чехова. Сравнивай адаптацию с первоисточником.',
  },
  {
    icon: '📥',
    title: 'Работает офлайн',
    text: 'Это PWA: установи на телефон и читай в метро, в самолёте, где угодно. Открытые рассказы сохраняются и доступны без сети.',
  },
  {
    icon: '🆓',
    title: 'Бесплатно и без аккаунта',
    text: 'Никакой регистрации, рекламы и подписок. Прогресс хранится на твоём устройстве. Все тексты — общественное достояние.',
  },
] as const

const STEPS = [
  {
    n: 1,
    title: 'Выбери рассказ',
    text: 'Фильтруй по автору, жанру, уровню и длине. Начни с короткого — он на пару чашек кофе.',
  },
  {
    n: 2,
    title: 'Читай и кликай',
    text: 'Читай по-испански. Споткнулся о фразу — тап, и перевод тут же под строкой. Нужна грамматика — спроси ИИ.',
  },
  {
    n: 3,
    title: 'Возвращайся',
    text: 'Приложение помнит, где ты остановился, и отмечает прочитанное. Открыл — и продолжаешь с того же места.',
  },
] as const

export function LandingPage() {
  const { store } = useAppState()
  const { data: catalog } = useAsync(fetchCatalog, [])
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const stats = useMemo(() => {
    const works = catalog?.works ?? []
    const authors = new Set(works.map((w) => w.authorId))
    return { works: works.length, authors: authors.size }
  }, [catalog])

  const allRevealed = revealed.size === DEMO.length
  const toggle = (i: number) =>
    setRevealed((s) => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const cont = store.lastOpened
  const contWork = cont ? catalog?.works.find((w) => w.id === cont.workId) : undefined

  return (
    <div className="landing">
      <header className="lnav">
        <div className="lnav__brand">
          <span className="lnav__logo">Greda</span>
        </div>
        <nav className="lnav__links">
          <Link className="lnav__link" to="/library">
            Библиотека
          </Link>
          <Link className="lnav__link lnav__link--icon" to="/settings" aria-label="Настройки">
            ⚙
          </Link>
        </nav>
      </header>

      {/* ---------- Герой ---------- */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <div className="hero__eyebrow">Чтение на испанском · перевод на русский</div>
            <h1 className="hero__title">
              Читай мировую классику&nbsp;по-испански&nbsp;— и понимай&nbsp;<em>каждое слово</em>
            </h1>
            <p className="hero__lede">
              Рассказы Шерлока Холмса, Чехова, Кафки и Джойса, бережно адаптированные под твой уровень.
              Кликни по любой фразе — увидишь русский перевод. Без словаря, без зубрёжки, без скуки.
            </p>
            <div className="hero__cta">
              <Link className="lbtn lbtn--primary" to="/library">
                Открыть библиотеку →
              </Link>
              {cont && contWork ? (
                <Link
                  className="lbtn lbtn--ghost"
                  to={`/read/${cont.workId}/${cont.level}/${cont.chapterId}`}
                >
                  Продолжить «{contWork.title}»
                </Link>
              ) : (
                <a className="lbtn lbtn--ghost" href="#how">
                  Как это работает
                </a>
              )}
            </div>
            <div className="hero__stats">
              <div className="hstat">
                <span className="hstat__n">{stats.works || 58}</span>
                <span className="hstat__l">произведений</span>
              </div>
              <div className="hstat">
                <span className="hstat__n">{stats.authors || 30}+</span>
                <span className="hstat__l">авторов</span>
              </div>
              <div className="hstat">
                <span className="hstat__n">A1–C2</span>
                <span className="hstat__l">уровни</span>
              </div>
              <div className="hstat">
                <span className="hstat__n">∞</span>
                <span className="hstat__l">офлайн</span>
              </div>
            </div>
          </div>

          {/* Живая мини-демонстрация механики «клик → перевод» */}
          <div className="hero__demo" role="group" aria-label="Демонстрация перевода по клику">
            <div className="demo-card">
              <div className="demo-card__bar">
                <span className="demo-card__dot" />
                <span className="demo-card__dot" />
                <span className="demo-card__dot" />
                <span className="demo-card__lvl">B1 · Чехов</span>
              </div>
              <p className="demo-card__text">
                {DEMO.map((f, i) => (
                  <span key={i}>
                    <span
                      className={`demo-sent ${revealed.has(i) ? 'demo-sent--active' : ''}`}
                      onClick={() => toggle(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(i)}
                    >
                      {f.es}
                    </span>{' '}
                    {revealed.has(i) ? <span className="demo-tr">{f.ru}</span> : null}
                  </span>
                ))}
              </p>
              <div className="demo-card__hint">
                {allRevealed ? '↑ так и читаешь — фраза за фразой' : '↑ нажми на любую фразу'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Возможности ---------- */}
      <section className="lsection">
        <div className="lsection__head">
          <h2 className="lsection__title">Не учебник. Настоящие истории.</h2>
          <p className="lsection__sub">
            Всё, что нужно, чтобы читать в удовольствие и расти в языке одновременно.
          </p>
        </div>
        <div className="fgrid">
          {FEATURES.map((f) => (
            <div className="fcard" key={f.title}>
              <div className="fcard__icon" aria-hidden>
                {f.icon}
              </div>
              <h3 className="fcard__title">{f.title}</h3>
              <p className="fcard__text">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Как это работает ---------- */}
      <section className="lsection lsection--alt" id="how">
        <div className="lsection__head">
          <h2 className="lsection__title">Три шага — и ты читаешь</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step__n">{s.n}</div>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__text">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Метод ---------- */}
      <section className="lsection">
        <div className="method">
          <div className="method__copy">
            <h2 className="lsection__title">Упрощаем язык, а не историю</h2>
            <p className="method__text">
              Обычные адаптации режут текст до пересказа — и теряют то, ради чего книгу стоит читать.
              Здесь другой подход: <strong>«проще, но не короче»</strong>. Сохраняются все сцены, реплики,
              повороты и детали оригинала — упрощается только форма: короткие предложения, частотные
              слова, простые времена.
            </p>
            <p className="method__text">
              Перевод делается напрямую с языка автора, а каждый уровень полностью покрывает источник.
              Ты читаешь ту же историю, что и в оригинале, — просто на доступном тебе испанском.
            </p>
            <Link className="lbtn lbtn--primary" to="/library">
              Выбрать первый рассказ →
            </Link>
          </div>
          <ul className="method__levels" aria-label="Уровни сложности">
            {(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const).map((l, i) => (
              <li className="mlevel" key={l} style={{ '--i': i } as CSSProperties}>
                <span className="mlevel__badge">{LEVEL_LABELS[l]}</span>
                <span className="mlevel__bar">
                  <span className="mlevel__fill" style={{ width: `${35 + i * 13}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Финальный CTA ---------- */}
      <section className="lcta">
        <h2 className="lcta__title">Открой первую страницу прямо сейчас</h2>
        <p className="lcta__sub">
          Бесплатно, без регистрации, работает офлайн. {stats.works || 58} произведений уже ждут.
        </p>
        <Link className="lbtn lbtn--primary lbtn--lg" to="/library">
          Перейти в библиотеку →
        </Link>
      </section>

      <footer className="lfooter">
        <span>Greda</span>
        <span className="lfooter__dot">·</span>
        <span>тексты — общественное достояние (Project Gutenberg)</span>
      </footer>
    </div>
  )
}
