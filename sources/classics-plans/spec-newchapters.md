# greda — сгенерировать ОДИН уровень нового произведения (многоглавно)

Новое произведение, исходник заранее разбит на N частей-сегментов. Нужно написать
адаптацию ОДНОГО уровня CEFR — N глав, по одной главе на каждую часть, как
непрерывную историю от начала до конца.

Задание (JSON): `slug`, `level` (a2|b1|b2|c1), `N`, `segDir`, `originalTitle`, `titleEs`.

## Шаг 1. Прочитай ВСЕ части источника
Файлы `<segDir>/part-01.txt … part-0N.txt` — последовательные куски оригинала (англ.).
Прочитай КАЖДУЮ часть целиком (если файл длинный — дочитай через offset). Часть k → глава k.

## Шаг 2. Напиши N глав на испанском (уровень из задания)
Для каждой части k создай:
- `/home/parallels/greda/public/content/works/<slug>/levels/<level>/chapter-0kk.json`

Формат (строго по схеме):
```
{ "schemaVersion":"1.0","workId":"<slug>","level":"<level>",
  "chapter":{"id":"chapter-00k","number":k,"title":"<краткий испанский заголовок главы>"},
  "paragraphs":[ {"id":"para-001","sentences":[ {"id":"sent-001","text":"…ES…","translationRu":"…RU…"} ]} ] }
```
И один манифест `/home/parallels/greda/public/content/works/<slug>/levels/<level>/manifest.json`:
```
{ "schemaVersion":"1.0","workId":"<slug>","level":"<level>",
  "chapters":[ {"id":"chapter-001","number":1,"title":"…","sentenceCount":N1}, … ] }
```

### Правила адаптации (graded reader)
- Это адаптация, а не перевод. **Мягкое сокращение**: сохраняй последовательность событий,
  ключевые сцены и образы каждой части; упрощай длинные описания. НЕ выбрасывай сюжетные сцены.
- Главы идут подряд и читаются как цельная история (глава k продолжает k−1).
- text — ТОЛЬКО испанский; translationRu — естественный литературный русский по предложению.
- Заголовок главы — короткий испанский (по содержанию части), напр. «La llegada», «El pacto».
  Глава 1 может начинаться с завязки; не вставляй «Capítulo» в text.

### Объём на главу по уровню (предложений)
- **a2**: 14–18. Короткие простые фразы, настоящее/простое прошедшее, базовая лексика, мало придаточных.
- **b1**: 16–20. Связный текст, умеренные придаточные, шире бытовая лексика.
- **b2**: 18–24. Богаче лексика и синтаксис, идиоматичность, разные времена.
- **c1**: 20–26. Близко к литературному, сложные конструкции, тонкие оттенки.

### ВАЖНО про объект `chapter`
В объекте `chapter` ТОЛЬКО три поля: `id`, `number`, `title`. НЕ добавляй туда `sentenceCount`
и ничего другого — `sentenceCount` живёт ТОЛЬКО в манифесте.

### id (КРИТИЧНО)
- `para-001`, `para-002`, … и `sent-001`, … — сквозная нумерация В ПРЕДЕЛАХ КАЖДОЙ ГЛАВЫ
  (сбрасывается в начале каждой главы), 3 цифры.
- `sentenceCount` в манифесте = точное число предложений в соответствующей главе.

НЕ трогай `work.json`, `catalog.json`, `authors/*`, другие уровни. Их создаст оркестратор.

## Шаг 3. Самопроверка
```
node -e "const fs=require('fs');const d='/home/parallels/greda/public/content/works/<slug>/levels/<level>';const m=require(d+'/manifest.json');let ok=true;for(const c of m.chapters){const ch=require(d+'/'+c.id+'.json');let n=0;for(const p of ch.paragraphs)n+=p.sentences.length;if(n!==c.sentenceCount){ok=false;console.log('MISMATCH',c.id,n,c.sentenceCount)}}console.log('chapters',m.chapters.length,'allMatch',ok)"
```
Добейся `allMatch true` и числа глав = N.

## Итог (коротко): slug, level, число глав, диапазон предложений/гл.
