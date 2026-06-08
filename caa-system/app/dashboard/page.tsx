'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { InningTracker, InningBadge } from '@/components/InningTracker'
import { UrgencyBadge, SignalTag } from '@/components/SignalTag'
import { PORTFOLIOS } from '@/lib/portfolios'

interface Position {
  id: string
  portfolio_id: string
  ticker: string
  direction: string
  size_pct: number
  inning: number
  entry_price: number
  current_price: number
  pnl_pct: number
  signals: { signal_type: string; urgency: string; description: string }[]
  catalyst_date?: string
  catalyst_description?: string
  thesis_summary?: string
}

interface SignalStats {
  total: number
  fire: number
  watch: number
  ok: number
  mandatory_exits: number
}

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [stats, setStats] = useState<SignalStats>({ total: 0, fire: 0, watch: 0, ok: 0, mandatory_exits: 0 })
  const [loading, setLoading] = useState(true)
  const [activePortfolio, setActivePortfolio] = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const [posRes, sigRes] = await Promise.all([
          fetch('/api/positions'),
          fetch('/api/signals'),
        ])
        const posData = await posRes.json()
        const sigData = await sigRes.json()
        setPositions(posData.positions ?? [])
        setStats(sigData.stats ?? { total: 0, fire: 0, watch: 0, ok: 0, mandatory_exits: 0 })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)  // refresh every 5min
    return () => clearInterval(interval)
  }, [])

  const filteredPositions = activePortfolio === 'all'
    ? positions
    : positions.filter(p => p.portfolio_id === activePortfolio)

  // Compute portfolio-level exposure stats
  const portStats = Object.keys(PORTFOLIOS).map(pid => {
    const portPositions = positions.filter(p => p.portfolio_id === pid)
    const grossLong = portPositions.filter(p => p.direction === 'long').reduce((s, p) => s + p.size_pct, 0)
    const grossShort = portPositions.filter(p => p.direction === 'short').reduce((s, p) => s + p.size_pct, 0)
    const net = grossLong - grossShort
    const config = PORTFOLIOS[pid]
    const netBreached = Math.abs(net) > config.maxNet && config.maxNet > 0
    return { pid, grossLong, grossShort, net, netBreached, count: portPositions.length, config }
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Consumer Alpha Advisors</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Technical Analysis Dashboard</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {loading ? 'Loading...' : `Updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UKT`}
          </div>
        </div>

        {/* Signal stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total signals', value: stats.total, color: 'var(--text)' },
            { label: 'Fire urgency', value: stats.fire, color: '#f87171' },
            { label: 'Watch', value: stats.watch, color: '#fbbf24' },
            { label: 'Mandatory exits', value: stats.mandatory_exits, color: '#f87171' },
            { label: 'Total AUM', value: '$180M', color: 'var(--accent)' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ color: m.color, fontSize: 22 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Portfolio exposure grid */}
        <div className="sec-header">Portfolio exposure — live</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {portStats.map(ps => (
            <div key={ps.pid} className="card" style={{
              padding: '14px 16px',
              borderLeft: `3px solid ${ps.netBreached ? '#f87171' : '#3f3f46'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ps.config.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>
                    ${ps.config.aum}M · {ps.config.payoutCycle}
                  </span>
                </div>
                {ps.netBreached && (
                  <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(248,113,113,.15)', color: '#f87171', padding: '2px 6px', borderRadius: 3 }}>
                    NET BREACH
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 9 }}>Gross long</div>
                  <div style={{ color: '#4ade80', fontWeight: 500 }}>{ps.grossLong.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 9 }}>Gross short</div>
                  <div style={{ color: '#f87171', fontWeight: 500 }}>{ps.grossShort.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 9 }}>Net</div>
                  <div style={{ color: ps.netBreached ? '#f87171' : 'var(--text)', fontWeight: 500 }}>
                    {ps.net >= 0 ? '+' : ''}{ps.net.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 9 }}>Positions</div>
                  <div style={{ fontWeight: 500 }}>{ps.count}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
                Max net: {ps.config.maxNet === 0 ? 'Neutral' : `${ps.config.maxNet}%`} ·
                Hard cap: {ps.config.hardCap}% ·
                {ps.config.exposure === 'europe' ? ' Europe only' : ps.config.exposure === 'us' ? ' US only' : ' Europe & US'}
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {['all', 'A', 'B', 'C', 'D', 'E', 'F'].map(p => (
            <button
              key={p}
              className="nav-tab"
              style={{ fontSize: 11 }}
              onClick={() => setActivePortfolio(p)}
              data-active={activePortfolio === p}
            >
              {p === 'all' ? 'All positions' : `Port ${p}`}
            </button>
          ))}
        </div>

        {/* Positions table */}
        <div className="sec-header">Active positions — all signals + inning stage</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Port.</th>
                  <th>Ticker</th>
                  <th>Direction</th>
                  <th>Size</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>P&L</th>
                  <th>Inning</th>
                  <th>Stage</th>
                  <th>Signals fired</th>
                  <th>Catalyst</th>
                  <th>Action required</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Loading positions...</td></tr>
                ) : filteredPositions.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No active positions. Add positions in Supabase or via the API.</td></tr>
                ) : filteredPositions.map(pos => {
                  const fireSignals = pos.signals?.filter(s => s.urgency === 'FIRE') ?? []
                  const rowClass = fireSignals.length > 0 ? 'row-fire' : pos.signals?.some(s => s.urgency === 'WATCH') ? 'row-watch' : 'row-ok'
                  const pnl = pos.pnl_pct ?? 0
                  const config = PORTFOLIOS[pos.portfolio_id]
                  const catalystDays = pos.catalyst_date
                    ? Math.floor((new Date(pos.catalyst_date).getTime() - Date.now()) / 86400000)
                    : null

                  return (
                    <tr key={pos.id} className={rowClass}>
                      <td>
                        <span style={{
                          fontWeight: 600,
                          fontSize: 12,
                          background: 'var(--surface2)',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}>{pos.portfolio_id}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{pos.ticker}</td>
                      <td>
                        <span className={`badge badge-${pos.direction === 'long' ? 'long' : 'short'}`}>
                          {pos.direction}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{pos.size_pct.toFixed(1)}%</td>
                      <td style={{ color: 'var(--muted)' }}>{pos.entry_price?.toFixed(2)}</td>
                      <td>{pos.current_price?.toFixed(2) ?? '—'}</td>
                      <td className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'} style={{ fontWeight: 500 }}>
                        {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(1)}%
                      </td>
                      <td>
                        <InningTracker inning={pos.inning} size="sm" showLabel={true} />
                      </td>
                      <td>
                        <InningBadge inning={pos.inning} payoutCycle={config?.payoutCycle ?? 'quarterly'} />
                      </td>
                      <td>
                        {pos.signals?.slice(0, 3).map(s => (
                          <SignalTag key={s.signal_type} type={s.signal_type} />
                        ))}
                        {(pos.signals?.length ?? 0) > 3 && (
                          <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{(pos.signals?.length ?? 0) - 3}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {catalystDays !== null
                          ? catalystDays <= 0 ? 'Catalyst due' : `${catalystDays}d`
                          : '—'}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {fireSignals.length > 0
                          ? <span style={{ color: '#f87171', fontWeight: 500 }}>{fireSignals[0].description.slice(0, 50)}{fireSignals[0].description.length > 50 ? '…' : ''}</span>
                          : <span style={{ color: 'var(--muted)' }}>Hold</span>}
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
