'use client'

interface InningTrackerProps {
  inning: number
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function InningTracker({ inning, size = 'md', showLabel = true }: InningTrackerProps) {
  const dotSize = size === 'sm' ? 7 : 9
  const gap = size === 'sm' ? 2 : 3

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {Array.from({ length: 9 }, (_, i) => {
        const inn = i + 1
        let bg = 'var(--border2)'
        if (inn < inning) bg = '#52525b'          // done — gray
        else if (inn === inning) bg = '#4ade80'    // current — green
        else if (inn >= 8) bg = 'rgba(248,113,113,.3)'  // exit zone — dim red
        return (
          <div
            key={inn}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: bg,
              flexShrink: 0,
              border: inn === inning ? '1px solid rgba(74,222,128,.5)' : 'none',
            }}
          />
        )
      })}
      {showLabel && (
        <span style={{
          fontSize: size === 'sm' ? 9 : 10,
          color: inning >= 8 ? '#f87171' : inning >= 6 ? '#fbbf24' : '#71717a',
          marginLeft: 4,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          Inn. {inning}
        </span>
      )}
    </div>
  )
}

// Urgency badge for inning stage
export function InningBadge({ inning, payoutCycle }: { inning: number; payoutCycle: string }) {
  const isQuarterly = payoutCycle === 'quarterly'
  const isSemi = payoutCycle === 'semiannual'

  let label = ''
  let color = '#71717a'

  if (inning <= 2) { label = '2nd inning — hold'; color = '#4ade80' }
  else if (inning <= 4) { label = 'Building'; color = '#4ade80' }
  else if (inning <= 6) { label = 'Riding'; color = '#4ade80' }
  else if (inning === 7) {
    if (isQuarterly) { label = 'Trim 50%'; color = '#f87171' }
    else if (isSemi) { label = 'Monitor'; color = '#fbbf24' }
    else { label = 'Hold'; color = '#4ade80' }
  } else if (inning === 8) {
    if (isQuarterly) { label = 'EXIT'; color = '#f87171' }
    else if (isSemi) { label = 'Exit plan'; color = '#f87171' }
    else { label = 'Review'; color = '#fbbf24' }
  } else {
    label = 'EXIT'; color = '#f87171'
  }

  return (
    <span style={{
      fontSize: 9,
      fontWeight: 500,
      color,
      background: `${color}18`,
      padding: '2px 6px',
      borderRadius: 3,
    }}>
      {label}
    </span>
  )
}
