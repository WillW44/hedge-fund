'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

const CROSS_DATA = [
  { ticker: 'SECUB SS', A: 'S', B: 'S', C: '', D: 'S', E: 'S', F: 'S', count: 5, direction: 'short', note: 'HIGHEST conviction short in fund. 5/6 mandates. Positive news = immediate fund-level review across all 5 books.' },
  { ticker: 'THEON NA', A: 'S', B: 'S', C: '', D: 'S', E: 'S', F: 'S', count: 5, direction: 'short', note: 'Equal conviction to SECUB SS. Full Kelly in all eligible mandates. DTC rising — monitor squeeze trajectory.' },
  { ticker: 'GAW LN', A: '', B: 'L', C: '', D: 'L', E: 'L', F: 'L', count: 4, direction: 'long', note: 'Highest conviction long — 4 portfolios. Size up in D & E (largest AUM / annual window).' },
  { ticker: 'RTO LN', A: '', B: 'L', C: '', D: 'L', E: 'L', F: 'L', count: 4, direction: 'long', note: 'Strong European long. E: hold full alpha journey with annual window.' },
  { ticker: 'DIE BB', A: '', B: 'L', C: '', D: 'L', E: 'L', F: 'L', count: 4, direction: 'long', note: 'European mid-cap quality. 4-portfolio conviction. Part of EU quality cluster.' },
  { ticker: 'SN US', A: 'S', B: '', C: 'S', D: 'S', E: '', F: 'S', count: 4, direction: 'short', note: 'Strong US short. 4 mandates. Check put/call ratio before sizing in C at launch.' },
  { ticker: 'AN US', A: 'L', B: '', C: 'L', D: 'L', E: '', F: '✗', count: 3, direction: 'long', note: 'F removed — US name in Europe-only mandate. Clean in A, C, D. Vol-confirmed MA cross active.' },
  { ticker: 'MEL SM', A: '', B: 'L', C: '', D: 'L', E: 'L', F: '', count: 3, direction: 'long', note: 'High consensus. Consider adding to A. FCF yield expanding 2 consecutive quarters.' },
  { ticker: 'SMT LN', A: 'L', B: '', C: '', D: '', E: 'L', F: 'L', count: 3, direction: 'long', note: 'European quality long. Large buyback catalyst. EV/EBITDA −1.8σ vs 5yr history.' },
  { ticker: 'EVD GY', A: '', B: 'L', C: '', D: 'L', E: 'L', F: '', count: 3, direction: 'long', note: 'Strong conviction — FCF expanding 3 quarters. E: hold through full inning journey.' },
]

const FACTOR_DATA = [
  {
    factor: 'EU small/mid quality (long)',
    direction: 'long' as const,
    score: 72,
    names: ['GAW LN', 'RTO LN', 'DIE BB', 'MEL SM'],
    ports: ['B', 'D', 'E', 'F'],
    risk: 'Single factor rotation hits all 4 portfolios simultaneously',
    action: 'Monitor pairwise correlation monthly. Run beta-weighted exposure weekly.',
    color: '#fbbf24',
  },
  {
    factor: 'US consumer momentum (long)',
    direction: 'long' as const,
    score: 55,
    names: ['AN US', 'ONON US', 'PSMT US'],
    ports: ['A', 'C', 'D'],
    risk: 'US momentum reversal = simultaneous drawdown in 3 portfolios',
    action: 'Check beta-weighted net exposure weekly. Correlates with RTY factor.',
    color: '#fbbf24',
  },
  {
    factor: 'EU governance short cluster',
    direction: 'short' as const,
    score: 80,
    names: ['SECUB SS', 'THEON NA', 'SCAB SS', 'HEXAB SS'],
    ports: ['A', 'B', 'D', 'E', 'F'],
    risk: 'Any positive surprise on EU governance shorts = 5-portfolio event',
    action: 'Immediate cross-portfolio review if any SECUB SS or THEON NA positive catalyst.',
    color: '#4ade80',
  },
  {
    factor: 'Quality / low-vol (long)',
    direction: 'long' as const,
    score: 38,
    names: ['SMT LN', 'DIE BB', 'RTO LN'],
    ports: ['B', 'E', 'F'],
    risk: 'Low — quality factor relatively stable. Monitor in rising rate environment.',
    action: 'Re-run DCF on quality longs if central bank surprise (>25bp move).',
    color: '#3f3f46',
  },
]

const IDEA_SHARING = [
  { type: 'US Champagne Long', deploy: 'A, C, D, E', note: '4 mandates — maximum capital deployment per idea' },
  { type: 'Europe Champagne Long', deploy: 'A, B, D, E, F', note: '5 mandates — widest alpha capture' },
  { type: 'Europe Tripwire Short', deploy: 'B, D, E, F', note: 'Size independently per each portfolio\'s Kelly parameters' },
  { type: 'US Tripwire Short', deploy: 'A, C, D, E', note: 'Check put/call ratio before sizing US shorts' },
]

function PresenceCell({ val }: { val: string }) {
  if (!val) return <span style={{ color: 'var(--border2)', fontSize: 10 }}>—</span>
  if (val === '✗') return <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(251,191,36,.15)', color: '#fbbf24', padding: '1px 5px', borderRadius: 3 }}>✗</span>
  const isLong = val === 'L'
  return (
    <span style={{
      fontSize: 9, fontWeight: 600,
      background: isLong ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
      color: isLong ? '#4ade80' : '#f87171',
      padding: '1px 5px', borderRadius: 3,
    }}>{val}</span>
  )
}

export default function CrossPortfolioPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>System Intelligence</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Cross-Portfolio Matrix & Factor Exposure</div>
        </div>

        {/* Presence matrix */}
        <div className="sec-header">Cross-portfolio presence matrix</div>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th style={{ textAlign: 'center' }}>A</th>
                  <th style={{ textAlign: 'center' }}>B</th>
                  <th style={{ textAlign: 'center' }}>C</th>
                  <th style={{ textAlign: 'center' }}>D</th>
                  <th style={{ textAlign: 'center' }}>E</th>
                  <th style={{ textAlign: 'center' }}>F</th>
                  <th>Count</th>
                  <th>Conviction signal</th>
                </tr>
              </thead>
              <tbody>
                {CROSS_DATA.map(row => (
                  <tr key={row.ticker} className={row.count >= 5 ? 'row-fire' : row.count >= 4 ? 'row-watch' : 'row-ok'}>
                    <td style={{ fontWeight: 600 }}>{row.ticker}</td>
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(p => (
                      <td key={p} style={{ textAlign: 'center' }}>
                        <PresenceCell val={(row as any)[p]} />
                      </td>
                    ))}
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: row.count >= 5 ? '#f87171' : row.count >= 4 ? '#fbbf24' : '#4ade80',
                        background: row.count >= 5 ? 'rgba(248,113,113,.12)' : row.count >= 4 ? 'rgba(251,191,36,.12)' : 'rgba(74,222,128,.1)',
                        padding: '2px 8px', borderRadius: 4,
                      }}>
                        {row.count}/{row.direction === 'short' ? 'S' : 'L'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 280 }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Factor exposure */}
        <div className="sec-header">Aggregate factor exposure — beta-weighted, cross-portfolio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {FACTOR_DATA.map(f => (
            <div key={f.factor} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${f.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontWeight: 500, fontSize: 12 }}>{f.factor}</div>
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  background: f.direction === 'long' ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)',
                  color: f.direction === 'long' ? '#4ade80' : '#f87171',
                  padding: '2px 6px', borderRadius: 3,
                }}>{f.direction}</span>
              </div>

              {/* Exposure bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>Exposure score</span><span>{f.score}/100</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${f.score}%`, background: f.color }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {f.names.map(n => (
                  <span key={n} style={{ fontSize: 10, fontWeight: 500, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 3, color: 'var(--text)' }}>{n}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                Portfolios: <b style={{ color: 'var(--text)' }}>{f.ports.join(', ')}</b>
              </div>
              <div style={{ fontSize: 11, color: '#f87171', marginBottom: 4 }}>⚠ {f.risk}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.action}</div>
            </div>
          ))}
        </div>

        {/* Idea sharing rules */}
        <div className="sec-header">Idea sharing rules — deploy simultaneously</div>
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr><th>Idea type</th><th>Deploy in</th><th>Note</th></tr>
            </thead>
            <tbody>
              {IDEA_SHARING.map(row => (
                <tr key={row.type}>
                  <td style={{ fontWeight: 500 }}>{row.type}</td>
                  <td>
                    {row.deploy.split(', ').map(p => (
                      <span key={p} style={{ fontSize: 10, fontWeight: 600, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 3, marginRight: 4, color: 'var(--accent)' }}>{p}</span>
                    ))}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Risk reduction priority */}
        <div className="sec-header">Risk reduction priority — when market deteriorates</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Step</th><th>Portfolio</th><th>Action</th><th>Rationale</th></tr></thead>
            <tbody>
              {[
                { step: 1, port: 'A', action: 'Reduce net to 40%', note: 'Most flexible mandate. Quarterly reset — locking gains is rational' },
                { step: 2, port: 'B, C', action: 'Trim to 10% net long', note: 'Semi-annual resets make mid-period reduction reversible' },
                { step: 3, port: 'D, E', action: 'Reduce only if thesis broken', note: 'Index hedge absorbs beta — stock selection is only residual risk' },
                { step: 4, port: 'F', action: 'Minimal adjustment', note: 'Near-neutral already. Track record integrity is paramount' },
              ].map(r => (
                <tr key={r.step}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{r.step}</td>
                  <td>{r.port.split(', ').map(p => (
                    <span key={p} style={{ fontSize: 11, fontWeight: 600, background: 'var(--surface2)', padding: '2px 7px', borderRadius: 3, marginRight: 4 }}>{p}</span>
                  ))}</td>
                  <td style={{ fontWeight: 500 }}>{r.action}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
