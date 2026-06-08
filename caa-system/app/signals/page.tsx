'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { UrgencyBadge, SignalTag } from '@/components/SignalTag'
import { InningTracker } from '@/components/InningTracker'
import type { TechnicalSignal } from '@/types'

export default function SignalsPage() {
  const [signals, setSignals] = useState<TechnicalSignal[]>([])
  const [stats, setStats] = useState({ total: 0, fire: 0, watch: 0, ok: 0, mandatory_exits: 0 })
  const [loading, setLoading] = useState(true)
  const [portFilter, setPortFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')
  const [urgFilter, setUrgFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/signals')
      .then(r => r.json())
      .then(d => { setSignals(d.signals ?? []); setStats(d.stats ?? {}) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = signals.filter(s => {
    if (portFilter !== 'all' && !s.eligible_portfolios.includes(portFilter as any)) return false
    if (dirFilter !== 'all' && s.direction !== dirFilter) return false
    if (urgFilter !== 'all' && s.urgency !== urgFilter) return false
    if (search && !s.ticker.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Signal Monitor</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>All 28 Technical Indicators</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total signals', value: stats.total },
            { label: 'Fire', value: stats.fire, color: '#f87171' },
            { label: 'Watch', value: stats.watch, color: '#fbbf24' },
            { label: 'OK', value: stats.ok, color: '#4ade80' },
            { label: 'Mandatory exits', value: stats.mandatory_exits, color: '#f87171' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ color: m.color ?? 'var(--text)', fontSize: 22 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Indicator legend */}
        <div className="sec-header">Indicator categories</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'Momentum & trend', cls: 'tag-momentum' },
            { label: 'Hard catalysts', cls: 'tag-catalyst' },
            { label: 'Soft catalysts', cls: 'tag-soft' },
            { label: 'Governance / short', cls: 'tag-governance' },
            { label: 'Accounting', cls: 'tag-accounting' },
            { label: 'Singular reliance', cls: 'tag-reliance' },
            { label: 'Valuation', cls: 'tag-valuation' },
            { label: 'Borrow / squeeze', cls: 'tag-governance' },
          ].map(t => <span key={t.label} className={`tag ${t.cls}`} style={{ fontSize: 10, padding: '3px 8px' }}>{t.label}</span>)}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search ticker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 140 }}
          />
          {[
            { label: 'Portfolio', state: portFilter, set: setPortFilter, opts: ['all', 'A', 'B', 'C', 'D', 'E', 'F'] },
            { label: 'Direction', state: dirFilter, set: setDirFilter, opts: ['all', 'long', 'short'] },
            { label: 'Urgency', state: urgFilter, set: setUrgFilter, opts: ['all', 'FIRE', 'WATCH', 'OK'] },
          ].map(f => (
            <select key={f.label} value={f.state} onChange={e => f.set(e.target.value)}>
              {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? `All ${f.label.toLowerCase()}s` : o}</option>)}
            </select>
          ))}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>
            {filtered.length} signal{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Signals table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Urgency</th>
                  <th>Ticker</th>
                  <th>Dir.</th>
                  <th>Inning</th>
                  <th>Signal type</th>
                  <th>Value / threshold</th>
                  <th>Portfolios</th>
                  <th>Description</th>
                  <th>Action</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Fetching live signals from Polygon.io...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No signals match the current filter.</td></tr>
                ) : filtered.map((s, i) => {
                  const rowClass = s.urgency === 'FIRE' ? 'row-fire' : s.urgency === 'WATCH' ? 'row-watch' : 'row-ok'
                  return (
                    <tr key={i} className={rowClass}>
                      <td><UrgencyBadge urgency={s.urgency} /></td>
                      <td style={{ fontWeight: 600 }}>{s.ticker}</td>
                      <td><span className={`badge badge-${s.direction}`}>{s.direction}</span></td>
                      <td><InningTracker inning={s.inning} size="sm" /></td>
                      <td><SignalTag type={s.signal_type} /></td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {s.value !== null ? s.value?.toFixed(2) : '—'}
                        {s.threshold !== null ? <span style={{ color: 'var(--border2)' }}> / {s.threshold?.toFixed(2)}</span> : ''}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {s.eligible_portfolios.join(', ')}
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 200 }}>{s.description}</td>
                      <td style={{ fontSize: 11, fontWeight: s.urgency === 'FIRE' ? 500 : 400, color: s.urgency === 'FIRE' ? '#f87171' : 'var(--text)' }}>
                        {s.action}
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--muted)' }}>{s.flag || '—'}</td>
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
