import { Link } from 'react-router-dom'
import { LEVELS, LEVEL_LABELS } from '../types'
import type { CatalogWork } from '../types'

export function WorkCard({ work }: { work: CatalogWork }) {
  return (
    <Link className="card" to={`/work/${work.id}`}>
      <div className="card__title">{work.title}</div>
      <div className="card__subtitle">{work.titleRu}</div>
      <div className="card__author">{work.authorName}</div>
      {work.genres.length > 0 ? (
        <div className="card__genres">{work.genres.join(' · ')}</div>
      ) : null}
      <div className="levels">
        {LEVELS.map((l) => {
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
