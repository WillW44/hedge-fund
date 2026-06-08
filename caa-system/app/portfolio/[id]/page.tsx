'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { InningTracker, InningBadge } from '@/components/InningTracker'
import { SignalTag, UrgencyBadge } from '@/components/SignalTag'
import { PORTFOLIOS } from '@/lib/portfolios'

const TIMING_INFO: Record<string, { cls: string; desc: string }> = {
  quarterly: { cls: 'banner-q', desc: 'Quarterly payout — 1.0× timing multiplier on 3mo catalysts. Each quarter is an independent game. FIRE urgency on positions entering innings 7–9 within 3 weeks of reset.' },
  semiannual: { cls: 'banner-s', desc: 'Semi-annual payout — 0.8× timing multiplier. Optimise for Sharpe. Month 5 discipline: trim innings 7–9, reset H2 with fresh screen hits.' },
  annual: { cls: 'banner-a', desc: 'Annual payout — 0.6× timing multiplier. Patience is the edge. Hold positions through innings 7–9. Tolerate 5–8% drawdowns if thesis intact. Never churn this book.' },
}

export default function PortfolioPage() {
  const params = useParams()
  const id = (params?.id as string)?.toUpperCase()
  const config = PORTFOLIOS[id]

  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/positions?portfolio=${id}`)
      .then(r => r.json())
      .then(d => setPositions(d.positions ?? []))
      .finally(() => setLoading(false))
  }, [id])

  if (!config) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', color: 'var(--muted)' }}>Portfolio {id} not found.</main>
    </div>
  )

  const timing = TIMING_INFO[config.payoutCycle]
  const longs = positions.filter(p => p.direction === 'long')
  const shorts = positions.filter(p => p.direction === 'short')
  const grossLong = longs.reduce((s, p) => s + p.size_pct, 0)
  const grossShort = shorts.reduce((s, p) => s + p.size_pct, 0)
  const net = grossLong - grossShort

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{config.payoutCycle} · ${config.aum}M AUM</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{config.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{config.notes}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Timing ×</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: config.timingMultiplier === 1.0 ? '#f87171' : config.timingMultiplier === 0.8 ? '#fbbf24' : '#4ade80' }}>
              {config.timingMultiplier}×
            </div>
          </div>
        </div>

        {/* Timing banner */}
        <div className={`banner ${timing.cls}`} style={{ marginBottom: 16 }}>
          <span>ℹ</span>
          <span>{timing.desc}</span>
        </div>

        {/* Exposure metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Gross long', value: `${grossLong.toFixed(1)}%`, color: '#4ade80' },
            { label: 'Gross short', value: `${grossShort.toFixed(1)}%`, color: '#f87171' },
            { label: 'Net', value: `${net >= 0 ? '+' : ''}${net.toFixed(1)}%`, color: Math.abs(net) > config.maxNet && config.maxNet > 0 ? '#f87171' : 'var(--text)' },
            { label: 'Max net', value: `${config.maxNet === 0 ? 'Neutral' : config.maxNet + '%'}` },
            { label: 'Longs', value: String(longs.length) },
            { label: 'Shorts', value: String(shorts.length) },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ color: m.color ?? 'var(--text)', fontSize: 16 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Positions */}
        {['long', 'short'].map(dir => {
          const pos = dir === 'long' ? longs : shorts
          if (pos.length === 0) return (
            <div key={dir}>
              <div className="sec-header">{dir === 'long' ? 'Champagne Longs' : 'Tripwire Shorts'}</div>
              <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                No {dir} positions. Add via Supabase or the positions API.
              </div>
            </div>
          )
          return (
            <div key={dir}>
              <div className="sec-header">{dir === 'long' ? 'Champagne Longs' : 'Tripwire Shorts'}</div>
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Size</th>
                        <th>Entry</th>
                        <th>Current</th>
                        <th>P&L</th>
                        <th>Inning</th>
                        <th>Stage</th>
                        <th>Signals</th>
                        <th>Catalyst</th>
                        <th>Thesis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.map((p: any) => {
                        const pnl = p.pnl_pct ?? 0
                        const fireSignals = p.signals?.filter((s: any) => s.urgency === 'FIRE') ?? []
                        const rowCls = fireSignals.length > 0 ? 'row-fire' : p.signals?.some((s: any) => s.urgency === 'WATCH') ? 'row-watch' : 'row-ok'
                        const catalystDays = p.catalyst_date
                          ? Math.floor((new Date(p.catalyst_date).getTime() - Date.now()) / 86400000)
                          : null
                        return (
                          <tr key={p.id} className={rowCls}>
                            <td style={{ fontWeight: 600 }}>{p.ticker}</td>
                            <td style={{ fontWeight: 500 }}>{p.size_pct.toFixed(1)}%</td>
                            <td style={{ color: 'var(--muted)' }}>{p.entry_price?.toFixed(2)}</td>
                            <td>{p.current_price?.toFixed(2) ?? '—'}</td>
                            <td className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'} style={{ fontWeight: 500 }}>
                              {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(1)}%
                            </td>
                            <td><InningTracker inning={p.inning} size="sm" /></td>
                            <td><InningBadge inning={p.inning} payoutCycle={config.payoutCycle} /></td>
                            <td>
                              {p.signals?.slice(0, 2).map((s: any) => (
                                <SignalTag key={s.signal_type} type={s.signal_type} />
                              ))}
                            </td>
                            <td style={{ fontSize: 11, color: catalystDays !== null && catalystDays <= 21 ? '#fbbf24' : 'var(--muted)' }}>
                              {catalystDays !== null ? (catalystDays <= 0 ? 'Due' : `${catalystDays}d`) : '—'}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.thesis_summary ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
