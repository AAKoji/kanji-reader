// Clickable word-by-word text, shared by the daily article and the novel reader.
export default function SegmentText({ segments, userLevel, boundaryColor, savedWords, onWordClick }) {
  return (
    <div className="article-body">
      {segments.map((seg, i) => {
        if (!seg.reading && !seg.meaning) {
          return (
            <span key={i}>
              {seg.text.includes('\n') ? <><br /><br /></> : seg.text}
            </span>
          )
        }
        const aboveLevel = userLevel && seg.jlpt &&
          parseInt(seg.jlpt[1]) < parseInt(userLevel[1])
        if (aboveLevel) {
          const boundaryActive =
            (userLevel === 'N4' || userLevel === 'N5') && boundaryColor !== 'off'
          const cls = boundaryActive ? 'word-above-level word-boundary' : 'word-above-level'
          return (
            <span key={i} className={cls} onClick={() => onWordClick(seg)}>
              {seg.reading}
            </span>
          )
        }
        const saved = savedWords[seg.text]
        const cls = saved
          ? saved.save_type === 'vocab' ? 'saved-vocab' : 'saved-reading'
          : ''
        return (
          <span
            key={i}
            className={`word ${cls}`}
            onClick={() => onWordClick(seg)}
          >
            {seg.text}
          </span>
        )
      })}
    </div>
  )
}
