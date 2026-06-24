import { Link } from 'react-router-dom'
import { LEVELS, LEVEL_ORDER, LEVEL_LABELS, LANGUAGE_LABELS } from '../types'
import type { CatalogWork } from '../types'
import type { ReadingStatus } from '../lib/progress'

export function WorkCard({ work, status = 'new' }: { work: CatalogWork; status?: ReadingStatus }) {
  return (
    <Link className="card" to={`/work/${work.id}`}>
      <div className="card__title">{work.title}</div>
      <div className="card__subtitle">{work.titleRu}</div>
      <div className="card__author">
        {work.authorName}
        {work.lang && work.lang !== 'es' ? (
          <span className="card__lang">{LANGUAGE_LABELS[work.lang]}</span>
        ) : null}
      </div>
      {work.genres.length > 0 ? (
        <div className="card__genres">{work.genres.join(' · ')}</div>
      ) : null}

      <div className="card__meta">
        {status === 'done' ? <span className="card__status card__status--done">✓ прочитано</span> : null}
        {status === 'started' ? <span className="card__status card__status--started">● читаю</span> : null}
      </div>

      <div className="levels">
        {LEVEL_ORDER.filter((l) => LEVELS.includes(l) || work.availableLevels.includes(l)).map((l) => {
          const has = work.availableLevels.includes(l)
          const w = work.words?.[l]
          return (
            <span
              key={l}
              className={`level-badge ${has ? '' : 'level-badge--off'}`}
              title={has ? `${LEVEL_LABELS[l]}: ${w ?? '—'} слов` : `Уровень ${LEVEL_LABELS[l]} скоро`}
            >
              {LEVEL_LABELS[l]}
              {has && w != null ? <span className="level-badge__w">{w}</span> : null}
            </span>
          )
        })}
      </div>
    </Link>
  )
}
