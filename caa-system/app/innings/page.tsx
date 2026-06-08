'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { InningTracker, InningBadge } from '@/components/InningTracker'
import { PORTFOLIOS } from '@/lib/portfolios'

export default function InningsPage() {
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'inning_desc' | 'inning_asc' | 'portfolio' | 'pnl'>('inning_desc')

  useEffect(() => {
    fetch('/api/positions')
      .then(r => r.json())
      .then(d => setPositions(d.positions ?? []))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...positions].sort((a, b) => {
    if (sortBy === 'inning_desc') return b.inning - a.inning
    if (sortBy === 'inning_asc') return a.inning - b.inning
    if (sortBy === 'portfolio') return a.portfolio_id.localeCompare(b.portfolio_id)
    if (sortBy === 'pnl') return (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0)
    return 0
  })

  // Positions by inning bucket
  const byInning: Record<number, any[]> = {}
  for (let i = 1; i <= 9; i++) byInning[i] = positions.filter(p => p.inning === i)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Alpha Journey</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Inning Tracker — All Positions</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Payout-adjusted stage tracking. Quarterly portfolios: urgent at inning 7. Annual (E): hold through inning 8.
          </div>
        </div>

        {/* Inning distribution */}
        <div className="sec-header">Distribution by inning</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8, marginBottom: 24 }}>
          {Array.from({ length: 9 }, (_, i) => {
            const inn = i + 1
            const count = byInning[inn]?.length ?? 0
            const isExit = inn >= 8
            const isCurrent = inn >= 5 && inn <= 7
            return (
              <div key={inn} className="metric-card" style={{
                textAlign: 'center',
                borderBottom: `3px solid ${isExit ? '#f87171' : isCurrent ? '#fbbf24' : '#3f3f46'}`,
                paddingBottom: 10,
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Inning {inn}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: isExit ? '#f87171' : isCurrent ? '#fbbf24' : 'var(--text)' }}>
                  {count}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>
                  {inn <= 2 ? 'Entry' : inn <= 4 ? 'Building' : inn <= 6 ? 'Riding' : inn === 7 ? 'Monitor' : 'Exit zone'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <span>Payout rules:</span>
          <span style={{ color: '#f87171' }}>● Quarterly (A,D,F): act at inning 7</span>
          <span style={{ color: '#fbbf24' }}>● Semi-annual (B,C): act at inning 7–8</span>
          <span style={{ color: '#4ade80' }}>● Annual (E): hold through inning 8</span>
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { key: 'inning_desc', label: 'Inning ↓ (exit risk first)' },
            { key: 'inning_asc', label: 'Inning ↑ (early first)' },
            { key: 'portfolio', label: 'By portfolio' },
            { key: 'pnl', label: 'By P&L' },
          ].map(s => (
            <button
              key={s.key}
              className="nav-tab"
              style={{ fontSize: 11 }}
              data-active={sortBy === s.key}
              onClick={() => setSortBy(s.key as any)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Full position table with inning */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Port.</th>
                  <th>Ticker</th>
                  <th>Dir.</th>
                  <th>Size</th>
                  <th>Inning</th>
                  <th>Stage visual</th>
                  <th>Payout cycle</th>
                  <th>Deadline action</th>
                  <th>Catalyst</th>
                  <th>Days to catalyst</th>
                  <th>P&L</th>
                  <th>Thesis</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Loading...</td></tr>
                ) : sorted.map(pos => {
                  const config = PORTFOLIOS[pos.portfolio_id]
                  const pnl = pos.pnl_pct ?? 0
                  const catalystDays = pos.catalyst_date
                    ? Math.floor((new Date(pos.catalyst_date).getTime() - Date.now()) / 86400000)
                    : null
                  const isExitZone = (config?.payoutCycle === 'quarterly' && pos.inning >= 7) ||
                    (config?.payoutCycle === 'semiannual' && pos.inning >= 8) ||
                    pos.inning >= 9
                  const rowClass = isExitZone ? 'row-fire' : pos.inning >= 5 ? 'row-watch' : 'row-ok'

                  return (
                    <tr key={pos.id} className={rowClass}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 12, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4 }}>
                          {pos.portfolio_id}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{pos.ticker}</td>
                      <td><span className={`badge badge-${pos.direction}`}>{pos.direction}</span></td>
                      <td style={{ fontWeight: 500 }}>{pos.size_pct.toFixed(1)}%</td>
                      <td style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: isExitZone ? '#f87171' : pos.inning >= 5 ? '#fbbf24' : '#4ade80',
                      }}>
                        {pos.inning}/9
                      </td>
                      <td><InningTracker inning={pos.inning} size="sm" showLabel={false} /></td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {config?.payoutCycle ?? '—'}
                        <span style={{ marginLeft: 6, color: config?.payoutCycle === 'annual' ? '#4ade80' : config?.payoutCycle === 'semiannual' ? '#fbbf24' : '#f87171', fontSize: 9, fontWeight: 600 }}>
                          {config?.payoutCycle === 'annual' ? '0.6×' : config?.payoutCycle === 'semiannual' ? '0.8×' : '1.0×'}
                        </span>
                      </td>
                      <td>
                        <InningBadge inning={pos.inning} payoutCycle={config?.payoutCycle ?? 'quarterly'} />
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pos.catalyst_description ?? '—'}
                      </td>
                      <td style={{ fontSize: 11, fontWeight: 500, color: catalystDays !== null && catalystDays <= 21 ? '#fbbf24' : 'var(--muted)' }}>
                        {catalystDays !== null ? (catalystDays <= 0 ? 'Due' : `${catalystDays}d`) : '—'}
                      </td>
                      <td className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'} style={{ fontWeight: 500 }}>
                        {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(1)}%
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pos.thesis_summary ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
